import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { initFirebaseAdmin, getDb, getAdminAuth } from './lib/firebaseAdmin.js';
import {
  handleTelegramUpdate,
  generateLinkCode,
  getLinkStatus,
  unlinkAccount,
  dispatchDailyReminders,
  dispatchWeeklyRecap,
  cleanExpiredTempMessages,
  demoCronStatus
} from './lib/telegramBot.js';
import {
  verifyWebLoginCode,
  sendTelegramMessage,
  deleteTelegramMessage,
  cancelLinkCode,
  syncBotCommands,
  DEFAULT_BOT_COMMANDS,
  migrateTelegramDataToUser,
  completeTelegramLink,
  fixStaleTelegramLinks
} from './lib/telegramBotCore.js';
import { scanReceiptWithGemini } from './lib/geminiReceiptScanner.js';
import { updateStreak } from './lib/streak.js';
import { buildMonthlyReport } from './lib/reportHelper.js';

import { formatAchievementItem } from './lib/achievementHelper.js';
import { getEmailTemplate } from './lib/emailTemplate.js';
import { sendVerificationMail, sendTestEmail, isSmtpConfigured } from './lib/mailer.js';

dotenv.config();
initFirebaseAdmin();

// Production safety: refuse to start in production without Firestore configured
if (process.env.NODE_ENV === 'production' && !getDb()) {
  console.error('FATAL: NODE_ENV=production but Firestore is not configured. Refusing to start in demo mode.');
  process.exit(1);
}
if (getDb()) {
  fixStaleTelegramLinks(getDb()).then((res) => {
    if (res?.fixedCount > 0) {
      console.log(`[migration] Fixed ${res.fixedCount} stale telegram links out of ${res.totalChecked} checked`);
    }
  }).catch((err) => {
    console.error('[migration] Error running fixStaleTelegramLinks:', err);
  });
}


const app = express();

// CORS: restrict to FRONTEND_ORIGIN in production, fallback to * for local dev
const corsOrigin = process.env.FRONTEND_ORIGIN || (process.env.NODE_ENV === 'production' ? undefined : '*');
app.use(cors(corsOrigin ? { origin: corsOrigin } : undefined));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('dev'));

const PORT = process.env.PORT || 4000;

const demoTransactionsByUser = new Map();
const demoGoalsByUser = new Map();

function getDemoTransactions(uid) {
  if (!demoTransactionsByUser.has(uid)) {
    demoTransactionsByUser.set(uid, [
      { id: 't1', category: 'Charity', type: 'Expense', amount: 2000000, date: '2025-11-22', description: 'Donation' }
    ]);
  }
  return demoTransactionsByUser.get(uid);
}

function getDemoGoals(uid) {
  if (!demoGoalsByUser.has(uid)) {
    demoGoalsByUser.set(uid, [
      { id: 'g1', name: 'Laptop', type: 'Saving', amount: 2340000, target: 15000000 }
    ]);
  }
  return demoGoalsByUser.get(uid);
}

const useFirestore = Boolean(getDb());

// In-memory rate limit — resets on serverless cold start; upgrade to Redis/KV when real abuse observed
const _rl = new Map();
function checkRateLimit(key, max = 5, windowMs = 15 * 60 * 1000) {
  const now = Date.now();
  const hits = (_rl.get(key) || []).filter(t => t > now - windowMs);
  _rl.set(key, hits);
  if (hits.length >= max) {
    const retryAfterSec = Math.ceil((hits[0] + windowMs - now) / 1000);
    return { allowed: false, retryAfterSec };
  }
  hits.push(now);
  return { allowed: true, retryAfterSec: 0 };
}
// Prune stale rate-limit entries every 10 minutes to prevent unbounded growth
setInterval(() => {
  const now = Date.now();
  const window = 15 * 60 * 1000;
  for (const [k, hits] of _rl) {
    const fresh = hits.filter(t => t > now - window);
    if (fresh.length === 0) _rl.delete(k); else _rl.set(k, fresh);
  }
}, 10 * 60 * 1000).unref();

// Middleware to verify Firebase token when admin is configured
const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!useFirestore) {
    req.user = { uid: token && token !== 'null' && token !== 'undefined' ? token : 'demo-user' };
    return next();
  }

  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    const adminAuth = (await import('firebase-admin')).default.auth();
    const decoded = await adminAuth.verifyIdToken(token);
    req.user = { uid: decoded.uid };
    next();
  } catch (err) {
    // tg_ fallback only allowed in demo/offline mode (useFirestore=false)
    res.status(401).json({ error: 'Invalid token' });
  }
};

app.get('/health', (_, res) => res.json({ ok: true, useFirestore }));

app.post('/api/scan-receipt', requireAuth, async (req, res) => {
  // Rate limit: 30 scans per 15 minutes per user
  const rl = checkRateLimit(`scan:${req.user.uid}`, 30);
  if (!rl.allowed) return res.status(429).json({ ok: false, error: `Pocky lagi istirahat sejenak. Tolong coba lagi dalam ${rl.retryAfterSec} detik ya! ⏳` });

  const { imageBase64, mimeType } = req.body || {};
  if (!imageBase64) {
    return res.status(400).json({ ok: false, error: 'Data gambar (imageBase64) wajib disertakan' });
  }
  try {
    const result = await scanReceiptWithGemini({
      imageBase64,
      mimeType: mimeType || 'image/jpeg'
    });
    if (result && result.notReceipt) {
      return res.status(422).json(result);
    }
    res.json(result);
  } catch (err) {
    console.error('Scan receipt error:', err);
    const msg = String(err?.message || '');
    if (/503|UNAVAILABLE|sibuk|high demand|antrean/i.test(msg)) {
      return res.status(503).json({
        ok: false,
        error: 'Pocky lagi ramai antreannya nih. Tolong coba lagi beberapa detik kembali yaa! ⏳'
      });
    }
    if (/timeout|abort/i.test(msg)) {
      return res.status(504).json({
        ok: false,
        error: 'Waktu baca struk habis karena koneksi lambat. Tolong coba lagi beberapa detik kembali yaa! ⏳'
      });
    }
    res.status(422).json({
      ok: false,
      error: 'Gambarnya agak burem atau kurang terbaca nih. Tolong kirimkan kembali foto struk atau bukti transfer yang lebih jelas, terang, dan tegak lurus yaa ✨'
    });
  }
});


// Telegram Webhook
app.post('/api/telegram-webhook', async (req, res) => {
  const webhookSecret = (process.env.TELEGRAM_WEBHOOK_SECRET || '').trim().replace(/^["']|["']$/g, '');
  if (!webhookSecret) {
    console.error('SECURITY: TELEGRAM_WEBHOOK_SECRET is not configured — rejecting webhook request');
    return res.status(403).json({ error: 'Webhook secret not configured' });
  }
  const incomingSecret = (req.headers['x-telegram-bot-api-secret-token'] || '').trim();
  if (incomingSecret !== webhookSecret) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN not configured' });

  try {
    await handleTelegramUpdate(req.body, getDb(), token);
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Telegram webhook processing error:', err);
    res.status(200).json({ ok: false, error: 'Internal error' });
  }
});

// Telegram Link endpoints
app.post('/api/telegram/link-code', requireAuth, async (req, res) => {
  const uid = req.user?.uid || 'demo-user';
  const botUsername = process.env.TELEGRAM_BOT_USERNAME || '';
  try {
    const result = await generateLinkCode(uid, getDb(), botUsername);
    res.json(result);
  } catch (err) {
    console.error('link-code error:', err);
    res.status(400).json({ error: err.message || 'Gagal membuat kode link.' });
  }
});

app.post('/api/telegram/complete-link', requireAuth, async (req, res) => {
  const uid = req.user?.uid || 'demo-user';
  try {
    const result = await completeTelegramLink(uid, getDb(), process.env.TELEGRAM_BOT_TOKEN);
    res.json(result);
  } catch (err) {
    console.error('complete-link error:', err);
    res.status(500).json({ error: 'Gagal menyelesaikan penghubungan akun.' });
  }
});

app.post('/api/telegram/cancel-link-code', requireAuth, async (req, res) => {
  const uid = req.user?.uid || 'demo-user';
  try {
    const result = await cancelLinkCode(uid, getDb());
    res.json(result);
  } catch (err) {
    console.error('cancel-link-code error:', err);
    res.status(500).json({ error: 'Gagal membatalkan kode link.' });
  }
});

app.all('/api/cron/reminders', async (req, res) => {
  const secret = (process.env.CRON_SECRET || process.env.TELEGRAM_WEBHOOK_SECRET || '').trim();
  if (!secret) {
    console.warn('[CRON] CRON_SECRET not configured on server');
    return res.status(401).json({ error: 'CRON_SECRET must be configured' });
  }
  const incoming = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '').trim() ||
    req.headers['x-admin-secret'] || req.query?.secret;
  if (!incoming || incoming !== secret) {
    console.warn('[CRON] Unauthorized cron attempt: header/query secret mismatch');
    return res.status(403).json({ error: 'Forbidden' });
  }
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN not configured' });

  // Resilient type detection: query parameter or current WIB hour (06:00 WIB morning vs 23:00 WIB evening)
  let type = req.query?.type;
  if (!type || (type !== 'morning' && type !== 'evening')) {
    const hourWib = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', hour: 'numeric', hour12: false }).format(new Date()));
    type = (hourWib >= 15 && hourWib <= 23) ? 'evening' : 'morning';
  }

  const force = req.query?.force === 'true' || req.query?.force === '1';
  const targetChatId = req.query?.chatId || null;

  try {
    const result = await dispatchDailyReminders(getDb(), token, type, force, targetChatId);
    cleanExpiredTempMessages(getDb(), token).catch((e) => console.error('Temp messages cleanup error:', e));
    if (type === 'morning') {
      const now = new Date();
      const dayOfWeek = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', weekday: 'short' }).format(now);
      if (dayOfWeek === 'Mon') {
        dispatchWeeklyRecap(getDb(), token).catch((e) => console.error('Weekly recap error:', e));
      }
    }
    res.json({ ok: true, type, ...result });
  } catch (err) {
    console.error('Cron reminders error:', err);
    res.status(500).json({ error: 'Internal cron error' });
  }
});

app.all('/api/admin/test-reminder', async (req, res) => {
  const secret = (process.env.ADMIN_SECRET || process.env.CRON_SECRET || process.env.TELEGRAM_WEBHOOK_SECRET || '').trim();
  if (!secret) {
    return res.status(401).json({ error: 'ADMIN_SECRET or CRON_SECRET must be configured' });
  }
  const incoming = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '').trim() ||
    req.headers['x-admin-secret'] || req.query?.secret || req.body?.secret;
  if (!incoming || incoming !== secret) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN not configured' });

  let type = req.query?.type || req.body?.type;
  if (!type || (type !== 'morning' && type !== 'evening')) {
    const hourWib = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', hour: 'numeric', hour12: false }).format(new Date()));
    type = (hourWib >= 15 && hourWib <= 23) ? 'evening' : 'morning';
  }
  const force = req.query?.force !== 'false' && req.body?.force !== false; // Default force=true for test
  const chatId = req.query?.chatId || req.body?.chatId || null;

  try {
    const result = await dispatchDailyReminders(getDb(), token, type, force, chatId);
    res.json({ ok: true, test: true, type, targetChatId: chatId || 'all', force, ...result });
  } catch (err) {
    console.error('test-reminder error:', err);
    res.status(500).json({ error: err.message || 'Failed to send test reminder' });
  }
});

app.post('/api/admin/sync-commands', async (req, res) => {
  const secret = (process.env.ADMIN_SECRET || process.env.CRON_SECRET || process.env.TELEGRAM_WEBHOOK_SECRET || '').trim();
  if (!secret) {
    return res.status(401).json({ error: 'ADMIN_SECRET or CRON_SECRET must be configured' });
  }
  const incoming = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '').trim() || req.query?.secret || req.body?.secret;
  if (!incoming || incoming !== secret) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN not configured' });
  try {
    const result = await syncBotCommands(token);
    res.json({ ok: true, commandsCount: DEFAULT_BOT_COMMANDS.length, result });
  } catch (err) {
    console.error('sync-commands error:', err);
    res.status(500).json({ error: err.message || 'Failed to sync commands' });
  }
});
app.post('/api/admin/fix-stale-links', async (req, res) => {
  const secret = (process.env.ADMIN_SECRET || process.env.CRON_SECRET || process.env.TELEGRAM_WEBHOOK_SECRET || '').trim();
  if (!secret) {
    return res.status(401).json({ error: 'ADMIN_SECRET or CRON_SECRET must be configured' });
  }
  const incoming = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '').trim() || req.query?.secret || req.body?.secret;
  if (!incoming || incoming !== secret) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    const result = await fixStaleTelegramLinks(getDb());
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('fix-stale-links error:', err);
    res.status(500).json({ error: err.message || 'Failed to fix stale links' });
  }
});

app.post('/api/admin/cleanup-stale-telegram', async (req, res) => {
  const secret = (process.env.ADMIN_SECRET || process.env.CRON_SECRET || process.env.TELEGRAM_WEBHOOK_SECRET || '').trim();
  if (!secret) {
    return res.status(401).json({ error: 'ADMIN_SECRET or CRON_SECRET must be configured' });
  }
  const incoming = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '').trim() || req.query?.secret || req.body?.secret;
  if (!incoming || incoming !== secret) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const db = getDb();
  if (!db) {
    return res.json({ ok: true, cleaned: 0, message: 'Demo mode — no stale data to clean' });
  }
  try {
    let cleaned = 0;

    // 1. Scan telegramUsers — delete if tg_{chatId} has unlinkedAt
    const tgUsersSnap = await db.collection('telegramUsers').get();
    for (const doc of (tgUsersSnap?.docs || [])) {
      const chatId = doc.id;
      const userDoc = await db.collection('users').doc(`tg_${chatId}`).get();
      const uData = (userDoc && userDoc.exists) ? (userDoc.data() || {}) : {};
      if (uData.unlinkedAt) {
        await doc.ref.delete();
        cleaned++;
      }
    }

    // 2. Scan telegram_links — delete if tg_{chatId} has unlinkedAt
    const linksSnap = await db.collection('telegram_links').get();
    for (const doc of (linksSnap?.docs || [])) {
      const chatId = doc.id;
      const userDoc = await db.collection('users').doc(`tg_${chatId}`).get();
      const uData = (userDoc && userDoc.exists) ? (userDoc.data() || {}) : {};
      if (uData.unlinkedAt) {
        await doc.ref.delete();
        cleaned++;
      }
    }

    res.json({ ok: true, cleaned });
  } catch (err) {
    console.error('cleanup-stale-telegram error:', err);
    res.status(500).json({ error: err.message || 'Failed to cleanup stale data' });
  }
});

app.get('/api/admin/cron-status', async (req, res) => {
  const cronSecretConfigured = Boolean((process.env.CRON_SECRET || '').trim());
  const telegramBotTokenConfigured = Boolean((process.env.TELEGRAM_BOT_TOKEN || '').trim());

  let totalLinkedUsers = 0;
  let usersWithReminderEnabled = 0;
  let lastMorningRun = null;
  let lastEveningRun = null;

  try {
    const db = getDb();
    if (db) {
      const linkSnap = await db.collection('telegram_links').get();
      totalLinkedUsers = linkSnap ? linkSnap.size : 0;

      let enabledCount = 0;
      if (linkSnap && !linkSnap.empty) {
        await Promise.all(
          linkSnap.docs.map(async (doc) => {
            const uid = doc.data()?.uid;
            if (!uid) return;
            const uSnap = await db.collection('users').doc(uid).get();
            const uData = uSnap.data() || {};
            if (uData.dailyReminderEnabled !== false) {
              enabledCount++;
            }
          })
        );
      }
      usersWithReminderEnabled = enabledCount;

      const metaSnap = await db.collection('system_meta').doc('cron_status').get();
      if (metaSnap && metaSnap.exists) {
        const mData = metaSnap.data() || {};
        lastMorningRun = mData.lastMorningRun || null;
        lastEveningRun = mData.lastEveningRun || null;
      }
    } else {
      totalLinkedUsers = 0;
      usersWithReminderEnabled = 0;
      lastMorningRun = demoCronStatus.lastMorningRun || null;
      lastEveningRun = demoCronStatus.lastEveningRun || null;
    }
  } catch (err) {
    console.error('cron-status error:', err);
  }

  res.json({
    cronSecretConfigured,
    telegramBotTokenConfigured,
    totalLinkedUsers,
    usersWithReminderEnabled,
    lastMorningRun,
    lastEveningRun
  });
});


app.get('/api/telegram/status', requireAuth, async (req, res) => {
  const uid = req.user?.uid || 'demo-user';
  try {
    const status = await getLinkStatus(uid, getDb());
    res.json({ ...status, botUsername: process.env.TELEGRAM_BOT_USERNAME || '' });
  } catch (err) {
    console.error('telegram status error:', err);
    res.status(500).json({ error: 'Gagal mengambil status.' });
  }
});

app.post('/api/telegram/unlink', requireAuth, async (req, res) => {
  const uid = req.user?.uid || 'demo-user';
  try {
    const result = await unlinkAccount(uid, getDb());
    res.json(result);
  } catch (err) {
    console.error('unlink error:', err);
    res.status(500).json({ error: 'Gagal memutus koneksi.' });
  }
});

app.post('/api/telegram/web-login', async (req, res) => {
  const rl = checkRateLimit(`wl:${req.ip}`);
  if (!rl.allowed) return res.status(429).json({ error: `Terlalu banyak percobaan. Coba lagi dalam ${rl.retryAfterSec} detik.` });
  const { code } = req.body || {};
  if (!code) return res.status(400).json({ error: 'Kode login diperlukan' });
  try {
    const result = await verifyWebLoginCode(code, getDb());
    if (!result) return res.status(404).json({ error: 'Kode login tidak ditemukan atau salah' });
    if (result === 'EXPIRED' || result?.status === 'EXPIRED') {
      const expiredChatId = result?.chatId;
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (botToken && expiredChatId) {
        sendTelegramMessage(
          botToken,
          expiredChatId,
          '⏳ *Kode login kadaluarsa*\n\nKode kamu sudah tidak berlaku. Ketik /web untuk buat kode baru.'
        ).catch(() => {});
      }
      return res.status(400).json({ error: 'Kode login telah kedaluwarsa' });
    }
    if (result?.needsVerification) {
      return res.status(403).json({
        ok: false,
        needsVerification: true,
        message: 'Akun Telegram ini sudah di-unlink. Silakan daftar dengan email dan verifikasi ulang di website.'
      });
    }
    let customToken = null;
    if (useFirestore) {
      const auth = getAdminAuth();
      if (auth) customToken = await auth.createCustomToken(result.uid);
    }

    // Clean up temporary bot message with the code
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const targetChatId = result.telegramChatId || (result.uid?.startsWith('tg_') ? result.uid.replace('tg_', '') : null);
    if (botToken && targetChatId && result.messageId) {
      deleteTelegramMessage(botToken, targetChatId, result.messageId).catch(() => {});
    }

    res.json({ ok: true, user: result, ...(customToken && { customToken }) });
  } catch (err) {
    console.error('web-login error:', err);
    res.status(500).json({ error: 'Gagal verifikasi kode login.' });
  }
});

// Email verification endpoints
app.get('/api/auth/email-preview', (req, res) => {
  const name = req.query.name || 'Sobat Pocketplan';
  const url = req.query.url || `${req.protocol}://${req.get('host')}/verification?mode=verifyEmail&oobCode=preview-demo-code-123`;
  const { html } = getEmailTemplate({ name, verificationUrl: url });
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

app.post('/api/auth/send-test-email', async (req, res) => {
  const email = req.body?.email;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Parameter email tujuan diperlukan.' });
  }
  try {
    const result = await sendTestEmail(email);
    res.json({ ok: true, message: `Email uji coba dikirim ke ${email}`, ...result });
  } catch (err) {
    console.error('send-test-email error:', err);
    res.status(500).json({ error: err?.message || 'Gagal mengirim email uji coba.' });
  }
});

app.post('/api/auth/send-verification-email', async (req, res) => {
  const { email, name, verificationUrl } = req.body || {};
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Email tujuan valid diperlukan.' });
  }
  if (!isSmtpConfigured()) {
    return res.status(503).json({
      error: 'SMTP belum dikonfigurasi di backend (.env).',
      smtpConfigured: false
    });
  }
  try {
    let targetUrl = verificationUrl;
    if (!targetUrl) {
      const auth = getAdminAuth();
      if (auth) {
        const clientOrigin = process.env.FRONTEND_ORIGIN || `${req.protocol}://${req.get('host')}`;
        targetUrl = await auth.generateEmailVerificationLink(email, {
          url: `${clientOrigin}/verification?from=custom_email`,
          handleCodeInApp: true
        });
      } else {
        const clientOrigin = process.env.FRONTEND_ORIGIN || `${req.protocol}://${req.get('host')}`;
        targetUrl = `${clientOrigin}/verification?mode=verifyEmail&oobCode=demo-code-${Date.now()}&email=${encodeURIComponent(email)}`;
      }
    }
    const result = await sendVerificationMail({ to: email, name, verificationUrl: targetUrl });
    res.json({ ok: true, message: `Email verifikasi berhasil dikirim ke ${email}`, ...result });
  } catch (err) {
    console.error('send-verification-email error:', err);
    res.status(500).json({ error: err?.message || 'Gagal mengirim email verifikasi.' });
  }
});

app.get('/api/transactions', requireAuth, async (req, res) => {
  const uid = req.user.uid;
  if (!useFirestore) return res.json(getDemoTransactions(uid));
  try {
    const db = getDb();
    const snapshot = await db.collection('users').doc(uid).collection('transactions').get();
    const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json(items);
  } catch (err) {
    console.error('GET /api/transactions error:', err);
    res.status(500).json({ error: 'Gagal mengambil transaksi.' });
  }
});

app.post('/api/transactions', requireAuth, async (req, res) => {
  const uid = req.user.uid;
  const b = req.body || {};

  // Whitelist + validate fields
  const type = b.type;
  if (type !== 'Income' && type !== 'Expense') return res.status(400).json({ error: 'type harus "Income" atau "Expense"' });
  const amount = Number(b.amount);
  if (!amount || amount <= 0) return res.status(400).json({ error: 'amount harus angka > 0' });
  const category = String(b.category || 'Other');
  const description = String(b.description || '');
  const date = String(b.date || new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date()));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'date harus format YYYY-MM-DD' });

  const payload = { type, amount, category, description, date, createdAt: new Date().toISOString() };
  if (b.paymentMethod) payload.paymentMethod = String(b.paymentMethod);
  if (b.goalBackup && typeof b.goalBackup === 'object') payload.goalBackup = b.goalBackup;

  if (!useFirestore) {
    const list = getDemoTransactions(uid);
    list.unshift({ ...payload, id: `t-${Date.now()}` });
    return res.status(201).json({ ok: true });
  }
  try {
    const db = getDb();
    const docRef = await db.collection('users').doc(uid).collection('transactions').add(payload);
    // Update streak for web transactions too
    updateStreak(uid, db).catch(e => console.error('web streak error:', e));
    res.status(201).json({ id: docRef.id });
  } catch (err) {
    console.error('POST /api/transactions error:', err);
    res.status(500).json({ error: 'Gagal menyimpan transaksi.' });
  }
});

app.delete('/api/transactions/:id', requireAuth, async (req, res) => {
  const uid = req.user.uid;
  const id = req.params.id;
  if (!useFirestore) {
    const list = getDemoTransactions(uid);
    const idx = list.findIndex((t) => t.id === id);
    if (idx < 0) return res.status(404).json({ error: 'Transaksi tidak ditemukan' });
    list.splice(idx, 1);
    return res.json({ ok: true });
  }
  try {
    const db = getDb();
    const docRef = db.collection('users').doc(uid).collection('transactions').doc(id);
    const snap = await docRef.get();
    if (!snap.exists) return res.status(404).json({ error: 'Transaksi tidak ditemukan' });
    await docRef.delete();
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/transactions error:', err);
    res.status(500).json({ error: 'Gagal menghapus transaksi.' });
  }
});

app.get('/api/goals', requireAuth, async (req, res) => {
  const uid = req.user.uid;
  if (!useFirestore) return res.json(getDemoGoals(uid));
  try {
    const db = getDb();
    const snapshot = await db.collection('users').doc(uid).collection('goals').get();
    const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json(items);
  } catch (err) {
    console.error('GET /api/goals error:', err);
    res.status(500).json({ error: 'Gagal mengambil target.' });
  }
});

app.post('/api/goals', requireAuth, async (req, res) => {
  const uid = req.user.uid;
  const b = req.body || {};

  // Whitelist + validate fields
  const name = String(b.name || '').trim();
  if (!name) return res.status(400).json({ error: 'name wajib diisi' });
  const target = Number(b.target);
  if (!target || target <= 0) return res.status(400).json({ error: 'target harus angka > 0' });
  const type = String(b.type || 'Saving');
  const amount = Number(b.amount) || 0;

  const payload = { name, target, type, amount, createdAt: new Date().toISOString() };

  if (!useFirestore) {
    const list = getDemoGoals(uid);
    list.push({ ...payload, id: `g-${Date.now()}` });
    return res.status(201).json({ ok: true });
  }
  try {
    const db = getDb();
    const docRef = await db.collection('users').doc(uid).collection('goals').add(payload);
    res.status(201).json({ id: docRef.id });
  } catch (err) {
    console.error('POST /api/goals error:', err);
    res.status(500).json({ error: 'Gagal menyimpan target.' });
  }
});

app.delete('/api/goals/:id', requireAuth, async (req, res) => {
  const uid = req.user.uid;
  const id = req.params.id;
  if (!useFirestore) {
    const list = getDemoGoals(uid);
    const idx = list.findIndex((g) => g.id === id);
    if (idx < 0) return res.status(404).json({ error: 'Target tidak ditemukan' });
    list.splice(idx, 1);
    return res.json({ ok: true });
  }
  try {
    const db = getDb();
    const docRef = db.collection('users').doc(uid).collection('goals').doc(id);
    const snap = await docRef.get();
    if (!snap.exists) return res.status(404).json({ error: 'Target tidak ditemukan' });
    await docRef.delete();
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/goals error:', err);
    res.status(500).json({ error: 'Gagal menghapus target.' });
  }
});

app.get('/api/report', requireAuth, async (req, res) => {
  const uid = req.user.uid;
  const month = req.query.month;
  if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return res.status(400).json({ error: 'Format bulan tidak valid. Gunakan format YYYY-MM' });
  }

  if (!useFirestore) {
    const transactions = getDemoTransactions(uid);
    const goals = getDemoGoals(uid);
    const rep = buildMonthlyReport({ month, transactions, goals, budgets: [], userDocData: { currentStreak: 3 } });
    return res.json(rep);
  }

  try {
    const db = getDb();
    const userRef = db.collection('users').doc(uid);
    const [userDoc, txSnap, goalsSnap, budgetsSnap] = await Promise.all([
      userRef.get(),
      userRef.collection('transactions').get(),
      userRef.collection('goals').get(),
      userRef.collection('budgets').get()
    ]);

    const userData = userDoc.exists ? userDoc.data() : {};
    let goalsDocs = [...goalsSnap.docs];
    let txDocs = [...txSnap.docs];
    let budgetDocs = [...budgetsSnap.docs];

    if (userData.telegramChatId) {
      const tgUid = `tg_${userData.telegramChatId}`;
      const [tgGoalsSnap, tgTxSnap, tgBudgetSnap] = await Promise.all([
        db.collection('users').doc(tgUid).collection('goals').get(),
        db.collection('users').doc(tgUid).collection('transactions').get(),
        db.collection('users').doc(tgUid).collection('budgets').get()
      ]);
      if (!tgGoalsSnap.empty) {
        goalsDocs.push(...tgGoalsSnap.docs);
        migrateTelegramDataToUser(userData.telegramChatId, uid, db).catch(() => {});
      }
      if (!tgTxSnap.empty) {
        txDocs.push(...tgTxSnap.docs);
      }
      if (!tgBudgetSnap.empty) {
        budgetDocs.push(...tgBudgetSnap.docs);
      }
    }

    const transactions = txDocs.map((d) => ({ id: d.id, ...d.data() }));
    const goals = goalsDocs.map((d) => ({ id: d.id, ...d.data() }));
    const budgets = budgetDocs.map((d) => ({ id: d.id, ...d.data() }));

    const rep = buildMonthlyReport({
      month,
      transactions,
      goals,
      budgets,
      userDocData: userData
    });
    res.json(rep);
  } catch (err) {
    console.error('GET /api/report error:', err);
    res.status(500).json({ error: 'Gagal memuat laporan bulanan.' });
  }
});

app.get('/api/achievements', requireAuth, async (req, res) => {
  const uid = req.user.uid;
  if (!useFirestore) {
    const goalsList = getDemoGoals(uid);
    const goalsMap = new Map(goalsList.map((g) => [g.id, g.name]));
    const seen = ['streak_3', 'streak_7', 'goal_g1_50'];
    const seenAt = { streak_3: '2026-10-01T00:00:00.000Z', streak_7: '2026-10-07T00:00:00.000Z' };
    const items = seen.map((k) => formatAchievementItem(k, seenAt, goalsMap));
    return res.json(items);
  }

  try {
    const db = getDb();
    const userRef = db.collection('users').doc(uid);
    const [userDoc, goalsSnap] = await Promise.all([
      userRef.get(),
      userRef.collection('goals').get()
    ]);

    const userData = userDoc.exists ? userDoc.data() : {};
    let seen = Array.isArray(userData.achievementsSeen) ? [...userData.achievementsSeen] : [];
    let seenAt = { ...(userData.achievementsSeenAt || {}) };

    if (userData.telegramChatId) {
      const tgDoc = await db.collection('users').doc(`tg_${userData.telegramChatId}`).get();
      if (tgDoc.exists) {
        const tgData = tgDoc.data() || {};
        const tgSeen = Array.isArray(tgData.achievementsSeen) ? tgData.achievementsSeen : [];
        const tgSeenAt = tgData.achievementsSeenAt || {};
        tgSeen.forEach((k) => {
          if (!seen.includes(k)) seen.push(k);
          if (!seenAt[k] && tgSeenAt[k]) seenAt[k] = tgSeenAt[k];
        });
      }
    }

    const goalsMap = new Map();
    goalsSnap.forEach((d) => {
      goalsMap.set(d.id, d.data()?.name || 'Target');
    });

    const items = seen.map((k) => formatAchievementItem(k, seenAt, goalsMap));
    res.json(items);
  } catch (err) {
    console.error('GET /api/achievements error:', err);
    res.status(500).json({ error: 'Gagal memuat pencapaian.' });
  }
});



// Custom error handler: prevent stack trace leaks in production
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : (err.message || 'Internal server error')
  });
});

// Export for Vercel serverless. When running locally (npm run dev/start), still listen on PORT.
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Pocketplan API running on http://localhost:${PORT}`);
  });

  // Sync bot commands on startup
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (botToken) {
    syncBotCommands(botToken).catch((e) => console.error('syncBotCommands error:', e));
  }
}

export { requireAuth };
export default app;
