import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { initFirebaseAdmin, getDb } from './lib/firebaseAdmin.js';
import {
  handleTelegramUpdate,
  generateLinkCode,
  getLinkStatus,
  unlinkAccount
} from './lib/telegramBot.js';
import { verifyWebLoginCode } from './lib/telegramBotCore.js';

dotenv.config();
initFirebaseAdmin();

const app = express();
app.use(cors());
app.use(express.json());
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

// ponytail: in-memory rate limit resets on serverless cold start; upgrade to Redis/KV when real abuse observed
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

// Middleware to verify Firebase token when admin is configured
const requireAuth = async (req, res, next) => {
  if (!useFirestore) {
    req.user = { uid: 'demo-user' };
    return next();
  }
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    const decoded = await import('firebase-admin').then(({ auth }) => auth().verifyIdToken(token));
    req.user = { uid: decoded.uid };
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

app.get('/health', (_, res) => res.json({ ok: true, useFirestore }));

// Telegram Webhook
app.post('/api/telegram-webhook', async (req, res) => {
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (webhookSecret && req.headers['x-telegram-bot-api-secret-token'] !== webhookSecret) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN not configured' });
  try {
    await handleTelegramUpdate(req.body, getDb(), token);
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Telegram webhook error:', err);
    res.status(200).json({ ok: false, error: err.message });
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
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/telegram/status', requireAuth, async (req, res) => {
  const uid = req.user?.uid || 'demo-user';
  try {
    const status = await getLinkStatus(uid, getDb());
    res.json({ ...status, botUsername: process.env.TELEGRAM_BOT_USERNAME || '' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/telegram/unlink', requireAuth, async (req, res) => {
  const uid = req.user?.uid || 'demo-user';
  try {
    const result = await unlinkAccount(uid, getDb());
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    if (result === 'EXPIRED') return res.status(400).json({ error: 'Kode login telah kedaluwarsa' });
    res.json({ ok: true, user: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/transactions', requireAuth, async (req, res) => {
  const uid = req.user.uid;
  const payload = req.body;
  if (!useFirestore) {
    const list = getDemoTransactions(uid);
    list.unshift({ ...payload, id: `t-${Date.now()}` });
    return res.status(201).json({ ok: true });
  }
  try {
    const db = getDb();
    const docRef = await db.collection('users').doc(uid).collection('transactions').add(payload);
    res.status(201).json({ id: docRef.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/transactions/:id', requireAuth, async (req, res) => {
  const uid = req.user.uid;
  const id = req.params.id;
  if (!useFirestore) {
    const list = getDemoTransactions(uid);
    const idx = list.findIndex((t) => t.id === id);
    if (idx >= 0) list.splice(idx, 1);
    return res.json({ ok: true });
  }
  try {
    const db = getDb();
    await db.collection('users').doc(uid).collection('transactions').doc(id).delete();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/goals', requireAuth, async (req, res) => {
  const uid = req.user.uid;
  const payload = req.body;
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
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/goals/:id', requireAuth, async (req, res) => {
  const uid = req.user.uid;
  const id = req.params.id;
  if (!useFirestore) {
    const list = getDemoGoals(uid);
    const idx = list.findIndex((g) => g.id === id);
    if (idx >= 0) list.splice(idx, 1);
    return res.json({ ok: true });
  }
  try {
    const db = getDb();
    await db.collection('users').doc(uid).collection('goals').doc(id).delete();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export for Vercel serverless. When running locally (npm run dev/start), still listen on PORT.
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`PocketPlan API running on http://localhost:${PORT}`);
  });
}

export default app;
