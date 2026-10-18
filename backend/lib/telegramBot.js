import { parseTransactionCommand, parseAmount, formatRupiah, normalizeBudgetCategory, guessBudgetCategory, CATEGORY_LABELS, CATEGORY_ICONS } from './telegramParser.js';
import {
  sendTelegramMessage,
  answerTelegramCallback,
  editTelegramMessage,
  generateLinkCode,
  getLinkStatus,
  unlinkAccount,
  findLinkedUid,
  linkChatWithCode,
  ensureTelegramUser,
  generateWebLoginCode,
  migrateTelegramDataToUser,
  attachMessageToWebCode,
  deleteTelegramMessage,
  cancelWebLoginCode,
  completeTelegramLink,
  demoUnlinkedUsers
} from './telegramBotCore.js';
import { scanReceiptWithGemini } from './geminiReceiptScanner.js';
import { updateStreak } from './streak.js';

export const demoCronStatus = {
  lastMorningRun: null,
  lastEveningRun: null
};

export { generateLinkCode, getLinkStatus, unlinkAccount, sendTelegramPhoto, completeTelegramLink, sendWebAccess };

const KEYBOARD = {
  keyboard: [
    [{ text: '💸 Catat Keluar' }, { text: '💰 Catat Masuk' }],
    [{ text: '📊 Cek Saldo' }, { text: '🎯 Target Impian' }],
    [{ text: '📜 Riwayat' }, { text: '🔥 Cek Streak' }],
    [{ text: '🌐 Buka di Web' }]
  ],
  resize_keyboard: true
};

// Pending budget creation state per chatId (step-by-step via buttons)
const pendingBudget = new Map();
// Pending riwayat search per chatId
const pendingSearch = new Map();
// Last search message per chatId for auto-delete
const lastSearchMsgMap = new Map();
const PENDING_TIMEOUT_MS = 5 * 60 * 1000;

function setPendingBudget(chatId, data) {
  pendingBudget.set(String(chatId), { ...data, ts: Date.now() });
}
function getPendingBudget(chatId) {
  const p = pendingBudget.get(String(chatId));
  if (!p) return null;
  if (Date.now() - p.ts > PENDING_TIMEOUT_MS) { pendingBudget.delete(String(chatId)); return null; }
  return p;
}
function clearPendingBudget(chatId) { pendingBudget.delete(String(chatId)); }

// Pending goal creation state per chatId (step-by-step via buttons)
const pendingGoal = new Map();

function setPendingGoal(chatId, data) {
  pendingGoal.set(String(chatId), { ...data, ts: Date.now() });
}
function getPendingGoal(chatId) {
  const p = pendingGoal.get(String(chatId));
  if (!p) return null;
  if (Date.now() - p.ts > PENDING_TIMEOUT_MS) { pendingGoal.delete(String(chatId)); return null; }
  return p;
}
function clearPendingGoal(chatId) { pendingGoal.delete(String(chatId)); }

function setPendingSearch(chatId, promptMsgId = null) {
  pendingSearch.set(String(chatId), { ts: Date.now(), promptMsgId });
}
function getPendingSearch(chatId) {
  const p = pendingSearch.get(String(chatId));
  if (!p) return null;
  if (Date.now() - p.ts > PENDING_TIMEOUT_MS) { pendingSearch.delete(String(chatId)); return null; }
  return p;
}
function clearPendingSearch(chatId) { pendingSearch.delete(String(chatId)); }

export async function queueTempMessage(db, chatId, messageId, ttlSeconds = 10) {
  if (!db || !chatId || !messageId) return;
  try {
    const deleteAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    await db.collection('temp_messages').add({
      chatId: String(chatId),
      messageId,
      deleteAt,
      createdAt: new Date().toISOString()
    });
  } catch (e) {
    console.error('queueTempMessage error:', e?.message);
  }
}

export async function cleanExpiredTempMessages(db, botToken) {
  if (!db || !botToken) return 0;
  try {
    const nowIso = new Date().toISOString();
    const snap = await db.collection('temp_messages').get();
    let cleaned = 0;
    for (const doc of snap.docs) {
      const d = doc.data();
      if (d.deleteAt && d.deleteAt <= nowIso) {
        if (d.chatId && d.messageId) {
          await deleteTelegramMessage(botToken, d.chatId, d.messageId).catch(() => {});
        }
        await doc.ref.delete().catch(() => {});
        cleaned++;
      }
    }
    return cleaned;
  } catch (e) {
    console.error('cleanExpiredTempMessages error:', e?.message);
    return 0;
  }
}

function renderBar(cur, tgt) {
  const p = Math.max(0, Math.min(100, Math.round((cur / (tgt || 1)) * 100)));
  const f = Math.round(p / 10);
  return `\`[${'█'.repeat(f)}${'░'.repeat(10 - f)}]\` ${p}%`;
}

function formatShortDate(dStr) {
  if (!dStr) return '';
  const parts = dStr.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}` : dStr;
}

const INDO_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function formatIndoDate(dStr) {
  if (!dStr) return '';
  const [y, m, d] = dStr.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return dStr;
  return `${d} ${INDO_MONTHS[m - 1]} ${y}`;
}

function getJakartaDateStr(d) {
  if (!d) return '';
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.trim())) {
    return d.trim();
  }
  const dateObj = typeof d === 'string' ? new Date(d) : d;
  if (!dateObj || isNaN(dateObj?.getTime?.() ?? NaN)) return String(d).slice(0, 10);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(dateObj);
}

function getBudgetPeriod(createdAt, monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const endStr = `${monthKey}-${String(lastDay).padStart(2, '0')}`;
  const cDate = getJakartaDateStr(createdAt);
  const startStr = (cDate && cDate.slice(0, 7) === monthKey && cDate > `${monthKey}-01`) ? cDate : `${monthKey}-01`;
  return { startStr, endStr, display: `${formatIndoDate(startStr)} — ${formatIndoDate(endStr)}`, createdDate: cDate || startStr };
}

function escapeMarkdown(text) {
  if (!text) return '';
  return String(text).replace(/([*_`\[\]])/g, '\\$1');
}

const STREAK_MILESTONE_MESSAGES = {
  3: 'Pocky mulai hafal kebiasaanmu nih 👀 (3 hari beruntun!)',
  7: 'SEVEN STREAK! Pocky kasih mahkota 👑',
  14: '2 MINGGU! Konsistensimu bikin Pocky bangga 🌟',
  30: 'LEGEND! Sebulan penuh disiplin 🔥',
  60: 'DUA BULAN nonstop! Kamu luar biasa 💎',
  100: 'TRIPLE DIGIT STREAK! 100 hari — Pocky speechless 🏆🏆🏆'
};

async function handleStreakAfterTransaction(chatId, uid, db, botToken) {
  if (!db || !uid) return;
  try {
    const result = await updateStreak(uid, db);
    if (result.broken) {
      await sendTelegramMessage(botToken, chatId,
        '🥺 Pocky kangen kemarin... yuk mulai streak baru hari ini! 💪'
      );
    }
    if (result.milestone && STREAK_MILESTONE_MESSAGES[result.milestone]) {
      await sendTelegramMessage(botToken, chatId,
        `🔥 *Streak ${result.milestone} Hari!*\n\n${STREAK_MILESTONE_MESSAGES[result.milestone]}`
      );
    }
    // Check achievement for streak milestones (Fase 4)
    if (result.milestone && [7, 14, 30, 60].includes(result.milestone)) {
      await checkAndOfferAchievement(chatId, uid, db, botToken, `streak_${result.milestone}`,
        `🔥 Streak ${result.milestone} Hari!`, `${result.milestone} hari berturut-turut catat keuangan`, result.milestone);
    }
    // Check goal achievement progress (Fase 4)
    await checkGoalAchievements(chatId, uid, db, botToken);
  } catch (err) {
    console.error('streak error:', err?.message);
  }
}






async function sendTelegramPhoto(botToken, chatId, pngBuffer, caption, options = {}) {
  if (!botToken || !chatId) return null;
  try {
    const form = new FormData();
    form.append('chat_id', String(chatId));
    form.append('photo', new Blob([pngBuffer], { type: 'image/png' }), 'achievement.png');
    if (caption) form.append('caption', caption);
    if (options.parse_mode) form.append('parse_mode', options.parse_mode);
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
      method: 'POST',
      body: form
    });
    return await res.json();
  } catch (err) {
    console.error('sendTelegramPhoto error:', err?.message);
    return null;
  }
}

async function checkAndOfferAchievement(chatId, uid, db, botToken, achievementKey, title, subtitle, streakDays) {
  if (!db || !uid) return;
  try {
    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();
    const seen = (userDoc.data() || {}).achievementsSeen || [];
    if (seen.includes(achievementKey)) return;
    seen.push(achievementKey);
    const seenAt = (userDoc.data() || {}).achievementsSeenAt || {};
    seenAt[achievementKey] = new Date().toISOString();
    await userRef.set({ achievementsSeen: seen, achievementsSeenAt: seenAt }, { merge: true });
    await sendTelegramMessage(botToken, chatId,
      `🏅 *Achievement Unlocked!*\n\n${title}\n_${subtitle}_`
    );
  } catch (err) {
    console.error('checkAndOfferAchievement error:', err?.message);
  }
}

async function checkGoalAchievements(chatId, uid, db, botToken) {
  if (!db || !uid) return;
  try {
    const userRef = db.collection('users').doc(uid);
    const [userDoc, gSnap] = await Promise.all([userRef.get(), userRef.collection('goals').get()]);
    const userData = userDoc.data() || {};
    const seen = userData.achievementsSeen || [];
    const seenAt = userData.achievementsSeenAt || {};
    const { bal } = await getBalance(uid, db);

    for (const gDoc of gSnap.docs) {
      const g = gDoc.data();
      const tgt = Number(g.target) || 0;
      if (tgt <= 0) continue;
      const pct = Math.min(100, Math.round((Math.max(0, bal) / tgt) * 100));
      for (const milestone of [25, 50, 75, 100]) {
        if (pct >= milestone) {
          const key = `goal_${gDoc.id}_${milestone}`;
          if (!seen.includes(key)) {
            seen.push(key);
            seenAt[key] = new Date().toISOString();
            await userRef.set({ achievementsSeen: seen, achievementsSeenAt: seenAt }, { merge: true });
            const safeName = g.name || 'Target';
            await sendTelegramMessage(botToken, chatId,
              `🏅 *Achievement Unlocked!*\n\n🎯 ${escapeMarkdown(safeName)} — ${milestone}%\n_Progres target tabunganmu!_`
            );
          }
        }
      }
    }
  } catch (err) {
    console.error('checkGoalAchievements error:', err?.message);
  }
}
async function getBalance(uid, db) {
  let inc = 0, exp = 0, base = 0;
  if (db && uid) {
    const userRef = db.collection('users').doc(uid);
    const [uDoc, snap] = await Promise.all([
      userRef.get(),
      userRef.collection('transactions').get()
    ]);
    base = Number(uDoc.data()?.baseBalance || 0);
    snap.forEach((d) => {
      const t = d.data();
      const a = Number(t.amount) || 0;
      if (t.type === 'Income') inc += a;
      else exp += a;
    });
  }
  return { bal: base + inc - exp, inc, exp };
}

// In-memory rate limit for link-code brute force per chatId.
// Resets on serverless cold start; acceptable because codes expire in 15min anyway.
const _linkFails = new Map();
function checkLinkRateLimit(chatId) {
  const key = String(chatId);
  const now = Date.now();
  const window = 15 * 60 * 1000;
  const hits = (_linkFails.get(key) || []).filter(t => t > now - window);
  _linkFails.set(key, hits);
  if (hits.length >= 10) return false;
  return true;
}
function recordLinkFail(chatId) {
  const key = String(chatId);
  const hits = _linkFails.get(key) || [];
  hits.push(Date.now());
  _linkFails.set(key, hits);
}
// Prune stale link-fail entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  const window = 15 * 60 * 1000;
  for (const [k, hits] of _linkFails) {
    const fresh = hits.filter(t => t > now - window);
    if (fresh.length === 0) _linkFails.delete(k); else _linkFails.set(k, fresh);
  }
}, 10 * 60 * 1000).unref();

// In-memory rate limit for photo scan (Gemini API cost protection)
const _scanHits = new Map();
function checkScanRateLimit(chatId) {
  const key = String(chatId);
  const now = Date.now();
  const window = 60 * 60 * 1000; // 1 hour
  const hits = (_scanHits.get(key) || []).filter(t => t > now - window);
  if (hits.length >= 25) { _scanHits.set(key, hits); return false; }
  hits.push(now);
  _scanHits.set(key, hits);
  return true;
}
setInterval(() => {
  const now = Date.now();
  const window = 60 * 60 * 1000;
  for (const [k, hits] of _scanHits) {
    const fresh = hits.filter(t => t > now - window);
    if (fresh.length === 0) _scanHits.delete(k); else _scanHits.set(k, fresh);
  }
}, 10 * 60 * 1000).unref();

// Link nudge: offer account linking once at 20th transaction for unlinked users
async function maybeSendLinkNudge(chatId, uid, db, botToken) {
  if (!db || !uid || !uid.startsWith('tg_')) return; // already linked to web account
  try {
    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();
    if (userDoc.data()?.linkNudgeSent) return;
    const txSnap = await userRef.collection('transactions').count().get();
    const txCount = txSnap.data().count;
    if (txCount !== 20) return;
    await userRef.set({ linkNudgeSent: true }, { merge: true });
    await sendTelegramMessage(botToken, chatId,
      'Pocky lihat kamu sudah catat 20 transaksi! Keren banget 🎉\n\n' +
      'Biar datamu aman kalau ganti HP, tautkan ke Pocketplan web yuk — ' +
      'tinggal ketik /link dengan kode dari menu *Profile* di web.'
    );
  } catch (err) {
    console.error('linkNudge error:', err?.message);
  }
}

function getTxMonth(t) {
  if (!t) return '';
  const rawDate = t.date || t.tanggal;
  if (rawDate && typeof rawDate.toDate === 'function') {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(rawDate.toDate()).slice(0, 7);
  }
  if (typeof rawDate === 'number' && !isNaN(rawDate)) {
    const d = new Date(rawDate);
    if (!isNaN(d.getTime())) return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(d).slice(0, 7);
  }
  if (typeof rawDate === 'string' && rawDate.trim()) {
    const s = rawDate.trim();
    if (/^\d{4}[-/]\d{2}/.test(s)) return s.slice(0, 7).replace('/', '-');
    const dmy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}`;
    const d = new Date(s);
    if (!isNaN(d.getTime())) return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(d).slice(0, 7);
  }
  const rawCreated = t.createdAt || t.timestamp;
  if (rawCreated) {
    if (typeof rawCreated.toDate === 'function') {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(rawCreated.toDate()).slice(0, 7);
    }
    if (typeof rawCreated === 'number' && !isNaN(rawCreated)) {
      const d = new Date(rawCreated);
      if (!isNaN(d.getTime())) return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(d).slice(0, 7);
    }
    const d = new Date(rawCreated);
    if (!isNaN(d.getTime())) return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(d).slice(0, 7);
  }
  return '';
}

// Budget warning: check if expense matches any custom budget by keyword
async function checkBudgetWarnings(chatId, uid, db, botToken, category, description) {
  if (!db || !uid) return null;
  try {
    const budgetDocs = [];
    const budgetSnap = await db.collection('users').doc(uid).collection('budgets').get();
    budgetDocs.push(...budgetSnap.docs);
    if (uid !== `tg_${chatId}`) {
      const altSnap = await db.collection('users').doc(`tg_${chatId}`).collection('budgets').get();
      if (!altSnap.empty) {
        migrateTelegramDataToUser(chatId, uid, db).catch(() => {});
        budgetDocs.push(...altSnap.docs);
      }
    }
    if (budgetDocs.length === 0) return null;

    // Match expense to budgets by keyword
    const expenseText = `${description || ''} ${category || ''}`.toLowerCase();
    const matchedBudgets = budgetDocs.filter(d => {
      const b = d.data();
      const keywords = b.keywords || [];
      // Also match by customLabel words as fallback
      const label = (b.customLabel || b.rawCategory || b.category || '').toLowerCase();
      const labelWords = label.split(/\s+/).filter(w => w.length >= 2);
      const allKeywords = [...keywords.map(k => k.toLowerCase()), ...labelWords];
      return allKeywords.some(kw => expenseText.includes(kw));
    });

    if (matchedBudgets.length === 0) return null;

    const now = new Date();
    const nowJakarta = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(now);
    const monthKey = nowJakarta.slice(0, 7);

    // Fetch user transactions
    const seenTx = new Set();
    const txDocs = [];
    const txSnap = await db.collection('users').doc(uid).collection('transactions').get();
    txSnap.docs.forEach(d => { seenTx.add(d.id); txDocs.push(d); });
    if (uid !== `tg_${chatId}`) {
      const altTxSnap = await db.collection('users').doc(`tg_${chatId}`).collection('transactions').get();
      altTxSnap.docs.forEach(d => {
        if (!seenTx.has(d.id)) { seenTx.add(d.id); txDocs.push(d); }
      });
    }

    let firstMatch = null;
    for (const bDoc of matchedBudgets) {
      const budget = bDoc.data();
      const limit = Number(budget.monthlyLimit || budget.amount) || 0;
      if (limit <= 0) continue;
      const bKeywords = (budget.keywords || []).map(k => k.toLowerCase());
      const bLabel = (budget.customLabel || budget.rawCategory || budget.category || '').toLowerCase();
      const bLabelWords = bLabel.split(/\s+/).filter(w => w.length >= 2);
      const allKw = [...bKeywords, ...bLabelWords];

      const bPeriod = getBudgetPeriod(budget.createdAt, monthKey);
      let total = 0;
      txDocs.forEach(d => {
        const t = d.data();
        const isExpense = (t.type || '').toLowerCase() === 'expense';
        const txDate = (t.date || t.createdAt || '').slice(0, 10);
        if (isExpense && getTxMonth(t) === monthKey && txDate >= bPeriod.startStr) {
          const txText = `${t.description || ''} ${t.category || ''}`.toLowerCase();
          if (allKw.some(kw => txText.includes(kw))) {
            total += Number(t.amount) || 0;
          }
        }
      });

      const pct = Math.round((total / limit) * 100);
      const warn80Key = `warn80_${monthKey}`;
      const warn100Key = `warn100_${monthKey}`;
      const catLabel = budget.customLabel || budget.rawCategory || budget.category || 'Budget';

      if (pct >= 100 && !budget[warn100Key]) {
        await bDoc.ref.set({ [warn100Key]: true, [warn80Key]: true }, { merge: true });
        await sendTelegramMessage(botToken, chatId,
          `🚨 *Budget ${escapeMarkdown(catLabel)} habis!*\n\n` +
          `Bulan ini kamu sudah keluar *${formatRupiah(total)}* dari batas *${formatRupiah(limit)}* (${pct}%).\n` +
          `Yuk tahan dulu pengeluaran ${escapeMarkdown(catLabel)} ya! 💪`
        );
      } else if (pct >= 80 && !budget[warn80Key]) {
        await bDoc.ref.set({ [warn80Key]: true }, { merge: true });
        await sendTelegramMessage(botToken, chatId,
          `⚠️ *Budget ${escapeMarkdown(catLabel)} hampir habis!*\n\n` +
          `Sudah terpakai *${formatRupiah(total)}* dari *${formatRupiah(limit)}* (${pct}%).\n` +
          `Sisa budget: *${formatRupiah(Math.max(0, limit - total))}* — hati-hati ya!`
        );
      }

      if (!firstMatch) {
        firstMatch = { category: catLabel, label: catLabel, total, limit, pct };
      }
    }

    return firstMatch;
  } catch (err) {
    console.error('budgetWarning error:', err?.message);
    return null;
  }
}

const _processedUpdates = new Map();
const UPDATE_EXPIRY_MS = 10 * 60 * 1000;

function isDuplicateUpdate(updateId) {
  if (!updateId) return false;
  const now = Date.now();
  if (_processedUpdates.has(updateId)) return true;
  _processedUpdates.set(updateId, now);
  if (_processedUpdates.size > 500) {
    for (const [id, ts] of _processedUpdates.entries()) {
      if (now - ts > UPDATE_EXPIRY_MS) _processedUpdates.delete(id);
    }
  }
  return false;
}

export async function handleTelegramUpdate(update, db, botToken) {
  if (update?.update_id && isDuplicateUpdate(update.update_id)) {
    return;
  }
  if (update?.callback_query) {
    const cb = update.callback_query;
    const chatId = cb.message?.chat?.id;
    const data = cb.data || '';
    const uid = await findLinkedUid(chatId, db);

    if (data.startsWith('gol:') || data.startsWith('buy:')) {
      await answerTelegramCallback(botToken, cb.id);
      const messageId = cb.message?.message_id;
      const userUid = uid || (await ensureTelegramUser(chatId, cb.from, db));
      return handleGoalCallback(data, botToken, chatId, messageId, userUid, db);
    }

    if (data.startsWith('ok:')) {
      await answerTelegramCallback(botToken, cb.id, '✅ Transaksi dikonfirmasi cocok!');
      const messageId = cb.message?.message_id;
      if (messageId && cb.message?.text) {
        await editTelegramMessage(
          botToken,
          chatId,
          messageId,
          cb.message.text + '\n\n✨ *Status: Sudah kamu konfirmasi cocok!* 👍'
        );
      }
      return;
    }

    if (data.startsWith('del:')) {
      const txId = data.replace('del:', '');
      const userUid = uid || (await ensureTelegramUser(chatId, cb.from, db));
      if (db && userUid && txId) {
        try {
          await db.collection('users').doc(userUid).collection('transactions').doc(txId).delete();
        } catch {}
      }
      await answerTelegramCallback(botToken, cb.id, '🗑️ Transaksi struk berhasil dihapus!');
      const messageId = cb.message?.message_id;
      if (messageId) {
        await editTelegramMessage(
          botToken,
          chatId,
          messageId,
          '🗑️ *Transaksi ini telah dibatalkan & dihapus dari Pocketplan oleh Pocky.*'
        );
      }
      return;
    }

    if (data.startsWith('edit:')) {
      await answerTelegramCallback(botToken, cb.id);
      return sendTelegramMessage(
        botToken,
        chatId,
        '✏️ *Panduan Koreksi Struk oleh Pocky:*\n\n' +
        '• Mau ganti nominal? Ketik: `/koreksi 150k`\n' +
        '• Mau ganti toko? Ketik: `/toko Indomaret Point`\n' +
        '• Mau ganti kategori? Ketik: `/kategori Food`\n\n' +
        'Atau tekan tombol *🗑️ Hapus Transaksi* jika ingin membatalkan seluruhnya.',
        { reply_markup: KEYBOARD }
      );
    }

    if (data === 'saldo') {
      await answerTelegramCallback(botToken, cb.id);
      return sendSaldo(chatId, uid, db, botToken);
    }
    if (data === 'goals') {
      await answerTelegramCallback(botToken, cb.id);
      return sendGoals(chatId, uid, db, botToken);
    }
    if (data === 'refresh_web_code') {
      await answerTelegramCallback(botToken, cb.id, '🔄 Membuat kode baru...');
      if (cb.message?.message_id) {
        deleteTelegramMessage(botToken, chatId, cb.message.message_id).catch(() => {});
      }
      const userUid = uid || (await ensureTelegramUser(chatId, cb.from, db));
      return sendWebAccess(chatId, userUid, db, botToken);
    }
    if (data.startsWith('cancel_web_code:')) {
      const code = data.replace('cancel_web_code:', '');
      await answerTelegramCallback(botToken, cb.id, '❌ Kode login dibatalkan');
      if (code) {
        await cancelWebLoginCode(code, db);
      }
      const messageId = cb.message?.message_id;
      if (messageId) {
        await editTelegramMessage(
          botToken,
          chatId,
          messageId,
          '🚫 *Kode login website telah dibatalkan.*\n\nKetik `/web` kapan saja jika ingin masuk ke website lagi.'
        );
      }
      return;
    }
    if (data === 'toggle_reminder') {
      const userUid = uid || (await ensureTelegramUser(chatId, cb.from, db));
      let isEnabled = true;
      if (db && userUid) {
        const uRef = db.collection('users').doc(userUid);
        const uDoc = await uRef.get();
        const current = uDoc.data()?.dailyReminderEnabled !== false;
        isEnabled = !current;
        await uRef.set({ dailyReminderEnabled: isEnabled }, { merge: true });
      }
      await answerTelegramCallback(botToken, cb.id, isEnabled ? '🔔 Pengingat diaktifkan!' : '🔕 Pengingat dinonaktifkan!');
      const messageId = cb.message?.message_id;
      if (messageId) {
        const reminderText = `🔔 *Pengaturan Pengingat Harian Pocky*\n\n` +
          `Status: *${isEnabled ? 'Aktif' : 'Nonaktif'}* ${isEnabled ? '✅' : '⏸️'}\n\n` +
          `Pocky otomatis mengingatkanmu 2x sehari:\n` +
          `• 🌅 *06:00 WIB* — Info sisa saldo & progres semua target tabungan\n` +
          `• 🌙 *23:00 WIB* — Rekap pengeluaran hari ini & ajakan catat\n\n` +
          `${isEnabled ? 'Pengingat aktif. Pocky akan mengirimkan notifikasi tepat waktu! ✨' : 'Pengingat otomatis dijeda. Kamu bisa mengaktifkannya kembali kapan saja.'}`;
        await editTelegramMessage(botToken, chatId, messageId, reminderText, {
          reply_markup: {
            inline_keyboard: [
              [
                { text: isEnabled ? '🔕 Nonaktifkan Pengingat' : '🔔 Aktifkan Pengingat', callback_data: 'toggle_reminder' }
              ]
            ]
          }
        });
      }
      return;
    }



    // --- Budget inline menu callbacks (bdg:*) ---
    if (data.startsWith('bdg:')) {
      await answerTelegramCallback(botToken, cb.id);
      const messageId = cb.message?.message_id;
      const userUid = uid || (await ensureTelegramUser(chatId, cb.from, db));
      return handleBudgetCallback(data, botToken, chatId, messageId, userUid, db);
    }

    // --- Riwayat search callbacks (cr:*) ---
    if (data.startsWith('cr:')) {
      await answerTelegramCallback(botToken, cb.id);
      if (data === 'cr:cari') {
        const askRes = await sendTelegramMessage(botToken, chatId, '🔍 *Cari Transaksi*\n\nKetik kata kunci pencarian.\nContoh: `kopi`, `laptop`, `gaji`');
        setPendingSearch(chatId, askRes?.result?.message_id);
        if (askRes?.result?.message_id) {
          queueTempMessage(db, chatId, askRes.result.message_id, 120);
        }
        return;
      }
      if (data === 'cr:kembali') {
        const prevSearchMsgId = lastSearchMsgMap.get(String(chatId));
        if (prevSearchMsgId) {
          deleteTelegramMessage(botToken, chatId, prevSearchMsgId).catch(() => {});
          lastSearchMsgMap.delete(String(chatId));
        }
        // Re-send riwayat
        const snap = await db.collection('users').doc(uid).collection('transactions').orderBy('date', 'desc').limit(5).get();
        if (snap.empty) return sendTelegramMessage(botToken, chatId, '📜 *Belum ada transaksi.*\nMulai catat, misal: `25k makan siang`');
        let out = '📜 *5 Transaksi Terakhir:*\n\n';
        let i = 1;
        snap.forEach((d) => {
          const t = d.data();
          const sign = t.type === 'Income' ? '🟢 +' : '🔴 -';
          out += `${i}. ${sign}*${formatRupiah(t.amount)}*\n   ${escapeMarkdown(t.description || t.category)} • ${formatShortDate(t.date)}\n\n`;
          i++;
        });
        out += '💡 _Salah catat? Ketik `/batal` untuk hapus yang terakhir._';
        return sendTelegramMessage(botToken, chatId, out, {
          reply_markup: { inline_keyboard: [[{ text: '🔍 Cari', callback_data: 'cr:cari' }]] }
        });
      }
      return;
    }

    await answerTelegramCallback(botToken, cb.id);
    return;
  }
  const msg = update?.message || update?.edited_message;
  if (!msg) return;

  const chatId = msg.chat.id;
  const userFrom = msg.from || {};

  // Handle photo or document image receipt with Pocky Scan
  const isPhoto = msg.photo && msg.photo.length > 0;
  const isImageDoc = msg.document && msg.document.mime_type?.startsWith('image/');

  if (isPhoto || isImageDoc) {
    // Security: only linked accounts can trigger Gemini scan (paid API)
    const uid = await findLinkedUid(chatId, db);
    if (!uid) {
      return sendTelegramMessage(botToken, chatId,
        '🔒 *Fitur Pocky Scan hanya untuk akun yang sudah terhubung.*\n\nHubungkan dulu akun kamu:\n1️⃣ Buka website Pocketplan → Profile → Telegram Bot\n2️⃣ Salin kode 6 huruf\n3️⃣ Ketik di sini: `/link KODE`\n\nSetelah terhubung, kirim foto struk dan Pocky langsung baca! 🧾',
        { reply_markup: KEYBOARD }
      );
    }

    // Rate limit: max 25 scans per hour per chat
    if (!checkScanRateLimit(chatId)) {
      return sendTelegramMessage(botToken, chatId,
        '⏳ *Pocky istirahat sejenak ya!*\nKamu sudah mengirim 25 foto dalam 1 jam terakhir. Istirahat sejenak dulu yaa, atau kamu bisa catat manual: `kopi 25k` ✨',
        { reply_markup: KEYBOARD }
      );
    }

    await sendTelegramMessage(botToken, chatId, '🔍 *Pocky lagi teliti membaca struk & bukti transaksi kamu nih...*\nSebentar ya, Pocky periksa apakah ini struk belanja, bukti transfer, atau tagihan!');
    try {
      const fileId = isPhoto
        ? msg.photo[msg.photo.length - 1].file_id
        : msg.document.file_id;
      const mimeType = isImageDoc ? msg.document.mime_type : 'image/jpeg';

      const fileRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
      const fileData = await fileRes.json();
      if (!fileData.ok || !fileData.result?.file_path) {
        throw new Error('Gagal mengunduh file gambar dari server Telegram.');
      }

      const dlRes = await fetch(`https://api.telegram.org/file/bot${botToken}/${fileData.result.file_path}`);
      const arrayBuf = await dlRes.arrayBuffer();
      const imageBase64 = Buffer.from(arrayBuf).toString('base64');

      const scanRes = await scanReceiptWithGemini({ imageBase64, mimeType });
      if (scanRes.notReceipt) {
        const reasonDesc = scanRes.reason ? `sepertinya *${escapeMarkdown(scanRes.reason)}*` : 'bukan struk belanja atau bukti transfer';
        const notReceiptMsg = `🙈 *Ups, ini bukan struk atau bukti transaksi!*\n\n` +
          `Pocky mendeteksi gambar ini ${reasonDesc}.\n\n` +
          `Pocky hanya bisa membaca dan mencatat dari:\n` +
          `🧾 *Struk / nota kasir* (minimarket, cafe, resto, SPBU)\n` +
          `💳 *Bukti transfer* m-banking & e-wallet (BCA, Mandiri, BRI, QRIS, GoPay, Dana)\n` +
          `📄 *Bukti bayar tagihan* (listrik PLN, PDAM, pulsa)\n\n` +
          `Yuk kirimkan foto struk atau bukti transfer kamu yaa! ✨`;
        return sendTelegramMessage(botToken, chatId, notReceiptMsg, { reply_markup: KEYBOARD });
      }
      const r = scanRes.data;

      const txType = r.type === 'Income' ? 'Income' : 'Expense';
      const tx = {
        category: r.category || (txType === 'Income' ? 'Salary' : 'Food'),
        type: txType,
        amount: Number(r.total_amount) || 0,
        description: r.merchant_name || (txType === 'Income' ? 'Transfer Masuk' : 'Struk Belanja'),
        date: r.date || new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date()),
        createdAt: new Date().toISOString(),
        paymentMethod: r.payment_method || (r.doc_type?.startsWith('transfer') ? 'TRANSFER' : 'CASH'),
        receiptItems: r.items || [],
        docType: r.doc_type || 'receipt'
      };

      let txId = '';
      let budgetInfo = null;
      if (db) {
        const docRef = await db.collection('users').doc(uid).collection('transactions').add(tx);
        txId = docRef.id;
        await maybeSendLinkNudge(chatId, uid, db, botToken);
        if (tx.type === 'Expense') budgetInfo = await checkBudgetWarnings(chatId, uid, db, botToken, tx.category, tx.description);
        await handleStreakAfterTransaction(chatId, uid, db, botToken);
      }

      let itemSummary = '';
      if (Array.isArray(r.items) && r.items.length > 0) {
        const lines = r.items.slice(0, 5).map(it => `• ${escapeMarkdown(it.item_name)} (${it.quantity || 1}x): ${formatRupiah(it.total_price || 0)}`);
        if (r.items.length > 5) lines.push(`_...dan ${r.items.length - 5} barang lainnya_`);
        itemSummary = `\n🛒 *Rincian:* \n${lines.join('\n')}\n`;
      }

      let headerTitle = '🧾 *Hore! Struk Berhasil Dicatat Pocky!* 🎉';
      let entityLabel = '🏪 *Toko:*';
      let amountSign = '-';

      if (txType === 'Income') {
        headerTitle = '💰 *Hore! Bukti Transfer Masuk Dicatat Pocky!* 🎉';
        entityLabel = '📥 *Sumber / Pengirim:*';
        amountSign = '+';
      } else if (r.doc_type === 'transfer_out') {
        headerTitle = '💸 *Hore! Bukti Transfer Keluar Dicatat Pocky!* 🎉';
        entityLabel = '📤 *Tujuan / Penerima:*';
      } else if (r.doc_type === 'bill') {
        headerTitle = '📄 *Hore! Bukti Bayar Tagihan Dicatat Pocky!* 🎉';
        entityLabel = '🏢 *Layanan / Penyedia:*';
      }

      let budgetText = '';
      if (budgetInfo) {
        budgetText = `\nMasuk budget *${escapeMarkdown(budgetInfo.category)}*: ${formatRupiah(budgetInfo.total)} / ${formatRupiah(budgetInfo.limit)} (${budgetInfo.pct}%)\n`;
      }

      const reply = `${headerTitle}\n\n` +
        `${entityLabel} ${escapeMarkdown(r.merchant_name)}\n` +
        `💵 *Total:* *${amountSign}${formatRupiah(r.total_amount)}* (${txType === 'Income' ? '🟢 Pemasukan' : '🔴 Pengeluaran'})\n` +
        `🏷️ *Kategori:* ${escapeMarkdown(r.category)}\n` +
        `📅 *Tanggal:* ${formatShortDate(r.date)}\n` +
        `💳 *Metode:* ${escapeMarkdown(r.payment_method)}\n` +
        itemSummary +
        budgetText +
        `\n✨ Sudah rapi tersimpan di Pocketplan kamu!\n\n` +
        `💡 _Ada yang keliru? Ketik \`/koreksi 150k\` atau pilih opsi di bawah ini:_ 👇`;

      const inlineButtons = txId ? [
        [
          { text: '✅ Sudah Pas!', callback_data: `ok:${txId}` },
          { text: '🗑️ Hapus Transaksi', callback_data: `del:${txId}` }
        ],
        [
          { text: '✏️ Cara Koreksi Nominal', callback_data: `edit:${txId}` }
        ]
      ] : undefined;

      return sendTelegramMessage(botToken, chatId, reply, {
        reply_markup: inlineButtons ? { inline_keyboard: inlineButtons } : KEYBOARD
      });
    } catch (err) {
      console.error('Telegram receipt scanner error:', err);
      const msgStr = String(err?.message || '');
      const isQueue = /503|UNAVAILABLE|sibuk|high demand|antrean/i.test(msgStr);
      const isTimeout = /timeout|abort/i.test(msgStr);

      let messageText;
      if (isQueue) {
        messageText = '⏳ *Pocky lagi ramai antreannya nih!*\n\nBanyak yang sedang minta bantuan Pocky membaca struk secara bersamaan. Tolong coba kirim lagi beberapa detik kembali yaa! ✨\n\nAtau kamu bisa catat manual dulu: `kopi 25k` atau `/catat makan 50k`';
      } else if (isTimeout) {
        messageText = '⏳ *Waktu baca gambar habis nih!*\n\nKoneksi agak lambat saat Pocky memproses gambarmu. Tolong coba kirim lagi beberapa detik kembali yaa! ✨\n\nAtau kamu bisa catat manual dulu: `kopi 25k` atau `/catat makan 50k`';
      } else {
        messageText = '🙈 *Aduh, mata Pocky agak burem baca gambar ini!*\n\nGambarnya agak burem atau kurang terbaca nih. Tolong kirimkan kembali foto struk atau bukti transfer yang lebih jelas, terang, dan tegak lurus yaa ✨\n\nAtau kamu bisa minta Pocky catat manual: `kopi 25k` atau `/catat makan 50k`';
      }

      return sendTelegramMessage(
        botToken,
        chatId,
        messageText,
        { reply_markup: KEYBOARD }
      );
    }
  }

  if (!msg.text) return;
  const text = msg.text.trim();
  const userName = escapeMarkdown(userFrom.first_name || 'Teman');

  if (text.startsWith('/start')) {
    const parts = text.split(/\s+/);
    if (parts.length > 1) {
      const payload = parts[1];

      // Fase 3: ref_ deep link for referrals
      if (payload.startsWith('ref_')) {
        const referrerChatId = payload.replace('ref_', '');
        await ensureTelegramUser(chatId, userFrom, db);
        if (referrerChatId && String(referrerChatId) !== String(chatId) && db) {
          try {
            const uid = await findLinkedUid(chatId, db);
            const userRef = db.collection('users').doc(uid || `tg_${chatId}`);
            const userDoc = await userRef.get();
            const userData = userDoc.data() || {};
            if (!userData.referredBy) {
              await userRef.set({ referredBy: referrerChatId }, { merge: true });
              // Update referrer
              const referrerUid = await findLinkedUid(referrerChatId, db);
              if (referrerUid) {
                const rRef = db.collection('users').doc(referrerUid);
                const rDoc = await rRef.get();
                const rData = rDoc.data() || {};
                const referrals = rData.referrals || [];
                if (!referrals.some(r => String(r.chatId) === String(chatId))) {
                  referrals.push({ chatId: String(chatId), date: new Date().toISOString() });
                  await rRef.set({ referrals, referralCount: referrals.length }, { merge: true });
                  sendTelegramMessage(botToken, referrerChatId,
                    `🎉 Yeay! Temanmu join lewat link kamu! (total: ${referrals.length} teman)`
                  ).catch(() => {});
                }
              }
            }
          } catch (err) {
            console.error('referral error:', err?.message);
          }
        }
        // Referred user gets normal greeting with referral mention
        return sendTelegramMessage(
          botToken,
          chatId,
          `*Hai ${userName}! Salam kenal, aku Pocky!*\n\n🎁 Kamu diajak teman untuk pakai Pocketplan — selamat datang!\n\nAsisten keuangan pribadimu. Pocky bantu kamu:\n\n💸 Catat pemasukan & pengeluaran\n🧾 Scan foto struk otomatis\n🎯 Buat & pantau target tabungan\n📊 Cek saldo & riwayat kapan saja\n\nMulai: ketik \`kopi susu 25k\` atau kirim foto struk! 📖 /help`,
          { reply_markup: KEYBOARD }
        );
      }

      if (!checkLinkRateLimit(chatId)) {
        return sendTelegramMessage(botToken, chatId, '⚠️ Terlalu banyak percobaan kode gagal. Coba lagi nanti.');
      }

      const res = await linkChatWithCode(chatId, parts[1], userFrom, db);
      if (res === 'EXPIRED') return sendTelegramMessage(botToken, chatId, '⏳ *Kode kedaluwarsa*\nBuat kode baru di website: *Profile → Telegram Bot*.');
      if (res === 'ALREADY_LINKED_TG') return sendTelegramMessage(botToken, chatId, '⚠️ *Akun Telegram ini sudah terhubung ke akun web.*\nSatu akun Telegram hanya bisa terhubung ke satu akun web.');
      if (res === 'ALREADY_LINKED_WEB') return sendTelegramMessage(botToken, chatId, '⚠️ *Akun web ini sudah terhubung ke akun Telegram lain.*');
      if (res) {
        if (msg?.message_id) deleteTelegramMessage(botToken, chatId, msg.message_id).catch(() => {});
        return sendTelegramMessage(
          botToken,
          chatId,
          '🎉 *Akun berhasil terhubung!*\n\nSemua catatan keuanganmu kini sinkron otomatis antara Telegram dan Pocketplan web.\n\nMau mulai catat? Coba ketik: `kopi 15k`',
          { reply_markup: KEYBOARD }
        );
      }
      recordLinkFail(chatId);

      return sendTelegramMessage(botToken, chatId, '❌ *Kode tidak valid*\nPastikan 6 karakter kode sama persis dengan yang tertera di menu *Profile* website.');
    }
    await ensureTelegramUser(chatId, userFrom, db);
    return sendTelegramMessage(
      botToken,
      chatId,
      `*Hai ${userName}! Salam kenal, aku Pocky!*\n\nAsisten keuangan pribadimu dari Pocketplan. Pocky bantu kamu:\n\n💸 Catat pemasukan & pengeluaran\n🧾 Scan foto struk & bukti transfer otomatis\n🎯 Buat & pantau target tabungan\n📊 Cek saldo & riwayat kapan saja\n\n*Mulai gampang banget:*\n• Kirim foto struk atau bukti transfer → otomatis dicatat Pocky!\n• Ketik langsung → \`kopi susu 25k\`\n• Pengeluaran → \`/catat bensin 50k\`\n• Pemasukan → \`/masuk gaji 2jt\`\n• Target baru → \`/goal Laptop 10jt\`\n• Cek saldo → \`/saldo\`\n\nKetik /help untuk panduan lengkap 📖`,
      { reply_markup: KEYBOARD }
    );
  }

  if (text.startsWith('/link') || text.startsWith('/hubungkan')) {
    const parts = text.split(/\s+/);
    if (parts.length < 2) {
      return sendTelegramMessage(botToken, chatId, '🔗 *Hubungkan Akun Website*\n\nKetik: `/link KODE`\nContoh: `/link AB12CD`\n\n_Ambil kode di menu Profile → Telegram Bot di website Pocketplan._');
    }
    if (!checkLinkRateLimit(chatId)) {
      return sendTelegramMessage(botToken, chatId, '⚠️ Terlalu banyak percobaan kode gagal. Coba lagi nanti.');
    }

    const res = await linkChatWithCode(chatId, parts[1], userFrom, db);
    if (res === 'EXPIRED') return sendTelegramMessage(botToken, chatId, '⏳ *Kode kedaluwarsa*\nBuat kode baru di menu Profile website.');
    if (res === 'ALREADY_LINKED_TG') return sendTelegramMessage(botToken, chatId, '⚠️ *Akun Telegram ini sudah terhubung ke akun web.*\nSatu akun Telegram hanya bisa terhubung ke satu akun web.');
    if (res === 'ALREADY_LINKED_WEB') return sendTelegramMessage(botToken, chatId, '⚠️ *Akun web ini sudah terhubung ke akun Telegram lain.*');
    if (res) {
      if (msg?.message_id) deleteTelegramMessage(botToken, chatId, msg.message_id).catch(() => {});
      return sendTelegramMessage(
        botToken,
        chatId,
        '🎉 *Akun tersambung!*\nSemua catatan kini sinkron otomatis ke website Pocketplan.',
        { reply_markup: KEYBOARD }
      );
    }
    recordLinkFail(chatId);

    return sendTelegramMessage(botToken, chatId, '❌ *Kode tidak ditemukan*\nPastikan kode sama persis dengan yang tertera di website.');
  }

  const uid = await ensureTelegramUser(chatId, userFrom, db);
  if (uid && uid !== `tg_${chatId}`) {
    migrateTelegramDataToUser(chatId, uid, db).catch(() => {});
  }

  // Intercept text input for pending budget creation
  const pendingB = getPendingBudget(chatId);
  if (pendingB && !text.startsWith('/')) {
    if (pendingB.step === 'label') {
      const label = text.slice(0, 60).trim();
      if (!label) {
        if (pendingB.errorMsgId) deleteTelegramMessage(botToken, chatId, pendingB.errorMsgId).catch(() => {});
        const errRes = await sendTelegramMessage(botToken, chatId, '❌ Label tidak boleh kosong. Ketik ulang:');
        setPendingBudget(chatId, { ...pendingB, errorMsgId: errRes?.result?.message_id });
        if (errRes?.result?.message_id) queueTempMessage(db, chatId, errRes.result.message_id, 60);
        return;
      }
      if (pendingB.promptMsgId) deleteTelegramMessage(botToken, chatId, pendingB.promptMsgId).catch(() => {});
      if (pendingB.errorMsgId) deleteTelegramMessage(botToken, chatId, pendingB.errorMsgId).catch(() => {});
      const askRes = await sendTelegramMessage(botToken, chatId,
        `💰 Budget: *${escapeMarkdown(label)}*\n\nLimitnya berapa? Ketik nominal.\nContoh: \`500k\`, \`1.5jt\`, \`200000\``,
        { reply_markup: { inline_keyboard: [[{ text: '❌ Batal', callback_data: 'bdg:list' }]] } }
      );
      setPendingBudget(chatId, { step: 'amount', label, promptMsgId: askRes?.result?.message_id });
      return;
    }
    if (pendingB.step === 'amount') {
      const limit = parseAmount(text);
      if (!limit || limit <= 0) {
        if (pendingB.errorMsgId) deleteTelegramMessage(botToken, chatId, pendingB.errorMsgId).catch(() => {});
        const errRes = await sendTelegramMessage(botToken, chatId, '❌ Nominal tidak valid. Coba lagi.\nContoh: `500k`, `1.5jt`');
        setPendingBudget(chatId, { ...pendingB, errorMsgId: errRes?.result?.message_id });
        if (errRes?.result?.message_id) queueTempMessage(db, chatId, errRes.result.message_id, 60);
        return;
      }
      if (pendingB.promptMsgId) deleteTelegramMessage(botToken, chatId, pendingB.promptMsgId).catch(() => {});
      if (pendingB.errorMsgId) deleteTelegramMessage(botToken, chatId, pendingB.errorMsgId).catch(() => {});
      const label = pendingB.label;
      const keywords = label.toLowerCase().split(/\s+/)
        .map(w => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')).filter(Boolean)
        .filter(w => w.length >= 3 && !['beli', 'membeli', 'buat', 'untuk'].includes(w));
      const guessedCat = guessBudgetCategory(label).category.toLowerCase();
      if (guessedCat !== 'other' && !keywords.includes(guessedCat)) keywords.push(guessedCat);
      if (db) {
        await db.collection('users').doc(uid).collection('budgets').add({
          customLabel: label, keywords, monthlyLimit: limit, amount: limit,
          category: guessBudgetCategory(label).category, rawCategory: label,
          createdAt: new Date().toISOString()
        });
      }
      clearPendingBudget(chatId);
      return sendTelegramMessage(botToken, chatId,
        `✅ *Budget "${escapeMarkdown(label)}" dibuat!*\nBatas: *${formatRupiah(limit)}*\nKeyword: ${keywords.map(k => `\`${k}\``).join(', ') || '_—_'}`,
        { reply_markup: { inline_keyboard: [[{ text: '⬅️ Daftar Budget', callback_data: 'bdg:list' }]] } }
      );
    }
    if (pendingB.step === 'limit' && pendingB.budgetId) {
      const limit = parseAmount(text);
      if (!limit || limit <= 0) {
        if (pendingB.errorMsgId) deleteTelegramMessage(botToken, chatId, pendingB.errorMsgId).catch(() => {});
        const errRes = await sendTelegramMessage(botToken, chatId, '❌ Nominal tidak valid. Coba lagi.');
        setPendingBudget(chatId, { ...pendingB, errorMsgId: errRes?.result?.message_id });
        if (errRes?.result?.message_id) queueTempMessage(db, chatId, errRes.result.message_id, 60);
        return;
      }
      if (pendingB.promptMsgId) deleteTelegramMessage(botToken, chatId, pendingB.promptMsgId).catch(() => {});
      if (pendingB.errorMsgId) deleteTelegramMessage(botToken, chatId, pendingB.errorMsgId).catch(() => {});
      if (db) {
        const bDocRef = db.collection('users').doc(uid).collection('budgets').doc(pendingB.budgetId);
        await bDocRef.ref.set(
          { monthlyLimit: limit, amount: limit, updatedAt: new Date().toISOString() }, { merge: true }
        );
      }
      clearPendingBudget(chatId);
      return sendTelegramMessage(botToken, chatId,
        `✅ *Limit diubah menjadi ${formatRupiah(limit)}*`,
        { reply_markup: { inline_keyboard: [[{ text: '⬅️ Daftar Budget', callback_data: 'bdg:list' }]] } }
      );
    }
    clearPendingBudget(chatId);
  }

  // Intercept text input for pending goal creation
  const pendingG = getPendingGoal(chatId);
  if (pendingG && !text.startsWith('/')) {
    if (pendingG.step === 'name') {
      const name = text.slice(0, 60).trim();
      if (!name) {
        if (pendingG.errorMsgId) deleteTelegramMessage(botToken, chatId, pendingG.errorMsgId).catch(() => {});
        const errRes = await sendTelegramMessage(botToken, chatId, '❌ Nama target tidak boleh kosong. Ketik ulang:');
        setPendingGoal(chatId, { ...pendingG, errorMsgId: errRes?.result?.message_id });
        if (errRes?.result?.message_id) queueTempMessage(db, chatId, errRes.result.message_id, 60);
        return;
      }
      if (pendingG.promptMsgId) deleteTelegramMessage(botToken, chatId, pendingG.promptMsgId).catch(() => {});
      if (pendingG.errorMsgId) deleteTelegramMessage(botToken, chatId, pendingG.errorMsgId).catch(() => {});
      const askRes = await sendTelegramMessage(botToken, chatId,
        `🎯 Target: *${escapeMarkdown(name)}*\n\nBerapa target nominal yang ingin dicapai? Ketik angka:\nContoh: \`10jt\`, \`5000000\`, \`750k\``,
        { reply_markup: { inline_keyboard: [[{ text: '❌ Batal', callback_data: 'gol:list' }]] } }
      );
      setPendingGoal(chatId, { step: 'target', name, promptMsgId: askRes?.result?.message_id });
      return;
    }
    if (pendingG.step === 'target') {
      const target = parseAmount(text);
      if (!target || target <= 0) {
        if (pendingG.errorMsgId) deleteTelegramMessage(botToken, chatId, pendingG.errorMsgId).catch(() => {});
        const errRes = await sendTelegramMessage(botToken, chatId, '❌ Nominal tidak valid. Coba lagi.\nContoh: \`10jt\`, \`5000000\`, \`500k\`');
        setPendingGoal(chatId, { ...pendingG, errorMsgId: errRes?.result?.message_id });
        if (errRes?.result?.message_id) queueTempMessage(db, chatId, errRes.result.message_id, 60);
        return;
      }
      if (pendingG.promptMsgId) deleteTelegramMessage(botToken, chatId, pendingG.promptMsgId).catch(() => {});
      if (pendingG.errorMsgId) deleteTelegramMessage(botToken, chatId, pendingG.errorMsgId).catch(() => {});
      const name = pendingG.name;
      if (db) {
        await db.collection('users').doc(uid).collection('goals').add({
          name, target, amount: 0, type: 'Saving', createdAt: new Date().toISOString()
        });
      }
      clearPendingGoal(chatId);
      return sendTelegramMessage(botToken, chatId,
        `✅ *Target Impian Dibuat!* 🎯\n\n📌 *${escapeMarkdown(name)}*\n🎯 Target: *${formatRupiah(target)}*\n\nSemangat menabung! Pocky siap membantumu mencapainya! ✨`,
        { reply_markup: { inline_keyboard: [[{ text: '🎯 Lihat Target Impian', callback_data: 'gol:list' }]] } }
      );
    }
    if (pendingG.step === 'edit_target' && pendingG.goalId) {
      const target = parseAmount(text);
      if (!target || target <= 0) {
        if (pendingG.errorMsgId) deleteTelegramMessage(botToken, chatId, pendingG.errorMsgId).catch(() => {});
        const errRes = await sendTelegramMessage(botToken, chatId, '❌ Nominal tidak valid. Coba lagi.\nContoh: \`10jt\`, \`5000000\`, \`500k\`');
        setPendingGoal(chatId, { ...pendingG, errorMsgId: errRes?.result?.message_id });
        if (errRes?.result?.message_id) queueTempMessage(db, chatId, errRes.result.message_id, 60);
        return;
      }
      if (pendingG.promptMsgId) deleteTelegramMessage(botToken, chatId, pendingG.promptMsgId).catch(() => {});
      if (pendingG.errorMsgId) deleteTelegramMessage(botToken, chatId, pendingG.errorMsgId).catch(() => {});
      if (db) {
        const gDocRef = db.collection('users').doc(uid).collection('goals').doc(pendingG.goalId);
        await (typeof gDocRef.set === 'function' ? gDocRef.set({ target, updatedAt: new Date().toISOString() }, { merge: true }) : gDocRef.ref.set({ target, updatedAt: new Date().toISOString() }, { merge: true }));
      }
      clearPendingGoal(chatId);
      return sendTelegramMessage(botToken, chatId,
        `✅ *Target nominal berhasil diubah menjadi ${formatRupiah(target)}!*`,
        { reply_markup: { inline_keyboard: [[{ text: '🎯 Lihat Target Impian', callback_data: 'gol:list' }]] } }
      );
    }
    clearPendingGoal(chatId);
  }

  // Intercept text input for riwayat search
  const pendingS = getPendingSearch(chatId);
  if (pendingS && !text.startsWith('/')) {
    clearPendingSearch(chatId);
    if (pendingS.promptMsgId) {
      deleteTelegramMessage(botToken, chatId, pendingS.promptMsgId).catch(() => {});
    }
    return handleRiwayatSearch(text.trim(), chatId, uid, db, botToken);
  }

  if (text === '/unlink' || text === '/putus' || text.startsWith('/unlink@') || text.startsWith('/putus@')) {
    await unlinkAccount(uid, db);
    return sendTelegramMessage(botToken, chatId, '🔌 *Koneksi diputus*\nAkun Telegram tidak lagi terhubung ke website Pocketplan.');
  }

  if (text === '/menu' || text.startsWith('/menu@')) return sendTelegramMessage(botToken, chatId, '📱 *Menu Pocketplan*\nPilih menu di bawah atau ketik perintah langsung.', { reply_markup: KEYBOARD });

  if (text === '💸 Catat Keluar' || text === '💸 Catat Pengeluaran') {
    return sendTelegramMessage(botToken, chatId, '💸 *Catat Pengeluaran*\nKetik nominal & keterangan (urutan bebas):\n\n`25k kopi susu`\n`kopi susu 25k`\n`/catat makan siang 50k`');
  }

  if (text === '💰 Catat Masuk' || text === '💰 Tambah Pemasukan') {
    return sendTelegramMessage(botToken, chatId, '💰 *Catat Pemasukan*\nKetik keterangan & sumber & nominal pemasukan:\n\n`/masuk gaji bulanan 2.5jt`\n`/masuk 300k freelance`');
  }

  if (text === '/goals' || text.startsWith('/goals@') || text === '🎯 Target Impian' || text === '🎯 Target Goals') {
    return sendGoals(chatId, uid, db, botToken);
  }

  if (text === '/web' || text.startsWith('/web@') || text === '🌐 Buka di Web' || text === '🌐 Akses Web') {
    return sendWebAccess(chatId, uid, db, botToken);
  }

  if (text === '/pengingat' || text.startsWith('/pengingat@') || text === '🔔 Pengingat') {
    let isEnabled = true;
    if (db && uid) {
      const uRef = db.collection('users').doc(uid);
      const uDoc = await uRef.get();
      isEnabled = uDoc.data()?.dailyReminderEnabled !== false;
    }
    const msgText = `🔔 *Pengaturan Pengingat Harian Pocky*\n\n` +
      `Status saat ini: *${isEnabled ? 'Aktif' : 'Nonaktif'}* ${isEnabled ? '✅' : '⏸️'}\n\n` +
      `Pocky otomatis mengingatkanmu 2x sehari:\n` +
      `• 🌅 *06:00 WIB* — Info sisa saldo & progres semua target tabungan\n` +
      `• 🌙 *23:00 WIB* — Rekap pengeluaran hari ini & ajakan catat\n\n` +
      `${isEnabled ? 'Pengingat aktif. Pocky akan mengirimkan notifikasi tepat waktu! ✨' : 'Pengingat dinonaktifkan. Tekan tombol di bawah untuk mengaktifkan kembali.'}`;
    return sendTelegramMessage(botToken, chatId, msgText, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: isEnabled ? '🔕 Nonaktifkan Pengingat' : '🔔 Aktifkan Pengingat', callback_data: 'toggle_reminder' }
          ]
        ]
      }
    });
  }

  if (text.startsWith('/beligoal')) {
    const q = text.replace(/^\/beligoal(@\S+)?/i, '').trim().toLowerCase();
    if (!q) {
      return sendTelegramMessage(botToken, chatId,
        '🛍️ *Cara beli target impian:*\n\nKetik: `/beligoal [nama target]`\nContoh: `/beligoal Laptop`\n\nAtau ketik `/goals` untuk lihat daftar target & tombol beli.',
        { reply_markup: KEYBOARD });
    }
    if (db) {
      const snap = await db.collection('users').doc(uid).collection('goals').get();
      const exact = snap.docs.find((d) => d.id === q || d.data().name?.toLowerCase() === q);
      const match = exact || snap.docs.find((d) => d.data().name?.toLowerCase().includes(q));
      if (!match) return sendTelegramMessage(botToken, chatId, `❌ Target "${escapeMarkdown(q)}" tidak ditemukan.\nKetik /goals untuk lihat semua target.`);
      if (!exact && snap.docs.filter((d) => d.data().name?.toLowerCase().includes(q)).length > 1) {
        return sendTelegramMessage(botToken, chatId, `⚠️ Ada beberapa target cocok dengan "${escapeMarkdown(q)}".\nKetik nama lebih lengkap atau gunakan /goals lalu tekan tombol Beli.`);
      }
      const g = match.data();
      const amt = Number(g.target) || 0;
      const { bal } = await getBalance(uid, db);
      if (bal < amt) {
        return sendTelegramMessage(botToken, chatId,
          `🚫 *Saldo tidak cukup untuk beli ${escapeMarkdown(g.name)}*\n\n💳 Saldo: *${formatRupiah(bal)}*\n🎯 Harga: *${formatRupiah(amt)}*\n📉 Kurang: *${formatRupiah(amt - bal)}*\n\nTambah pemasukan dulu ya!`
        );
      }
      await db.collection('users').doc(uid).collection('transactions').add({
        category: 'Shopping',
        type: 'Expense',
        amount: amt,
        description: `Pembelian Goal: ${g.name}`,
        date: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
        goalBackup: { name: g.name, target: g.target, amount: g.amount || 0, type: g.type || 'Saving', createdAt: g.createdAt || new Date().toISOString() }
      });
      await match.ref.delete();
      return sendTelegramMessage(
        botToken,
        chatId,
        `🥳 *Impian Tercapai!* 🎉\n\n*${escapeMarkdown(g.name)}* (${formatRupiah(amt)}) berhasil dibeli!\n\n✅ Pengeluaran dicatat\n🎯 Target selesai & diarsipkan\n\nHebat, nabungmu membuahkan hasil!`
      );
    }
    return sendTelegramMessage(botToken, chatId, 'Target dibeli.');
  }

  if (text === '/goal' || /^\/goal@\S+$/i.test(text)) {
    const res = await sendTelegramMessage(botToken, chatId, '🎯 *Format Buat Target:*\nKetik: `/goal [nama] [nominal]` atau `/goal [nominal] [nama]`\nContoh: `/goal Motor Matic 15jt`',
      { reply_markup: KEYBOARD });
    if (res?.result?.message_id) queueTempMessage(db, chatId, res.result.message_id, 60);
    return res;
  }

  if (/^\/goal(@\S+)?\s+/i.test(text)) {
    const raw = text.replace(/^\/goal(@\S+)?\s+/i, '').trim();
    if (!raw) {
      const res = await sendTelegramMessage(botToken, chatId, '🎯 *Format Buat Target:*\nKetik: `/goal [nama] [nominal]` atau `/goal [nominal] [nama]`\nContoh: `/goal Motor Matic 15jt`');
      if (res?.result?.message_id) queueTempMessage(db, chatId, res.result.message_id, 60);
      return res;
    }
    const rawWords = raw.split(/\s+/);
    let amt = 0;
    let name = '';

    const firstAmt = parseAmount(rawWords[0]);
    if (firstAmt > 0) {
      amt = firstAmt;
      name = rawWords.slice(1).join(' ').trim();
    } else {
      const lastAmt = parseAmount(rawWords[rawWords.length - 1]);
      if (lastAmt > 0) {
        amt = lastAmt;
        name = rawWords.slice(0, -1).join(' ').trim();
      }
    }

    if (!name) name = 'Tabungan Impian';
    if (!amt) {
      const res = await sendTelegramMessage(botToken, chatId, '⚠️ Nominal belum benar.\nContoh:\n👉 `/goal Laptop Baru 10jt`\n👉 `/goal 10jt Laptop Baru`');
      if (res?.result?.message_id) queueTempMessage(db, chatId, res.result.message_id, 60);
      return res;
    }
    if (db) {
      await db.collection('users').doc(uid).collection('goals').add({
        name,
        target: amt,
        type: 'Saving',
        createdAt: new Date().toISOString()
      });
    }
    return sendTelegramMessage(
      botToken,
      chatId,
      `🎯 *Target Baru Dibuat!* ✨\n\n📌 *${escapeMarkdown(name)}*\n🎯 Target: *${formatRupiah(amt)}*\n\nKetik \`/goals\` kapan saja buat cek progres tabunganmu! 🚀`
    );
  }

  if (text === '/help' || text === '/bantuan' || text.startsWith('/help@') || text.startsWith('/bantuan@')) {
    return sendTelegramMessage(
      botToken,
      chatId,
      '📖 <b>PANDUAN LENGKAP POCKY</b>\n\n' +
      '<b>🧾 SCAN STRUK</b>\n' +
      '• Kirim foto struk/bukti transfer langsung ke chat ini!\n\n' +
      '<b>📝 CATAT CEPAT</b>\n' +
      '• <code>kopi susu 25k</code> atau <code>/catat bensin 50k</code> — pengeluaran\n' +
      '• <code>/masuk gaji 2.5jt</code> — pemasukan\n' +
      '• <code>/batal</code> — batalkan transaksi terakhir\n\n' +
      '<b>💰 BUDGET BELANJA (CUSTOM PER ITEM)</b>\n' +
      '• <code>/budget</code> — menu interaktif: buat baru, lihat detail, ubah limit, atau hapus via tombol\n' +
      '• <i>Cara cepat:</i> <code>/budget [label] [nominal]</code> (misal: <code>/budget laptop 10jt</code>)\n' +
      '• <i>Hapus cepat:</i> <code>/budget hapus [label]</code>\n\n' +
      '<b>🎯 TARGET &amp; KONSISTENSI</b>\n' +
      '• <code>/goals</code> — menu interaktif: buat baru, lihat detail, ubah, hapus, atau tandai selesai via tombol\n' +
      '• <i>Cara cepat:</i> <code>/goal [nama] [target]</code> (misal: <code>/goal Laptop Baru 10jt</code>)\n' +
      '• <i>Beli cepat:</i> <code>/beligoal [nama]</code> — tandai goal selesai &amp; catat pengeluaran\n' +
      '• <code>/streak</code> — pantau rekor hari konsisten catat keuangan\n' +
      '• <code>/pencapaian</code> — galeri lencana &amp; milestone\n\n' +
      '<b>📊 INFO &amp; SINKRONISASI</b>\n' +
      '• <code>/saldo</code> — sisa saldo &amp; ringkasan arus kas\n' +
      '• <code>/riwayat</code> — 5 transaksi terakhir\n' +
      '• <code>/web</code> — kode passcode login website\n' +
      '• <code>/link [kode]</code> — hubungkan akun website ↔ Telegram\n' +
      '• <code>/pengingat</code> — jadwal pengingat pagi &amp; malam\n' +
      '• <code>/ajak</code> — undang teman via link referral (dapat notif + badge!)\n' +
      '• <code>/menu</code> — menu tombol cepat\n\n' +
      '💡 <i>Format nominal: 25k, 50rb, 50.000, 1.5jt, Rp50000</i>',
      { reply_markup: KEYBOARD, parse_mode: 'HTML' }
    );
  }

  if (text === '/saldo' || text === '/balance' || text.startsWith('/saldo@') || text.startsWith('/balance@') || text === '📊 Cek Saldo') {
    return sendSaldo(chatId, uid, db, botToken);
  }

  if (text === '/riwayat' || text === '/history' || text.startsWith('/riwayat@') || text.startsWith('/history@') || text === '📜 Riwayat' || text === '📜 5 Riwayat') {
    if (db) {
      const snap = await db.collection('users').doc(uid).collection('transactions').orderBy('date', 'desc').limit(5).get();
      if (snap.empty) return sendTelegramMessage(botToken, chatId, '📜 *Belum ada transaksi.*\nMulai catat, misal: `25k makan siang`');
      let out = '📜 *5 Transaksi Terakhir:*\n\n';
      let i = 1;
      snap.forEach((d) => {
        const t = d.data();
        const sign = t.type === 'Income' ? '🟢 +' : '🔴 -';
        out += `${i}. ${sign}*${formatRupiah(t.amount)}*\n   ${escapeMarkdown(t.description || t.category)} • ${formatShortDate(t.date)}\n\n`;
        i++;
      });
      out += '💡 _Salah catat? Ketik `/batal` untuk hapus yang terakhir._';
      return sendTelegramMessage(botToken, chatId, out, {
        reply_markup: { inline_keyboard: [[{ text: '🔍 Cari', callback_data: 'cr:cari' }]] }
      });
    }
    return sendTelegramMessage(botToken, chatId, 'Mode demo aktif.');
  }

  const cmdText = text.toLowerCase().replace(/@\S+/, '').trim();

  // /ajak — referral invite link
  if (cmdText === '/ajak' || cmdText.startsWith('/ajak ')) {
    const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'yourpocketplan_bot';
    const link = `https://t.me/${botUsername}?start=ref_${chatId}`;
    return sendTelegramMessage(botToken, chatId,
      `🎉 *Ajak Teman Pakai Pocky!*\n\n` +
      `Bagikan link ini ke teman-temanmu:\n\n` +
      `\`${link}\`\n\n` +
      `📋 _Tap link di atas untuk copy, lalu kirim ke teman lewat WA/IG/chat!_`,
      { reply_markup: KEYBOARD }
    );
  }
  // /streak — check current streak status
  if (cmdText === '/streak' || cmdText.startsWith('/streak ') || text === '🔥 Cek Streak') {
    let streak = 0;
    let longest = 0;
    let lastDate = '-';
    if (db && uid) {
      try {
        const uDoc = await db.collection('users').doc(uid).get();
        const uData = uDoc.data() || {};
        streak = Number(uData.currentStreak) || 0;
        longest = Number(uData.longestStreak) || 0;
        lastDate = uData.lastStreakDate || '-';
      } catch {}
    }
    return sendTelegramMessage(botToken, chatId,
      `🔥 *Status Streak Keuangan Kamu*\n\n` +
      `• Streak Saat Ini: *${streak} hari* berturut-turut\n` +
      `• Rekor Terpanjang: *${longest} hari*\n` +
      `• Tanggal Terakhir: \`${lastDate}\`\n\n` +
      (streak > 0
        ? `Hebat! Konsistensimu luar biasa. Terus pertahankan kebiasaan mencatat keuanganmu!`
        : `Yuk catat transaksi hari ini (misal: \`25k makan siang\`) untuk menyalakan streak baru! 💪`),
      { reply_markup: KEYBOARD }
    );
  }

  // /pencapaian or /achievements — check unlocked badges & milestones
  if (cmdText === '/pencapaian' || cmdText === '/achievements' || text === '🏅 Pencapaian') {
    let seen = [];
    if (db && uid) {
      try {
        const uDoc = await db.collection('users').doc(uid).get();
        const uData = uDoc.data() || {};
        seen = Array.isArray(uData.achievementsSeen) ? uData.achievementsSeen : [];
        if (uid !== `tg_${chatId}`) {
          const altDoc = await db.collection('users').doc(`tg_${chatId}`).get();
          const altData = altDoc.data() || {};
          const altSeen = Array.isArray(altData.achievementsSeen) ? altData.achievementsSeen : [];
          seen = Array.from(new Set([...seen, ...altSeen]));
        }
      } catch {}
    }
    if (seen.length === 0) {
      return sendTelegramMessage(botToken, chatId,
        `🏅 *Galeri Pencapaian Pocky*\n\n` +
        `Belum ada lencana yang terbuka. Bangun streak mencatat dan capai target tabunganmu untuk membuka lencana eksklusif! 🚀`,
        { reply_markup: KEYBOARD }
      );
    }
    let msg = `🏅 *Galeri Pencapaian Pocky (${seen.length} Terbuka)*\n\n`;
    seen.forEach((k) => {
      msg += `✨ *${escapeMarkdown(k.replace(/_/g, ' ').toUpperCase())}*\n`;
    });
    msg += `\n_Lihat visual detail lencana di website menu Pencapaian!_`;
    return sendTelegramMessage(botToken, chatId, msg, { reply_markup: KEYBOARD });
  }

  // Developer test command — preview streak notification (restricted to DEV_TELEGRAM_IDS)
  if (cmdText === '/teststreak' || cmdText.startsWith('/teststreak ')) {
    const devIds = (process.env.DEV_TELEGRAM_IDS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!devIds.includes(String(chatId))) {
      return; // Silent ignore for unauthorized users
    }
    const rawArgs = text.replace(/^\/teststreak(@\S+)?\s*/i, '').trim();
    let days = 7;
    const parts = rawArgs.split(/\s+/).filter(Boolean);
    for (const p of parts) {
      if (/^\d+$/.test(p)) days = parseInt(p, 10);
    }
    const targetChatId = chatId;
    return sendTelegramMessage(botToken, targetChatId,
      `🔥 *Tes Notifikasi Streak Milestone*\n\nSelamat! Kamu telah mencapai streak *${days} hari* berturut-turut! 🎉\n\n_Pocky Developer Preview_`
    );
  }



  if (cmdText === '/batal' || cmdText === '/hapus') {
    if (db) {
      const snap = await db.collection('users').doc(uid).collection('transactions').orderBy('createdAt', 'desc').limit(1).get();
      if (snap.empty) return sendTelegramMessage(botToken, chatId, '🤷 Tidak ada transaksi untuk dibatalkan.');
      const d = snap.docs[0];
      const data = d.data();
      await d.ref.delete();
      // Restore goal if this was a goal-purchase transaction
      if (data.goalBackup) {
        const gb = data.goalBackup;
        await db.collection('users').doc(uid).collection('goals').add({
          name: gb.name,
          target: gb.target,
          amount: gb.amount || 0,
          type: gb.type || 'Saving',
          createdAt: gb.createdAt || new Date().toISOString()
        });
        return sendTelegramMessage(botToken, chatId, `🗑️ *Dibatalkan!*\nTransaksi *${escapeMarkdown(data.description)}* (${formatRupiah(data.amount)}) telah dihapus.\n\n🎯 Target *${escapeMarkdown(gb.name)}* telah dikembalikan ke daftar goal.`);
      }
      return sendTelegramMessage(botToken, chatId, `🗑️ *Dibatalkan!*\nTransaksi *${escapeMarkdown(data.description)}* (${formatRupiah(data.amount)}) telah dihapus.`);
    }
    return sendTelegramMessage(botToken, chatId, 'Dibatalkan.');
  }

  if (text.startsWith('/koreksi') || text.startsWith('/ubah')) {
    const parts = text.split(/\s+/);
    if (parts.length < 2) {
      return sendTelegramMessage(
        botToken,
        chatId,
        '✏️ *Format Koreksi Nominal:*\n\nKetik: `/koreksi [nominal baru]`\nContoh:\n👉 `/koreksi 150k`\n👉 `/koreksi 185000`',
        { reply_markup: KEYBOARD }
      );
    }
    const newAmt = parseAmount(parts.slice(1).join(' '));
    if (!newAmt || newAmt <= 0) {
      return sendTelegramMessage(botToken, chatId, '⚠️ Nominal tidak valid. Contoh: `/koreksi 150k`');
    }
    if (db) {
      const snap = await db.collection('users').doc(uid).collection('transactions').orderBy('createdAt', 'desc').limit(1).get();
      if (snap.empty) {
        return sendTelegramMessage(botToken, chatId, '🤷 Belum ada transaksi yang bisa diubah.');
      }
      const lastDoc = snap.docs[0];
      const oldData = lastDoc.data();
      await lastDoc.ref.update({ amount: newAmt });
      return sendTelegramMessage(
        botToken,
        chatId,
        `✏️ *Nominal Berhasil Dikoreksi Pocky!* ✨\n\n` +
        `🏪 *Toko / Deskripsi:* ${escapeMarkdown(oldData.description || 'Pengeluaran')}\n` +
        `💵 *Total Semula:* ${formatRupiah(oldData.amount)}\n` +
        `💵 *Total Baru:* *${formatRupiah(newAmt)}*\n\n` +
        `✅ Catatan di Pocketplan sudah langsung diperbarui!`,
        { reply_markup: KEYBOARD }
      );
    }
    return sendTelegramMessage(botToken, chatId, `✏️ Nominal diubah menjadi ${formatRupiah(newAmt)}.`);
  }

  if (text.startsWith('/toko')) {
    const newShop = text.replace(/^\/toko(@\S+)?\s*/i, '').trim();
    if (!newShop) {
      return sendTelegramMessage(botToken, chatId, '🏪 Ketik: `/toko [nama toko baru]`\nContoh: `/toko Indomaret Point`');
    }
    if (db) {
      const snap = await db.collection('users').doc(uid).collection('transactions').orderBy('createdAt', 'desc').limit(1).get();
      if (snap.empty) return sendTelegramMessage(botToken, chatId, '🤷 Belum ada transaksi yang bisa diubah.');
      await snap.docs[0].ref.update({ description: newShop });
      return sendTelegramMessage(
        botToken,
        chatId,
        `🏪 *Nama Toko Diperbarui Pocky!*\nKini menjadi: *${escapeMarkdown(newShop)}*`,
        { reply_markup: KEYBOARD }
      );
    }
    return sendTelegramMessage(botToken, chatId, 'Toko diperbarui.');
  }

  if (text.startsWith('/kategori')) {
    const newCat = text.replace(/^\/kategori(@\S+)?\s*/i, '').trim();
    if (!newCat) {
      return sendTelegramMessage(botToken, chatId, '🏷️ Ketik: `/kategori [nama kategori]`\nContoh: `/kategori Food` atau `/kategori Shopping`');
    }
    if (db) {
      const snap = await db.collection('users').doc(uid).collection('transactions').orderBy('createdAt', 'desc').limit(1).get();
      if (snap.empty) return sendTelegramMessage(botToken, chatId, '🤷 Belum ada transaksi yang bisa diubah.');
      await snap.docs[0].ref.update({ category: newCat });
      return sendTelegramMessage(
        botToken,
        chatId,
        `🏷️ *Kategori Diperbarui Pocky!*\nKini menjadi: *${escapeMarkdown(newCat)}*`,
        { reply_markup: KEYBOARD }
      );
    }
    return sendTelegramMessage(botToken, chatId, 'Kategori diperbarui.');
  }

  // /budget command — custom label per item, inline menu
  if (cmdText === '/budget' || cmdText.startsWith('/budget ')) {
    const args = text.replace(/^\/budget(@\S+)?\s*/i, '').trim();
    if (!db) return sendTelegramMessage(botToken, chatId, 'Mode demo aktif.');

    // /budget hapus <label>
    const hapusMatch = args.match(/^hapus\s+(.+)/i);
    if (hapusMatch) {
      const rawLabel = hapusMatch[1].trim().toLowerCase();
      const userRef = db.collection('users').doc(uid);
      let snap = await userRef.collection('budgets').get();
      if (snap.empty && uid !== `tg_${chatId}`) {
        snap = await db.collection('users').doc(`tg_${chatId}`).collection('budgets').get();
      }
      const targetDoc = snap.docs.find(d => {
        const b = d.data();
        const label = (b.customLabel || b.rawCategory || b.category || '').toLowerCase();
        return label === rawLabel || label.includes(rawLabel);
      });
      if (!targetDoc) return sendTelegramMessage(botToken, chatId, `🤷 Budget *${escapeMarkdown(hapusMatch[1].trim())}* tidak ditemukan.`);
      const catLabel = targetDoc.data().customLabel || targetDoc.data().rawCategory || targetDoc.data().category || hapusMatch[1].trim();
      await targetDoc.ref.delete();
      return sendTelegramMessage(botToken, chatId, `🗑️ Budget *${escapeMarkdown(catLabel)}* dihapus.`, { reply_markup: KEYBOARD });
    }

    // /budget <label> <amount> — set budget with custom label
    const setMatch = args.match(/^(.+?)\s+([\d.,]+(?:k|rb|jt|juta|ribu)?(?:\d*)?)$/i);
    if (setMatch) {
      const rawLabel = setMatch[1].trim();
      const limit = parseAmount(setMatch[2]);
      if (!limit || limit <= 0) return sendTelegramMessage(botToken, chatId, '❌ Nominal budget tidak valid.');

      const keywords = rawLabel.toLowerCase().split(/\s+/)
        .map(w => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')).filter(Boolean)
        .filter(w => w.length >= 3 && !['beli', 'membeli', 'buat', 'untuk'].includes(w));
      // Also add guessed category as keyword for cross-language matching
      const guessedCat = guessBudgetCategory(rawLabel).category.toLowerCase();
      if (guessedCat !== 'other' && !keywords.includes(guessedCat)) keywords.push(guessedCat);

      const userRef = db.collection('users').doc(uid);
      const snap = await userRef.collection('budgets').get();
      const existingDoc = snap.docs.find(d => (d.data().customLabel || '').toLowerCase() === rawLabel.toLowerCase());

      const budgetData = {
        customLabel: rawLabel, keywords, monthlyLimit: limit, amount: limit,
        category: guessBudgetCategory(rawLabel).category, rawCategory: rawLabel
      };

      if (!existingDoc) {
        await userRef.collection('budgets').add({ ...budgetData, createdAt: new Date().toISOString() });
      } else {
        await existingDoc.ref.set({ ...budgetData, updatedAt: new Date().toISOString() }, { merge: true });
      }

      return sendTelegramMessage(botToken, chatId,
        `💰 *Budget "${escapeMarkdown(rawLabel)}" diatur!*\n` +
        `Batas bulanan: *${formatRupiah(limit)}*\n` +
        `Keyword: ${keywords.map(k => `\`${k}\``).join(', ') || '_—_'}\n\n` +
        `_Pocky akan kirim peringatan otomatis jika pengeluaran mencapai 80% dan 100%!_`,
        { reply_markup: KEYBOARD }
      );
    }

    // /budget (no args) — show inline menu
    return handleBudgetList(chatId, uid, db, botToken, null);
  }

  // Bare commands without arguments → friendly guidance
  if (['/catat', '/keluar', '/expense'].includes(cmdText)) {
    const res = await sendTelegramMessage(botToken, chatId,
      `📝 *Cara catat pengeluaran:*\n\n\`/catat 25k kopi susu\`\n\`/catat makan siang 35rb\`\n\`kopi 15k\` _(tanpa command juga bisa!)_\n\nFormat: \`/catat [nominal] [keterangan]\` atau sebaliknya`,
      { reply_markup: KEYBOARD });
    if (res?.result?.message_id) queueTempMessage(db, chatId, res.result.message_id, 60);
    return res;
  }
  if (['/masuk', '/income'].includes(cmdText)) {
    const res = await sendTelegramMessage(botToken, chatId,
      `💰 *Cara catat pemasukan:*\n\n\`/masuk 2.5jt gaji bulanan\`\n\`/masuk freelance 500k\`\n\nFormat: \`/masuk [nominal] [keterangan]\` atau sebaliknya`,
      { reply_markup: KEYBOARD });
    if (res?.result?.message_id) queueTempMessage(db, chatId, res.result.message_id, 60);
    return res;
  }

  const parsed = parseTransactionCommand(text);
  if (parsed) {
    if (parsed.type === 'Expense' && db && uid) {
      const { bal } = await getBalance(uid, db);
      if (bal <= 0) {
        return sendTelegramMessage(botToken, chatId,
          `🚫 *Saldo tidak cukup*\n\n💳 Saldomu saat ini: *${formatRupiah(bal)}*\n\nTambah pemasukan dulu sebelum mencatat pengeluaran.\nContoh: \`/masuk gaji 2jt\``
        );
      }
      if (bal - parsed.amount < 0) {
        return sendTelegramMessage(botToken, chatId,
          `🚫 *Saldo tidak cukup*\n\n💳 Saldo: *${formatRupiah(bal)}*\n💸 Pengeluaran: *${formatRupiah(parsed.amount)}*\n📉 Kurang: *${formatRupiah(parsed.amount - bal)}*\n\nTambah pemasukan dulu atau kurangi nominal.`
        );
      }
    }
    let budgetInfo = null;
    if (db) await db.collection('users').doc(uid).collection('transactions').add(parsed);
    await maybeSendLinkNudge(chatId, uid, db, botToken);
    if (parsed.type === 'Expense') {
      budgetInfo = await checkBudgetWarnings(chatId, uid, db, botToken, parsed.category, parsed.description);
    }
    await handleStreakAfterTransaction(chatId, uid, db, botToken);
    if (parsed.type === 'Income') {
      return sendTelegramMessage(
        botToken,
        chatId,
        `🎉 *Yey, Pemasukan Dicatat Pocky!* 💰\n🟢 +*${formatRupiah(parsed.amount)}*\n📝 *${escapeMarkdown(parsed.description)}*\n📁 ${escapeMarkdown(parsed.category)} • 📅 ${formatShortDate(parsed.date)}`
      );
    }
    let budgetText = '';
    if (budgetInfo) {
      budgetText = `\n\nMasuk budget *${escapeMarkdown(budgetInfo.category)}*: ${formatRupiah(budgetInfo.total)} / ${formatRupiah(budgetInfo.limit)} (${budgetInfo.pct}%)`;
    }
    return sendTelegramMessage(
      botToken,
      chatId,
      `💸 *Pengeluaran Dicatat Pocky!* ✨\n🔴 -*${formatRupiah(parsed.amount)}*\n📝 *${escapeMarkdown(parsed.description)}*\n📁 ${escapeMarkdown(parsed.category)} • 📅 ${formatShortDate(parsed.date)}${budgetText}\n\n💡 _Salah catat? Ketik \`/batal\` buat menghapus._`
    );
  }

  const unkRes = await sendTelegramMessage(
    botToken,
    chatId,
    `❓ *Perintah tidak dikenali*\n\nBerikut contoh yang bisa kamu ketik:\n📝 \`kopi susu 25k\` — catat pengeluaran\n💰 \`/masuk gaji 2jt\` — catat pemasukan\n🎯 \`/goal Laptop 10jt\` — buat target\n\nKetik /help untuk panduan lengkap 📖`,
    { reply_markup: KEYBOARD }
  );
  if (unkRes?.result?.message_id) queueTempMessage(db, chatId, unkRes.result.message_id, 60);
  return unkRes;
}

// --- Budget inline menu handler (bdg:*) ---
async function handleBudgetList(chatId, uid, db, botToken, messageId, headerNote = '') {
  if (!db) return;
  try {
    const budgetDocs = [];
    const budgetSnap = await db.collection('users').doc(uid).collection('budgets').get();
    budgetDocs.push(...budgetSnap.docs);
    if (uid !== `tg_${chatId}`) {
      const altSnap = await db.collection('users').doc(`tg_${chatId}`).collection('budgets').get();
      if (!altSnap.empty) {
        migrateTelegramDataToUser(chatId, uid, db).catch(() => {});
        altSnap.docs.forEach(d => { if (!budgetDocs.some(x => x.id === d.id)) budgetDocs.push(d); });
      }
    }
    const menuKb = { inline_keyboard: [[{ text: '➕ Buat Budget Baru', callback_data: 'bdg:buat' }]] };
    if (budgetDocs.length === 0) {
      const txt = headerNote + '💰 *BUDGET SAYA*\n\nBelum ada budget. Buat budget baru!';
      if (messageId) return editTelegramMessage(botToken, chatId, messageId, txt, { reply_markup: menuKb });
      return sendTelegramMessage(botToken, chatId, txt, { reply_markup: menuKb });
    }
    const now = new Date();
    const monthKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(now).slice(0, 7);
    const seenTx = new Set(); const txDocs = [];
    const txSnap = await db.collection('users').doc(uid).collection('transactions').get();
    txSnap.docs.forEach(d => { seenTx.add(d.id); txDocs.push(d); });
    if (uid !== `tg_${chatId}`) {
      const altTxSnap = await db.collection('users').doc(`tg_${chatId}`).collection('transactions').get();
      altTxSnap.docs.forEach(d => { if (!seenTx.has(d.id)) { seenTx.add(d.id); txDocs.push(d); } });
    }
    let out = headerNote + `💰 *Budget Bulan Ini (${monthKey})*\n\n`;
    const buttons = [];
    for (const bDoc of budgetDocs) {
      const b = bDoc.data();
      const lim = Number(b.monthlyLimit || b.amount) || 0;
      const label = b.customLabel || b.rawCategory || b.category || 'Budget';
      const bPeriod = getBudgetPeriod(b.createdAt, monthKey);
      const allKw = [...(b.keywords || []).map(k => k.toLowerCase()), ...label.toLowerCase().split(/\s+/).filter(w => w.length >= 2)];
      let spent = 0;
      txDocs.forEach(d => {
        const t = d.data();
        const txDate = (t.date || t.createdAt || '').slice(0, 10);
        if ((t.type || '').toLowerCase() === 'expense' && getTxMonth(t) === monthKey && txDate >= bPeriod.startStr) {
          const txText = `${t.description || ''} ${t.category || ''}`.toLowerCase();
          if (allKw.some(kw => txText.includes(kw))) spent += Number(t.amount) || 0;
        }
      });
      const pct = lim > 0 ? Math.round((spent / lim) * 100) : 0;
      const si = pct >= 100 ? '🚨' : pct >= 80 ? '⚠️' : '✅';
      out += `${si} *${escapeMarkdown(label)}*\n   ${formatRupiah(spent)} / ${formatRupiah(lim)} (${pct}%)\n   📅 Berlaku: ${bPeriod.display}\n   ${renderBar(spent, lim)}\n\n`;
      buttons.push([
        { text: `👁️ ${label.slice(0, 18)}`, callback_data: `bdg:detail:${bDoc.id}` },
        { text: '🗑️ Hapus Budget', callback_data: `bdg:hapus_prompt:${bDoc.id}` }
      ]);
    }
    buttons.push([{ text: '➕ Buat Budget Baru', callback_data: 'bdg:buat' }]);
    if (messageId) return editTelegramMessage(botToken, chatId, messageId, out, { reply_markup: { inline_keyboard: buttons } });
    return sendTelegramMessage(botToken, chatId, out, { reply_markup: { inline_keyboard: buttons } });
  } catch (err) {
    console.error('budget list error:', err?.message);
    return sendTelegramMessage(botToken, chatId, `⚠️ Gagal memuat budget: ${err?.message}`);
  }
}

async function handleBudgetCallback(data, botToken, chatId, messageId, uid, db) {
  if (data === 'bdg:list' || data === 'bdg:kembali') {
    clearPendingBudget(chatId);
    return handleBudgetList(chatId, uid, db, botToken, messageId);
  }
  if (data === 'bdg:buat') {
    const txt = '💰 *Buat Budget Baru*\n\nMau budget untuk apa? Ketik labelnya.\nContoh: `beli laptop`, `makan luar`, `transport`';
    if (messageId) {
      setPendingBudget(chatId, { step: 'label', promptMsgId: messageId });
      return editTelegramMessage(botToken, chatId, messageId, txt, { reply_markup: { inline_keyboard: [[{ text: '❌ Batal', callback_data: 'bdg:list' }]] } });
    }
    const sent = await sendTelegramMessage(botToken, chatId, txt, { reply_markup: { inline_keyboard: [[{ text: '❌ Batal', callback_data: 'bdg:list' }]] } });
    if (sent?.result?.message_id) setPendingBudget(chatId, { step: 'label', promptMsgId: sent.result.message_id });
    return sent;
  }
  if (data.startsWith('bdg:detail:')) {
    const bId = data.replace('bdg:detail:', '');
    if (!db) return;
    try {
      const bDocRef = db.collection('users').doc(uid).collection('budgets').doc(bId);
      const bSnap = typeof bDocRef.get === 'function' ? await bDocRef.get() : bDocRef;
      const b = typeof bSnap.data === 'function' ? bSnap.data() : (typeof bDocRef.data === 'function' ? bDocRef.data() : null);
      if (!b || (!b.customLabel && !b.rawCategory && !b.category)) {
        if (messageId) return editTelegramMessage(botToken, chatId, messageId, '❌ Budget tidak ditemukan.', { reply_markup: { inline_keyboard: [[{ text: '⬅️ Kembali', callback_data: 'bdg:list' }]] } });
        return;
      }
      const label = b.customLabel || b.rawCategory || b.category || 'Budget';
      const lim = Number(b.monthlyLimit || b.amount) || 0;
      const keywords = b.keywords || [];
      const monthKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date()).slice(0, 7);
      const bPeriod = getBudgetPeriod(b.createdAt, monthKey);

      const txDocs = [];
      const seenTx = new Set();
      const txSnap = await db.collection('users').doc(uid).collection('transactions').get();
      txSnap.docs.forEach(d => { seenTx.add(d.id); txDocs.push(d); });
      if (uid !== `tg_${chatId}`) {
        const altTxSnap = await db.collection('users').doc(`tg_${chatId}`).collection('transactions').get();
        altTxSnap.docs.forEach(d => { if (!seenTx.has(d.id)) { seenTx.add(d.id); txDocs.push(d); } });
      }

      const allKw = [...keywords.map(k => k.toLowerCase()), ...label.toLowerCase().split(/\s+/).filter(w => w.length >= 2)];
      let spent = 0;
      txDocs.forEach(d => {
        const t = d.data();
        const txDate = (t.date || t.createdAt || '').slice(0, 10);
        if ((t.type || '').toLowerCase() === 'expense' && getTxMonth(t) === monthKey && txDate >= bPeriod.startStr) {
          const txText = `${t.description || ''} ${t.category || ''}`.toLowerCase();
          if (allKw.some(kw => txText.includes(kw))) spent += Number(t.amount) || 0;
        }
      });
      const pct = lim > 0 ? Math.round((spent / lim) * 100) : 0;
      const si = pct >= 100 ? '🚨' : pct >= 80 ? '⚠️' : '✅';
      const sisa = Math.max(0, lim - spent);

      const txt = `💻 *BUDGET: ${escapeMarkdown(label)}*\n\n` +
        `📝 *Keterangan:* ${escapeMarkdown(b.description || `Budget khusus untuk ${label}.`)}\n` +
        `   *Dibuat:* ${formatIndoDate(bPeriod.createdDate)}\n` +
        `   *Berlaku:* ${bPeriod.display}\n\n` +
        `💰 *Terpakai:* ${formatRupiah(spent)} / ${formatRupiah(lim)} (${pct}%) ${si}\n` +
        `💵 *Sisa:* ${formatRupiah(sisa)}\n` +
        `🔑 *Keyword:* ${keywords.map(k => `\`${k}\``).join(', ') || '_—_'}`;

      const btns = [
        [
          { text: '✏️ Ubah Limit', callback_data: `bdg:limit:${bId}` },
          { text: '🗑️ Hapus Budget', callback_data: `bdg:hapus_prompt:${bId}` }
        ],
        [{ text: '⬅️ Kembali', callback_data: 'bdg:list' }]
      ];
      if (messageId) return editTelegramMessage(botToken, chatId, messageId, txt, { reply_markup: { inline_keyboard: btns } });
      return sendTelegramMessage(botToken, chatId, txt, { reply_markup: { inline_keyboard: btns } });
    } catch (err) { console.error('bdg:detail error:', err?.message); }
  }
  if (data.startsWith('bdg:hapus_prompt:') || (data.startsWith('bdg:hapus:') && !data.startsWith('bdg:hapus_confirm:'))) {
    const bId = data.replace(/^bdg:(hapus_prompt|hapus):/, '');
    if (!db) return;
    try {
      const bDocRef = db.collection('users').doc(uid).collection('budgets').doc(bId);
      const bSnap = typeof bDocRef.get === 'function' ? await bDocRef.get() : bDocRef;
      const b = typeof bSnap.data === 'function' ? bSnap.data() : (typeof bDocRef.data === 'function' ? bDocRef.data() : null);
      const label = b?.customLabel || b?.rawCategory || b?.category || 'Budget';
      const txt = `⚠️ *Konfirmasi Hapus Budget*\n\nYakin hapus budget *'${escapeMarkdown(label)}'*?\nTransaksi yang sudah tercatat TIDAK ikut terhapus.`;
      const kb = {
        inline_keyboard: [
          [
            { text: '✅ Ya, hapus', callback_data: `bdg:hapus_confirm:${bId}` },
            { text: '❌ Batal', callback_data: `bdg:detail:${bId}` }
          ]
        ]
      };
      if (messageId) return editTelegramMessage(botToken, chatId, messageId, txt, { reply_markup: kb });
      return sendTelegramMessage(botToken, chatId, txt, { reply_markup: kb });
    } catch (err) { console.error('bdg:hapus_prompt error:', err?.message); }
  }
  if (data.startsWith('bdg:hapus_confirm:')) {
    const bId = data.replace('bdg:hapus_confirm:', '');
    if (!db) return;
    try {
      const bDocRef = db.collection('users').doc(uid).collection('budgets').doc(bId);
      const bSnap = typeof bDocRef.get === 'function' ? await bDocRef.get() : bDocRef;
      const bData = typeof bSnap.data === 'function' ? bSnap.data() : (typeof bDocRef.data === 'function' ? bDocRef.data() : null);
      const label = bData?.customLabel || bData?.rawCategory || bData?.category || 'Budget';
      const deleteRef = bDocRef.ref || bDocRef;
      if (typeof deleteRef.delete === 'function') {
        await deleteRef.delete();
      }
      return handleBudgetList(chatId, uid, db, botToken, messageId, `🗑️ Budget *${escapeMarkdown(label)}* berhasil dihapus.\nTransaksi yang sudah tercatat TIDAK ikut terhapus.\n\n`);
    } catch (err) { console.error('bdg:hapus_confirm error:', err?.message); }
  }
  if (data.startsWith('bdg:limit:')) {
    const bId = data.replace('bdg:limit:', '');
    setPendingBudget(chatId, { step: 'limit', budgetId: bId, promptMsgId: messageId });
    const txt = '✏️ *Ubah Limit Budget*\n\nKetik nominal baru.\nContoh: `500k`, `1.5jt`';
    if (messageId) return editTelegramMessage(botToken, chatId, messageId, txt, { reply_markup: { inline_keyboard: [[{ text: '❌ Batal', callback_data: `bdg:detail:${bId}` }]] } });
    const sent = await sendTelegramMessage(botToken, chatId, txt, { reply_markup: { inline_keyboard: [[{ text: '❌ Batal', callback_data: `bdg:detail:${bId}` }]] } });
    if (sent?.result?.message_id) setPendingBudget(chatId, { step: 'limit', budgetId: bId, promptMsgId: sent.result.message_id });
    return sent;
  }
}

// --- Riwayat search handler (cr:*) ---
async function handleRiwayatSearch(keyword, chatId, uid, db, botToken) {
  if (!db || !uid) return;
  const kw = keyword.toLowerCase();
  const txSnap = await db.collection('users').doc(uid).collection('transactions').get();
  const results = [];
  txSnap.docs.forEach(d => {
    const t = d.data();
    const txText = `${t.description || ''} ${t.category || ''}`.toLowerCase();
    if (txText.includes(kw)) results.push(t);
  });
  results.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const top = results.slice(0, 10);

  const prevSearchMsgId = lastSearchMsgMap.get(String(chatId));
  if (prevSearchMsgId) {
    deleteTelegramMessage(botToken, chatId, prevSearchMsgId).catch(() => {});
    lastSearchMsgMap.delete(String(chatId));
  }

  if (top.length === 0) {
    const res = await sendTelegramMessage(botToken, chatId,
      `🔍 Tidak ketemu transaksi dengan kata "${escapeMarkdown(keyword)}".\nCoba kata lain.`,
      { reply_markup: { inline_keyboard: [[{ text: '⬅️ Kembali ke Riwayat', callback_data: 'cr:kembali' }]] } }
    );
    if (res?.result?.message_id) {
      lastSearchMsgMap.set(String(chatId), res.result.message_id);
      queueTempMessage(db, chatId, res.result.message_id, 60);
    }
    return res;
  }
  let out = `🔍 *Hasil pencarian "${escapeMarkdown(keyword)}":*\n\n`;
  for (const t of top) {
    const sign = t.type === 'Income' ? '🟢 +' : '🔴 -';
    out += `📅 ${formatShortDate(t.date)} — ${sign}*${formatRupiah(t.amount)}*\n   ${escapeMarkdown(t.description || t.category)}\n\n`;
  }
  if (results.length > 10) out += `_...dan ${results.length - 10} lagi_\n`;
  const res = await sendTelegramMessage(botToken, chatId, out,
    { reply_markup: { inline_keyboard: [[{ text: '⬅️ Kembali ke Riwayat', callback_data: 'cr:kembali' }]] } }
  );
  if (res?.result?.message_id) {
    lastSearchMsgMap.set(String(chatId), res.result.message_id);
  }
  return res;
}

async function sendSaldo(chatId, uid, db, botToken) {
  const { bal, inc, exp } = await getBalance(uid, db);
  const text = `💳 *Dompet Pocketplan*\n\n💰 *Saldo:* \`${formatRupiah(bal)}\`\n🟢 Pemasukan: ${formatRupiah(inc)}\n🔴 Pengeluaran: ${formatRupiah(exp)}\n\n_Uang tercatat rapi, masa depan tenang._`;
  return sendTelegramMessage(botToken, chatId, text, {
    reply_markup: { inline_keyboard: [[{ text: '🎯 Lihat Target Impian', callback_data: 'goals' }]] }
  });
}

async function sendGoals(chatId, uid, db, botToken, messageId = null) {
  const { bal } = await getBalance(uid, db);
  let goals = [];
  if (db && uid) {
    const gSnap = await db.collection('users').doc(uid).collection('goals').get();
    goals = gSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  const menuKb = {
    inline_keyboard: [
      [{ text: '➕ Buat Goal Baru', callback_data: 'gol:buat' }]
    ]
  };

  if (goals.length === 0) {
    const emptyText = '🎯 *TARGET IMPIANMU*\n' +
      `💵 Saldo Tersedia: *${formatRupiah(bal)}*\n\n` +
      '_Belum ada target impian._\nBuat target impianmu sekarang yuk! ✨';
    if (messageId) {
      return editTelegramMessage(botToken, chatId, messageId, emptyText, { reply_markup: menuKb });
    }
    return sendTelegramMessage(botToken, chatId, emptyText, { reply_markup: menuKb });
  }

  let text = `🎯 *TARGET IMPIANMU*\n💵 Saldo Tersedia: *${formatRupiah(bal)}*\n\n`;
  const buttons = [];
  goals.forEach((g, i) => {
    const tgt = Number(g.target) || 1;
    const done = bal >= tgt;
    const sisa = Math.max(0, tgt - bal);
    text += `${i + 1}. *${escapeMarkdown(g.name)}*\n   Target: ${formatRupiah(tgt)}\n   Progres: ${renderBar(bal, tgt)}${done ? ' 🏆 *BISA DIBELI!*' : `\n   Sisa: ${formatRupiah(sisa)}`}\n\n`;
    const row = [{ text: `👁️ ${g.name.slice(0, 18)}`, callback_data: `gol:detail:${g.id}` }];
    if (done) row.push({ text: '🛍️ Beli', callback_data: `gol:beli:${g.id}` });
    buttons.push(row);
  });
  buttons.push([{ text: '➕ Buat Goal Baru', callback_data: 'gol:buat' }]);

  if (messageId) {
    return editTelegramMessage(botToken, chatId, messageId, text, {
      reply_markup: { inline_keyboard: buttons }
    });
  }
  return sendTelegramMessage(botToken, chatId, text, {
    reply_markup: { inline_keyboard: buttons }
  });
}

async function handleGoalCallback(data, botToken, chatId, messageId, uid, db) {
  if (data === 'gol:list' || data === 'gol:kembali' || data === 'goals') {
    clearPendingGoal(chatId);
    return sendGoals(chatId, uid, db, botToken, messageId);
  }

  if (data === 'gol:buat') {
    const txt = '🎯 *Buat Target Impian Baru*\n\nMau menabung untuk apa? Ketik nama targetnya.\nContoh: `Laptop Baru`, `Sepatu Lari`, `Liburan`';
    if (messageId) {
      setPendingGoal(chatId, { step: 'name', promptMsgId: messageId });
      return editTelegramMessage(botToken, chatId, messageId, txt, {
        reply_markup: { inline_keyboard: [[{ text: '❌ Batal', callback_data: 'gol:list' }]] }
      });
    }
    const sent = await sendTelegramMessage(botToken, chatId, txt, {
      reply_markup: { inline_keyboard: [[{ text: '❌ Batal', callback_data: 'gol:list' }]] }
    });
    if (sent?.result?.message_id) setPendingGoal(chatId, { step: 'name', promptMsgId: sent.result.message_id });
    return sent;
  }

  if (data.startsWith('gol:detail:')) {
    const gId = data.replace('gol:detail:', '');
    if (!db) return;
    try {
      const gDocRef = db.collection('users').doc(uid).collection('goals').doc(gId);
      const gSnap = typeof gDocRef.get === 'function' ? await gDocRef.get() : gDocRef;
      const g = typeof gSnap.data === 'function' ? gSnap.data() : (typeof gDocRef.data === 'function' ? gDocRef.data() : null);
      if (!g || !g.name) {
        if (messageId) return editTelegramMessage(botToken, chatId, messageId, '❌ Target tidak ditemukan.', { reply_markup: { inline_keyboard: [[{ text: '⬅️ Kembali', callback_data: 'gol:list' }]] } });
        return;
      }

      const { bal } = await getBalance(uid, db);
      const tgt = Number(g.target) || 0;
      const done = tgt > 0 && bal >= tgt;
      const sisa = Math.max(0, tgt - bal);
      const pct = tgt > 0 ? Math.min(100, Math.round((Math.max(0, bal) / tgt) * 100)) : 0;

      const txt = `🎯 *DETAIL TARGET: ${escapeMarkdown(g.name)}*\n\n` +
        `💵 *Target Nominal:* ${formatRupiah(tgt)}\n` +
        `💳 *Saldo Tersedia:* ${formatRupiah(bal)}\n` +
        `📊 *Progres:* ${renderBar(bal, tgt)} (${pct}%)\n` +
        `📉 *Sisa Dibutuhkan:* ${formatRupiah(sisa)}\n` +
        `🏆 *Status:* ${done ? '🎉 *Sudah cukup, siap dibeli!*' : '⏳ *Sedang dikumpulkan*'}\n\n` +
        `_Pilih tindakan di bawah:_`;

      const btns = [
        [
          { text: '✏️ Ubah Target', callback_data: `gol:ubah:${gId}` },
          { text: '🗑️ Hapus Target', callback_data: `gol:hapus_prompt:${gId}` }
        ]
      ];
      if (done) {
        btns.push([{ text: '💰 Beli / Tandai Selesai 🎉', callback_data: `gol:beli:${gId}` }]);
      }
      btns.push([{ text: '⬅️ Kembali ke Daftar Target', callback_data: 'gol:list' }]);

      if (messageId) return editTelegramMessage(botToken, chatId, messageId, txt, { reply_markup: { inline_keyboard: btns } });
      return sendTelegramMessage(botToken, chatId, txt, { reply_markup: { inline_keyboard: btns } });
    } catch (err) {
      console.error('gol:detail error:', err?.message);
    }
  }

  if (data.startsWith('gol:ubah:')) {
    const gId = data.replace('gol:ubah:', '');
    setPendingGoal(chatId, { step: 'edit_target', goalId: gId, promptMsgId: messageId });
    const txt = '✏️ *Ubah Nominal Target*\n\nKetik nominal target baru:\nContoh: `12jt`, `15000000`, `750k`';
    if (messageId) return editTelegramMessage(botToken, chatId, messageId, txt, { reply_markup: { inline_keyboard: [[{ text: '❌ Batal', callback_data: `gol:detail:${gId}` }]] } });
    const sent = await sendTelegramMessage(botToken, chatId, txt, { reply_markup: { inline_keyboard: [[{ text: '❌ Batal', callback_data: `gol:detail:${gId}` }]] } });
    if (sent?.result?.message_id) setPendingGoal(chatId, { step: 'edit_target', goalId: gId, promptMsgId: sent.result.message_id });
    return sent;
  }

  if (data.startsWith('gol:hapus_prompt:')) {
    const gId = data.replace('gol:hapus_prompt:', '');
    if (!db) return;
    try {
      const gDocRef = db.collection('users').doc(uid).collection('goals').doc(gId);
      const gSnap = typeof gDocRef.get === 'function' ? await gDocRef.get() : gDocRef;
      const g = typeof gSnap.data === 'function' ? gSnap.data() : (typeof gDocRef.data === 'function' ? gDocRef.data() : null);
      const name = g?.name || 'Target';
      const txt = `⚠️ *Konfirmasi Hapus Target*\n\nYakin ingin menghapus target *'${escapeMarkdown(name)}'*?\nTarget yang dihapus tidak dapat dikembalikan.`;
      const kb = {
        inline_keyboard: [
          [
            { text: '✅ Ya, Hapus', callback_data: `gol:hapus_confirm:${gId}` },
            { text: '❌ Batal', callback_data: `gol:detail:${gId}` }
          ]
        ]
      };
      if (messageId) return editTelegramMessage(botToken, chatId, messageId, txt, { reply_markup: kb });
      return sendTelegramMessage(botToken, chatId, txt, { reply_markup: kb });
    } catch (err) {
      console.error('gol:hapus_prompt error:', err?.message);
    }
  }

  if (data.startsWith('gol:hapus_confirm:')) {
    const gId = data.replace('gol:hapus_confirm:', '');
    if (!db) return;
    try {
      const gDocRef = db.collection('users').doc(uid).collection('goals').doc(gId);
      await (typeof gDocRef.delete === 'function' ? gDocRef.delete() : (gDocRef.ref ? gDocRef.ref.delete() : null));
      return sendGoals(chatId, uid, db, botToken, messageId);
    } catch (err) {
      console.error('gol:hapus_confirm error:', err?.message);
    }
  }

  if (data.startsWith('gol:beli:') || data.startsWith('buy:')) {
    const gId = data.replace(/^gol:beli:|^buy:/, '');
    if (!db) return;
    try {
      const gDocRef = db.collection('users').doc(uid).collection('goals').doc(gId);
      const gSnap = typeof gDocRef.get === 'function' ? await gDocRef.get() : gDocRef;
      const g = typeof gSnap.data === 'function' ? gSnap.data() : (typeof gDocRef.data === 'function' ? gDocRef.data() : null);
      if (!g) {
        if (messageId) return editTelegramMessage(botToken, chatId, messageId, '❌ Target tidak ditemukan.', { reply_markup: { inline_keyboard: [[{ text: '⬅️ Kembali', callback_data: 'gol:list' }]] } });
        return;
      }
      const amt = Number(g.target) || 0;
      const { bal } = await getBalance(uid, db);
      if (bal < amt) {
        const msg = `🚫 *Saldo tidak cukup untuk beli ${escapeMarkdown(g.name)}*\n\n💳 Saldo: *${formatRupiah(bal)}*\n🎯 Harga: *${formatRupiah(amt)}*\n📉 Kurang: *${formatRupiah(amt - bal)}*\n\nTambah pemasukan dulu ya!`;
        if (messageId) return editTelegramMessage(botToken, chatId, messageId, msg, { reply_markup: { inline_keyboard: [[{ text: '⬅️ Kembali', callback_data: `gol:detail:${gId}` }]] } });
        return sendTelegramMessage(botToken, chatId, msg);
      }
      await db.collection('users').doc(uid).collection('transactions').add({
        category: 'Shopping',
        type: 'Expense',
        amount: amt,
        description: `Pembelian Goal: ${g.name}`,
        date: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
        goalBackup: { name: g.name, target: g.target, amount: g.amount || 0, type: g.type || 'Saving', createdAt: g.createdAt || new Date().toISOString() }
      });
      await (gSnap.ref ? gSnap.ref.delete() : (typeof gDocRef.delete === 'function' ? gDocRef.delete() : null));
      const successTxt = `🥳 *Impian Tercapai!* 🎉\n\n*${escapeMarkdown(g.name)}* (${formatRupiah(amt)}) berhasil dibeli!\n\n✅ Pengeluaran dicatat\n🎯 Target selesai & diarsipkan\n\nHebat, nabungmu membuahkan hasil!`;
      if (messageId) {
        return editTelegramMessage(botToken, chatId, messageId, successTxt, {
          reply_markup: { inline_keyboard: [[{ text: '🎯 Daftar Target Impian', callback_data: 'gol:list' }]] }
        });
      }
      return sendTelegramMessage(botToken, chatId, successTxt);
    } catch (err) {
      console.error('gol:beli error:', err?.message);
    }
  }
}

async function sendWebAccess(chatId, uid, db, botToken) {
  const strChatId = String(chatId);
  const targetUid = uid || `tg_${strChatId}`;

  // Check if unlinked / unverified Telegram user
  let uData = {};
  if (db) {
    try {
      const userDoc = await db.collection('users').doc(targetUid).get();
      uData = (userDoc && userDoc.exists) ? (userDoc.data() || {}) : {};
    } catch (_) {}
  } else {
    const unlinked = demoUnlinkedUsers.get(targetUid);
    if (unlinked) uData = { ...unlinked };
  }

  if (uData.needsEmailVerification || (uData.unlinkedAt && !uData.emailVerified)) {
    return sendTelegramMessage(botToken, chatId,
      '📧 *Verifikasi Email Diperlukan*\n\n' +
      'Akun Telegram kamu belum terverifikasi.\n' +
      'Buka website Pocketplan → daftar dengan email → verifikasi → buat password.\n' +
      'Setelah itu akun bot dan web akan terhubung otomatis.'
    );
  }

  const { code, expiresAt } = await generateWebLoginCode(targetUid, db);
  const expiryDate = new Date(expiresAt);
  const timeStr = expiryDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
  const text = `🌐 *Kode Login Website Pocketplan*\n\n` +
    `Buka Pocketplan di browser, pilih tab *Telegram*, lalu masukkan kode ini:\n\n` +
    `🔑 *KODE:* \`${code}\`\n\n` +
    `⏱️ *Berlaku:* 15 Menit (Kedaluwarsa pukul *${timeStr} WIB*)\n` +
    `💡 _Segera masukkan kode di website sebelum waktu habis ya!_`;
  const sent = await sendTelegramMessage(botToken, chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🔄 Buat Kode Baru', callback_data: 'refresh_web_code' },
          { text: '❌ Batalkan Kode', callback_data: `cancel_web_code:${code}` }
        ]
      ]
    }
  });
  if (sent?.result?.message_id) {
    await attachMessageToWebCode(code, sent.result.message_id, chatId, db);
    queueTempMessage(db, chatId, sent.result.message_id, 900);
  }
  return sent;
}

export function generateMorningReminder(userName, balance = 0, goals = [], streakDays = 0) {
  const name = escapeMarkdown(userName || 'Teman');
  const goalsList = Array.isArray(goals) ? goals.filter(Boolean) : (goals && goals.name ? [goals] : []);

  let goalText = '';
  if (goalsList.length === 1) {
    const g = goalsList[0];
    const tgt = Number(g.target) || 0;
    const cur = tgt > 0 ? Math.min(Math.max(0, balance), tgt) : 0;
    const pct = tgt > 0 ? Math.min(100, Math.round((Math.max(0, balance) / tgt) * 100)) : 0;
    const isDone = tgt > 0 && balance >= tgt;
    const status = isDone ? ' 🏆 *BISA DIBELI!*' : ` • ${pct}%`;
    goalText = `\n🎯 *Target Tabungan:* ${escapeMarkdown(g.name)} (${formatRupiah(cur)} / ${formatRupiah(tgt)}${status})\n`;
  } else if (goalsList.length > 1) {
    goalText = `\n🎯 *Target Tabungan (${goalsList.length}):*\n`;
    goalsList.forEach((g) => {
      const tgt = Number(g.target) || 0;
      const cur = tgt > 0 ? Math.min(Math.max(0, balance), tgt) : 0;
      const pct = tgt > 0 ? Math.min(100, Math.round((Math.max(0, balance) / tgt) * 100)) : 0;
      const isDone = tgt > 0 && balance >= tgt;
      const badge = isDone ? ' 🏆 *BISA DIBELI!*' : ` • ${pct}%`;
      goalText += `• *${escapeMarkdown(g.name)}* (${formatRupiah(cur)} / ${formatRupiah(tgt)}${badge})\n`;
    });
  }

  const streakLine = streakDays >= 2 ? `\n🔥 *Streak:* ${streakDays} hari — jangan sampai putus!\n` : '';

  return (
    `🌅 *Selamat Pagi, ${name}!* ☀️\n\n` +
    `Pocky siap menemani harimu. Cek kondisi dompet sebelum beraktivitas ya:\n\n` +
    `💳 *Sisa Saldo:* \`${formatRupiah(balance)}\`\n` +
    goalText +
    streakLine +
    `\n💡 *Tips Pocky:* Jangan lupa catat setiap pengeluaran hari ini ya! Cukup ketik langsung seperti \`kopi 20k\` atau kirim foto struk belanjaanmu 🧾`
  );
}

export function generateEveningReminder(userName, summary = {}) {
  const name = escapeMarkdown(userName || 'Teman');
  const exp = Number(summary?.totalExpense) || 0;
  const inc = Number(summary?.totalIncome) || 0;
  const bal = Number(summary?.currentBalance) || 0;
  const count = Number(summary?.expenseCount) || 0;

  return (
    `🌙 *Waktunya Rekap Malam bareng Pocky!* ✨\n\n` +
    `Hai ${name}, yuk intip aktivitas keuanganmu hari ini:\n\n` +
    `🔴 *Total Pengeluaran:* \`${formatRupiah(exp)}\` (${count} transaksi)\n` +
    (inc > 0 ? `🟢 *Pemasukan Hari Ini:* \`${formatRupiah(inc)}\`\n` : '') +
    `💳 *Sisa Saldo:* \`${formatRupiah(bal)}\`\n\n` +
    (count === 0
      ? `🤔 *Belum ada catatan hari ini?*\nKalau tadi sempat jajan atau belanja, yuk catat sekarang sebelum lupa! Ketik langsung: \`makan siang 35k\` 📝`
      : `👍 *Catatan tercatat rapi!* Kalau ada belanjaan lain yang belum masuk, langsung kirim ke Pocky ya ✨`)
  );
}

export async function dispatchDailyReminders(db, botToken, type = 'morning', force = false, targetChatId = null) {
  if (!db || !botToken) return { sent: 0, skipped: 0 };
  const todayWib = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
  const nowIso = new Date().toISOString();
  if (type === 'morning') demoCronStatus.lastMorningRun = nowIso;
  else if (type === 'evening') demoCronStatus.lastEveningRun = nowIso;

  if (db) {
    const statusField = type === 'morning' ? 'lastMorningRun' : 'lastEveningRun';
    db.collection('system_meta').doc('cron_status').set({
      [statusField]: nowIso,
      updatedAt: nowIso
    }, { merge: true }).catch((err) => console.error('[reminder] Failed to record system_meta/cron_status:', err?.message));
  }

  const linkSnap = await db.collection('telegram_links').get();
  let sent = 0;
  let skipped = 0;
  const skipDetails = { disabled: 0, already_sent: 0, missing_user: 0, not_targeted: 0, error: 0 };

  let docs = linkSnap?.docs || [];
  if (targetChatId) {
    const matched = docs.find((d) => String(d.id) === String(targetChatId));
    if (!matched) {
      try {
        const tgUserDoc = await db.collection('users').doc(`tg_${targetChatId}`).get();
        if (tgUserDoc.exists) {
          docs = [{ id: String(targetChatId), data: () => ({ uid: `tg_${targetChatId}`, ...tgUserDoc.data() }) }];
        }
      } catch (err) {
        console.warn(`[reminder] Could not fallback to tg_${targetChatId}:`, err?.message);
      }
    }
  }

  const nowWib = new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'full',
    timeStyle: 'long',
    timeZone: 'Asia/Jakarta'
  }).format(new Date());

  console.log(`[cron-reminder] [${nowWib}] Eksekusi reminder '${type}' dimulai (force=${force}, targetChatId=${targetChatId || 'all'}). Total linked terdaftar: ${docs.length}`);

  for (const doc of docs) {
    const chatId = doc.id;
    if (targetChatId && String(chatId) !== String(targetChatId)) {
      skipped++;
      skipDetails.not_targeted++;
      continue;
    }
    const { uid, firstName, username } = doc.data() || {};
    if (!uid || !chatId) {
      skipped++;
      skipDetails.missing_user++;
      console.log(`[cron-reminder] Skip doc ${doc.id}: data tidak lengkap (missing uid atau chatId)`);
      continue;
    }

    try {
      const userRef = db.collection('users').doc(uid);
      const userDoc = await userRef.get();
      const userData = userDoc.data() || {};
      const displayName = userData.name || firstName || username || 'Teman';

      if (userData.dailyReminderEnabled === false) {
        skipped++;
        skipDetails.disabled++;
        console.log(`[cron-reminder] Skip ${chatId} (${displayName}): reminder harian dinonaktifkan (dailyReminderEnabled=false)`);
        continue;
      }

      const dateField = type === 'morning' ? 'lastMorningReminderDate' : 'lastEveningReminderDate';
      if (!force && userData[dateField] === todayWib) {
        skipped++;
        skipDetails.already_sent++;
        console.log(`[cron-reminder] Skip ${chatId} (${displayName}): sudah terkirim hari ini (${todayWib}) untuk sesi ${type}`);
        continue;
      }

      const { bal } = await getBalance(uid, db);

      if (type === 'morning') {
        let goals = [];
        const goalSnap = await userRef.collection('goals').get();
        if (!goalSnap.empty) {
          goals = goalSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        }
        const text = generateMorningReminder(displayName, bal, goals, userData.currentStreak || 0);
        await sendTelegramMessage(botToken, chatId, text, {
          reply_markup: {
            inline_keyboard: [
              [{ text: '💳 Cek Saldo', callback_data: 'saldo' }, { text: '🎯 Target Impian', callback_data: 'goals' }]
            ]
          }
        });
      } else {
        const txSnap = await userRef.collection('transactions').where('date', '==', todayWib).get();
        let totalExpense = 0;
        let totalIncome = 0;
        let expenseCount = 0;
        txSnap.forEach((tDoc) => {
          const t = tDoc.data();
          const amt = Number(t.amount) || 0;
          if (t.type === 'Income') totalIncome += amt;
          else {
            totalExpense += amt;
            expenseCount++;
          }
        });
        const summary = {
          date: todayWib,
          totalExpense,
          totalIncome,
          expenseCount,
          currentBalance: bal
        };
        const text = generateEveningReminder(displayName, summary);
        await sendTelegramMessage(botToken, chatId, text, {
          reply_markup: {
            inline_keyboard: [
              [{ text: '💳 Cek Saldo', callback_data: 'saldo' }]
            ]
          }
        });
      }

      await userRef.set({ [dateField]: todayWib }, { merge: true });
      sent++;
      console.log(`[cron-reminder] Berhasil mengirim reminder ${type} ke ${chatId} (${displayName})`);
    } catch (err) {
      skipped++;
      skipDetails.error++;
      console.error(`[cron-reminder] Gagal mengirim reminder ${type} ke chatId ${chatId}:`, err?.message);
    }
  }

  console.log(`[cron-reminder] [${nowWib}] Eksekusi reminder '${type}' selesai. Total user diproses: ${docs.length}, Terkirim: ${sent}, Di-skip: ${skipped}. Rincian skip:`, JSON.stringify(skipDetails));
  return { sent, skipped, details: skipDetails };
}

export async function dispatchWeeklyRecap(db, botToken) {
  if (!db || !botToken) return { sent: 0, skipped: 0 };

  const now = new Date();
  const todayWib = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(now);
  // Week boundaries: Mon-Sun, Asia/Jakarta
  const jakartaNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
  const dayOfWeek = jakartaNow.getDay(); // 0=Sun
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  const thisMonday = new Date(jakartaNow);
  thisMonday.setDate(jakartaNow.getDate() - mondayOffset);
  const lastMonday = new Date(thisMonday);
  lastMonday.setDate(thisMonday.getDate() - 7);
  const lastSunday = new Date(thisMonday);
  lastSunday.setDate(thisMonday.getDate() - 1);

  const fmt = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const thisWeekStart = fmt(thisMonday);
  const lastWeekStart = fmt(lastMonday);
  const lastWeekEnd = fmt(lastSunday);

  const linkSnap = await db.collection('telegram_links').get();
  let sent = 0, skipped = 0;

  for (const doc of linkSnap.docs) {
    const chatId = doc.id;
    const { uid } = doc.data() || {};
    if (!uid || !chatId) continue;

    try {
      const userRef = db.collection('users').doc(uid);
      const userDoc = await userRef.get();
      const userData = userDoc.data() || {};

      if (userData.dailyReminderEnabled === false) { skipped++; continue; }
      if (userData.lastWeeklyRecapDate === todayWib) { skipped++; continue; }

      // This week expenses (Mon to today)
      // Filter type in-memory to avoid Firestore composite index requirement (type == 'Expense' + date range)
      const thisSnap = await userRef.collection('transactions')
        .where('date', '>=', thisWeekStart)
        .where('date', '<=', todayWib)
        .get();
      let thisTotal = 0;
      const catMap = {};
      thisSnap.forEach(d => {
        const t = d.data();
        if (t.type !== 'Expense') return;
        const a = Number(t.amount) || 0;
        thisTotal += a;
        catMap[t.category] = (catMap[t.category] || 0) + a;
      });

      // Last week expenses
      const lastSnap = await userRef.collection('transactions')
        .where('date', '>=', lastWeekStart)
        .where('date', '<=', lastWeekEnd)
        .get();
      let lastTotal = 0;
      lastSnap.forEach(d => {
        const t = d.data();
        if (t.type === 'Expense') {
          lastTotal += Number(t.amount) || 0;
        }
      });

      // Top 3 categories
      const top3 = Object.entries(catMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);

      // Narrative
      let narrative = '';
      if (top3.length > 0) {
        const [topCat, topAmt] = top3[0];
        if (lastTotal > 0) {
          const change = Math.round(((thisTotal - lastTotal) / lastTotal) * 100);
          const dir = change > 0 ? `naik ${change}%` : change < 0 ? `turun ${Math.abs(change)}%` : 'sama';
          narrative = `${topCat} minggu ini ${formatRupiah(topAmt)}, total pengeluaran ${dir} dari minggu lalu ☕`;
        } else {
          narrative = `${topCat} jadi pengeluaran terbesar minggu ini: ${formatRupiah(topAmt)} 📊`;
        }
      }

      const displayName = escapeMarkdown(userData.name || 'Teman');
      let text = `📊 *Rekap Mingguan Pocky*\n\nHai ${displayName}! Ini ringkasan minggu ini:\n\n`;
      text += `💸 *Total pengeluaran:* ${formatRupiah(thisTotal)}\n`;
      if (lastTotal > 0) text += `📈 *Minggu lalu:* ${formatRupiah(lastTotal)}\n`;

      if (top3.length > 0) {
        text += '\n🏆 *Top kategori:*\n';
        top3.forEach(([cat, amt], i) => {
          text += `${i + 1}. ${escapeMarkdown(cat)} — ${formatRupiah(amt)}\n`;
        });
      }
      if (narrative) text += `\n💡 _${narrative}_`;

      await sendTelegramMessage(botToken, chatId, text);
      await userRef.set({ lastWeeklyRecapDate: todayWib }, { merge: true });
      sent++;
    } catch (err) {
      console.error(`Weekly recap error for chatId ${chatId}:`, err?.message);
    }
  }

  return { sent, skipped };
}

