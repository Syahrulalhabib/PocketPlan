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
  cancelWebLoginCode
} from './telegramBotCore.js';
import { scanReceiptWithGemini } from './geminiReceiptScanner.js';
import { updateStreak } from './streak.js';

export { generateLinkCode, getLinkStatus, unlinkAccount, sendTelegramPhoto };

const KEYBOARD = {
  keyboard: [
    [{ text: '💸 Catat Keluar' }, { text: '💰 Catat Masuk' }],
    [{ text: '📊 Cek Saldo' }, { text: '🎯 Target Impian' }],
    [{ text: '📜 Riwayat' }, { text: '🔥 Cek Streak' }],
    [{ text: '🌐 Buka di Web' }]
  ],
  resize_keyboard: true
};

// Pending challenge creation state per chatId (step-by-step via buttons)
const pendingChallenge = new Map();
// Pending budget creation state per chatId (step-by-step via buttons)
const pendingBudget = new Map();
// Pending riwayat search per chatId
const pendingSearch = new Map();
const PENDING_TIMEOUT_MS = 5 * 60 * 1000;
function setPendingChallenge(chatId, data) {
  pendingChallenge.set(String(chatId), { ...data, ts: Date.now() });
}
function getPendingChallenge(chatId) {
  const p = pendingChallenge.get(String(chatId));
  if (!p) return null;
  if (Date.now() - p.ts > PENDING_TIMEOUT_MS) { pendingChallenge.delete(String(chatId)); return null; }
  return p;
}
function clearPendingChallenge(chatId) { pendingChallenge.delete(String(chatId)); }

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

function setPendingSearch(chatId) {
  pendingSearch.set(String(chatId), { ts: Date.now() });
}
function getPendingSearch(chatId) {
  const p = pendingSearch.get(String(chatId));
  if (!p) return null;
  if (Date.now() - p.ts > PENDING_TIMEOUT_MS) { pendingSearch.delete(String(chatId)); return null; }
  return p;
}
function clearPendingSearch(chatId) { pendingSearch.delete(String(chatId)); }

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

      let total = 0;
      txDocs.forEach(d => {
        const t = d.data();
        const isExpense = (t.type || '').toLowerCase() === 'expense';
        if (isExpense && getTxMonth(t) === monthKey) {
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

    if (data.startsWith('buy:')) {
      const gId = data.replace('buy:', '');
      if (db && uid) {
        const ref = db.collection('users').doc(uid).collection('goals').doc(gId);
        const snap = await ref.get();
        if (snap.exists) {
          const g = snap.data();
          const amt = Number(g.target) || 0;
          const { bal } = await getBalance(uid, db);
          if (bal < amt) {
            await answerTelegramCallback(botToken, cb.id, 'Saldo tidak cukup');
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
          await ref.delete();
          await answerTelegramCallback(botToken, cb.id, '🎉 Impian terbeli!');
          return sendTelegramMessage(
            botToken,
            chatId,
            `🥳 *Impian Tercapai!* 🎉\n\n*${escapeMarkdown(g.name)}* (${formatRupiah(amt)}) berhasil dibeli!\n\n✅ Pengeluaran dicatat\n🎯 Target selesai & diarsipkan\n\nHebat, nabungmu membuahkan hasil!`
          );
        }
      }
      await answerTelegramCallback(botToken, cb.id, 'Target tidak ditemukan.');
      return;
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



    // --- Tantangan inline menu callbacks (tng:*) ---
    if (data.startsWith('tng:')) {
      await answerTelegramCallback(botToken, cb.id);
      const messageId = cb.message?.message_id;
      const userFrom = cb.from || {};
      return handleTantanganCallback(data, botToken, chatId, messageId, uid, userFrom, db);
    }

    // --- Budget inline menu callbacks (bdg:*) ---
    if (data.startsWith('bdg:')) {
      await answerTelegramCallback(botToken, cb.id);
      const messageId = cb.message?.message_id;
      return handleBudgetCallback(data, botToken, chatId, messageId, uid, db);
    }

    // --- Riwayat search callbacks (cr:*) ---
    if (data.startsWith('cr:')) {
      await answerTelegramCallback(botToken, cb.id);
      if (data === 'cr:cari') {
        setPendingSearch(chatId);
        return sendTelegramMessage(botToken, chatId, '🔍 *Cari Transaksi*\n\nKetik kata kunci pencarian.\nContoh: `kopi`, `laptop`, `gaji`');
      }
      if (data === 'cr:kembali') {
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

  // Intercept judul input for pending challenge creation
  const pendingC = getPendingChallenge(chatId);
  if (pendingC && pendingC.step === 'judul' && !text.startsWith('/')) {
    const title = text.slice(0, 60).trim();
    if (!title) {
      return sendTelegramMessage(botToken, chatId, '❌ Judul tidak boleh kosong. Ketik ulang judul tantangan:');
    }
    setPendingChallenge(chatId, { ...pendingC, step: 'confirm', title });
    const typeLabel = pendingC.type === 'no_spend' ? `🚫 Puasa Belanja (${escapeMarkdown(pendingC.category || '')})` : '📝 Rajin Catat';
    return sendTelegramMessage(botToken, chatId,
      `🏆 *Konfirmasi Tantangan Baru:*\n\n📌 Judul: *${escapeMarkdown(title)}*\nTipe: ${typeLabel}\n📅 Durasi: 30 hari\n\nBuat tantangan ini?`,
      { reply_markup: { inline_keyboard: [
        [{ text: '✅ Buat!', callback_data: 'tng:confirm_buat:yes' }, { text: '❌ Batal', callback_data: 'tng:confirm_buat:no' }]
      ] } }
    );
  }

  if (text.startsWith('/start')) {
    const parts = text.split(/\s+/);
    if (parts.length > 1) {
      const payload = parts[1];

      // Fase 6: join_ deep link for challenges — handled before ref_ and link code
      if (payload.startsWith('join_')) {
        const challengeId = payload.replace('join_', '');
        await ensureTelegramUser(chatId, userFrom, db);
        const uid = await findLinkedUid(chatId, db);
        if (db && challengeId) {
          try {
            const cRef = db.collection('challenges').doc(challengeId);
            const cDoc = await cRef.get();
            if (cDoc.exists) {
              const cData = cDoc.data();
              if (cData.status === 'active') {
                const already = (cData.participants || []).some(p => String(p.chatId) === String(chatId));
                if (already) {
                  return sendTelegramMessage(botToken, chatId, '✅ Kamu sudah ikut tantangan ini!', { reply_markup: KEYBOARD });
                }
                const participants = [...(cData.participants || []), {
                  chatId: String(chatId),
                  uid: uid || `tg_${chatId}`,
                  displayName: userFrom.first_name || 'Teman',
                  joinedAt: new Date().toISOString()
                }];
                await cRef.set({ participants }, { merge: true });
                // Notify creator
                if (cData.creatorChatId && String(cData.creatorChatId) !== String(chatId)) {
                  sendTelegramMessage(botToken, cData.creatorChatId,
                    `🎉 *${escapeMarkdown(userFrom.first_name || 'Seseorang')}* bergabung ke tantangan *${escapeMarkdown(cData.title)}*! (${participants.length} peserta)`
                  ).catch(() => {});
                }
                return sendTelegramMessage(botToken, chatId,
                  `🎯 *Kamu ikut tantangan!*\n\n📌 *${escapeMarkdown(cData.title)}*\nTipe: ${cData.type === 'no_spend' ? '🚫 Tanpa belanja' : '📝 Catat tiap hari'}\nPeserta: ${participants.length} orang\n\nKetik /tantangan untuk cek progres!`,
                  { reply_markup: KEYBOARD }
                );
              }
            }
          } catch (err) {
            console.error('join_ deep link error:', err?.message);
          }
        }
        // Invalid/expired join link → normal greeting
        return sendTelegramMessage(
          botToken,
          chatId,
          `*Hai ${userName}! Salam kenal, aku Pocky!*\n\n⚠️ Link tantangan tidak ditemukan atau sudah berakhir.\n\nAsisten keuangan pribadimu. Pocky bantu kamu:\n\n💸 Catat pemasukan & pengeluaran\n🧾 Scan foto struk otomatis\n🎯 Buat & pantau target tabungan\n📊 Cek saldo & riwayat kapan saja\n\nMulai: ketik \`kopi susu 25k\` atau kirim foto struk! 📖 /help`,
          { reply_markup: KEYBOARD }
        );
      }

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
      if (!label) return sendTelegramMessage(botToken, chatId, '❌ Label tidak boleh kosong. Ketik ulang:');
      setPendingBudget(chatId, { step: 'amount', label });
      return sendTelegramMessage(botToken, chatId,
        `💰 Budget: *${escapeMarkdown(label)}*\n\nLimitnya berapa? Ketik nominal.\nContoh: \`500k\`, \`1.5jt\`, \`200000\``,
        { reply_markup: { inline_keyboard: [[{ text: '❌ Batal', callback_data: 'bdg:list' }]] } }
      );
    }
    if (pendingB.step === 'amount') {
      const limit = parseAmount(text);
      if (!limit || limit <= 0) return sendTelegramMessage(botToken, chatId, '❌ Nominal tidak valid. Coba lagi.\nContoh: `500k`, `1.5jt`');
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
      if (!limit || limit <= 0) return sendTelegramMessage(botToken, chatId, '❌ Nominal tidak valid. Coba lagi.');
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

  // Intercept text input for riwayat search
  const pendingS = getPendingSearch(chatId);
  if (pendingS && !text.startsWith('/')) {
    clearPendingSearch(chatId);
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
    return sendTelegramMessage(botToken, chatId, '🎯 *Format Buat Target:*\nKetik: `/goal [nama] [nominal]` atau `/goal [nominal] [nama]`\nContoh: `/goal Motor Matic 15jt`',
      { reply_markup: KEYBOARD });
  }

  if (/^\/goal(@\S+)?\s+/i.test(text)) {
    const raw = text.replace(/^\/goal(@\S+)?\s+/i, '').trim();
    if (!raw) return sendTelegramMessage(botToken, chatId, '🎯 *Format Buat Target:*\nKetik: `/goal [nama] [nominal]` atau `/goal [nominal] [nama]`\nContoh: `/goal Motor Matic 15jt`');
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
    if (!amt) return sendTelegramMessage(botToken, chatId, '⚠️ Nominal belum benar.\nContoh:\n👉 `/goal Laptop Baru 10jt`\n👉 `/goal 10jt Laptop Baru`');
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
      '<b>💰 BUDGET BULANAN</b>\n' +
      '• <code>/budget [kategori] [nominal]</code> — atur batas belanja\n' +
      '• <code>/budget</code> — cek sisa budget semua kategori\n' +
      '• <code>/budget hapus [kategori]</code> — hapus budget\n\n' +
      '<b>🎯 TARGET &amp; KONSISTENSI</b>\n' +
      '• <code>/goal [nama] [target]</code> — buat target tabungan\n' +
      '• <code>/goals</code> — cek progres &amp; beli target tercapai\n' +
      '• <code>/streak</code> — pantau rekor hari konsisten catat keuangan\n' +
      '• <code>/pencapaian</code> — galeri lencana &amp; milestone\n\n' +
      '<b>🏆 TANTANGAN DISIPLIN (30 HARI)</b>\n' +
      '• Ajang 30 hari melatih disiplin finansial bareng teman.\n' +
      '• Ketik <code>/tantangan</code> — buka menu interaktif:\n' +
      '   ➕ <b>Buat</b> — pilih tipe, kategori, ketik judul, selesai!\n' +
      '   📋 <b>Tantangan Aktif</b> — lihat &amp; gabung tantangan\n' +
      '   👤 <b>Tantanganku</b> — cek progres &amp; streak harian\n' +
      '• Tap detail tantangan untuk gabung, keluar, atau hapus.\n' +
      '• Catat keuangan tiap hari → streak hijau ✅ → leaderboard naik!\n' +
      '• Raih lencana Juara 🏆 / Selesai 👏 di <code>/pencapaian</code>.\n\n' +
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
    const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'PocketPlanBot';
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

  // /tantangan command — challenge system (Fase 6)
  if (cmdText === '/tantangan' || cmdText.startsWith('/tantangan ')) {
    const args = text.replace(/^\/tantangan(@\S+)?\s*/i, '').trim();
    if (!db) return sendTelegramMessage(botToken, chatId, 'Mode demo aktif.');

    // /tantangan buat ...
    const buatMatch = args.match(/^buat\s+(no_spend|daily_log)\s+(\S+)\s+"(.+)"/i) || args.match(/^buat\s+(no_spend|daily_log)\s+(\S+)\s+(.+)/i);
    if (args.startsWith('buat') && buatMatch) {
      const type = buatMatch[1].toLowerCase();
      const category = buatMatch[2];
      const title = buatMatch[3];
      const startDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
      const endD = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
      endD.setDate(endD.getDate() + 30);
      const endDate = `${endD.getFullYear()}-${String(endD.getMonth() + 1).padStart(2, '0')}-${String(endD.getDate()).padStart(2, '0')}`;
      const cDoc = await db.collection('challenges').add({
        title, type, category: type === 'no_spend' ? category : null,
        days: 30, startDate, endDate,
        creatorChatId: String(chatId),
        participants: [{ chatId: String(chatId), uid, displayName: userFrom.first_name || 'Teman', joinedAt: new Date().toISOString() }],
        status: 'active', createdAt: new Date().toISOString()
      });
      const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'PocketPlanBot';
      const joinLink = `https://t.me/${botUsername}?start=join_${cDoc.id}`;
      return sendTelegramMessage(botToken, chatId,
        `🏆 *Tantangan Dibuat!*\n\n📌 *${escapeMarkdown(title)}*\nTipe: ${type === 'no_spend' ? `🚫 Tanpa belanja ${escapeMarkdown(category)}` : '📝 Catat tiap hari'}\n📅 ${startDate} — ${endDate} (30 hari)\n\nAjak teman join:\n\`${joinLink}\``,
        { reply_markup: KEYBOARD }
      );
    }
    if (args.startsWith('buat')) {
      return sendTelegramMessage(botToken, chatId,
        '🏆 *Cara Buat Tantangan Bareng Teman (30 Hari):*\n\n' +
        '*1. Puasa Belanja (`no_spend`)*:\n' +
        'Tahan diri tidak beli barang tertentu (kopi, boba, jajan, rokok, dll).\n' +
        'Format: `/tantangan buat no_spend <Kategori> <Judul>`\n' +
        'Contoh: `/tantangan buat no_spend Kopi 30 Hari Tanpa Kopi`\n\n' +
        '*2. Rajin Catat (`daily_log`)*:\n' +
        'Disiplin catat keuangan minimal 1x setiap hari bareng teman tanpa bolong.\n' +
        'Format: `/tantangan buat daily_log <Kategori> <Judul>`\n' +
        'Contoh: `/tantangan buat daily_log Nabung 30 Hari Rajin Catat`\n\n' +
        '💡 _Setelah dibuat, Pocky beri link khusus untuk dibagikan ke teman!_',
        { reply_markup: KEYBOARD }
      );
    }

    // /tantangan gabung <id>
    const gabungMatch = args.match(/^gabung\s+(\S+)/i);
    if (gabungMatch) {
      const challengeId = gabungMatch[1];
      try {
        const cRef = db.collection('challenges').doc(challengeId);
        const cDoc = await cRef.get();
        if (!cDoc.exists) return sendTelegramMessage(botToken, chatId, '❌ Tantangan tidak ditemukan.');
        const cData = cDoc.data();
        if (cData.status !== 'active') return sendTelegramMessage(botToken, chatId, '⏰ Tantangan sudah selesai.');
        const already = (cData.participants || []).some(p => String(p.chatId) === String(chatId));
        if (already) return sendTelegramMessage(botToken, chatId, '✅ Kamu sudah ikut tantangan ini!');
        const participants = [...(cData.participants || []), {
          chatId: String(chatId), uid, displayName: userFrom.first_name || 'Teman', joinedAt: new Date().toISOString()
        }];
        await cRef.set({ participants }, { merge: true });
        return sendTelegramMessage(botToken, chatId,
          `🎯 *Kamu ikut tantangan!*\n\n📌 *${escapeMarkdown(cData.title)}*\nPeserta: ${participants.length} orang`,
          { reply_markup: KEYBOARD }
        );
      } catch (err) {
        console.error('tantangan gabung error:', err?.message);
        return sendTelegramMessage(botToken, chatId, '❌ Gagal join tantangan.');
      }
    }

    // /tantangan keluar <id>
    const keluarMatch = args.match(/^keluar\s+(\S+)/i);
    if (keluarMatch) {
      const challengeId = keluarMatch[1];
      try {
        const cRef = db.collection('challenges').doc(challengeId);
        const cDoc = await cRef.get();
        if (!cDoc.exists) return sendTelegramMessage(botToken, chatId, '❌ Tantangan tidak ditemukan.');
        const cData = cDoc.data();
        const existing = (cData.participants || []).filter(p => String(p.chatId) !== String(chatId));
        if (existing.length === (cData.participants || []).length) {
          return sendTelegramMessage(botToken, chatId, 'ℹ️ Kamu belum bergabung di tantangan ini.');
        }
        await cRef.set({ participants: existing }, { merge: true });
        return sendTelegramMessage(botToken, chatId,
          `🚪 *Kamu telah keluar dari tantangan:*\n📌 *${escapeMarkdown(cData.title)}*`,
          { reply_markup: KEYBOARD }
        );
      } catch (err) {
        console.error('tantangan keluar error:', err?.message);
        return sendTelegramMessage(botToken, chatId, '❌ Gagal keluar dari tantangan.');
      }
    }

    // /tantangan hapus <id>
    const hapusTantanganMatch = args.match(/^hapus\s+(\S+)/i);
    if (hapusTantanganMatch) {
      const challengeId = hapusTantanganMatch[1];
      try {
        const cRef = db.collection('challenges').doc(challengeId);
        const cDoc = await cRef.get();
        if (!cDoc.exists) return sendTelegramMessage(botToken, chatId, '❌ Tantangan tidak ditemukan.');
        const cData = cDoc.data();
        if (String(cData.creatorChatId) !== String(chatId)) {
          return sendTelegramMessage(botToken, chatId, `❌ Hanya pembuat tantangan yang dapat menghapus tantangan ini.\nUntuk keluar, ketik: \`/tantangan keluar ${challengeId}\``);
        }
        await cRef.set({ status: 'cancelled' }, { merge: true });
        return sendTelegramMessage(botToken, chatId,
          `🗑️ *Tantangan berhasil dibatalkan/dihapus:*\n📌 *${escapeMarkdown(cData.title)}*`,
          { reply_markup: KEYBOARD }
        );
      } catch (err) {
        console.error('tantangan hapus error:', err?.message);
        return sendTelegramMessage(botToken, chatId, '❌ Gagal menghapus tantangan.');
      }
    }

    // /tantangan (no args) → show inline menu
    return sendTelegramMessage(botToken, chatId,
      '🏆 *TANTANGAN*\nMenantang dirimu & teman selama 30 hari!',
      { reply_markup: { inline_keyboard: [
        [{ text: '➕ Buat Tantangan Baru', callback_data: 'tng:buat' }],
        [{ text: '📋 Tantangan Aktif', callback_data: 'tng:list' }],
        [{ text: '👤 Tantanganku', callback_data: 'tng:milik' }]
      ] } }
    );
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
    return sendTelegramMessage(botToken, chatId,
      `📝 *Cara catat pengeluaran:*\n\n\`/catat 25k kopi susu\`\n\`/catat makan siang 35rb\`\n\`kopi 15k\` _(tanpa command juga bisa!)_\n\nFormat: \`/catat [nominal] [keterangan]\` atau sebaliknya`,
      { reply_markup: KEYBOARD });
  }
  if (['/masuk', '/income'].includes(cmdText)) {
    return sendTelegramMessage(botToken, chatId,
      `💰 *Cara catat pemasukan:*\n\n\`/masuk 2.5jt gaji bulanan\`\n\`/masuk freelance 500k\`\n\nFormat: \`/masuk [nominal] [keterangan]\` atau sebaliknya`,
      { reply_markup: KEYBOARD });
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

  return sendTelegramMessage(
    botToken,
    chatId,
    `❓ *Perintah tidak dikenali*\n\nBerikut contoh yang bisa kamu ketik:\n📝 \`kopi susu 25k\` — catat pengeluaran\n💰 \`/masuk gaji 2jt\` — catat pemasukan\n🎯 \`/goal Laptop 10jt\` — buat target\n\nKetik /help untuk panduan lengkap 📖`,
    { reply_markup: KEYBOARD }
  );
}

// --- Tantangan inline menu handler ---
async function handleTantanganCallback(data, botToken, chatId, messageId, uid, userFrom, db) {
  const menuKb = { inline_keyboard: [
    [{ text: '➕ Buat Tantangan Baru', callback_data: 'tng:buat' }],
    [{ text: '📋 Tantangan Aktif', callback_data: 'tng:list' }],
    [{ text: '👤 Tantanganku', callback_data: 'tng:milik' }]
  ] };
  const menuTxt = '🏆 *TANTANGAN*\nMenantang dirimu & teman selama 30 hari!';

  if (data === 'tng:menu') {
    if (messageId) return editTelegramMessage(botToken, chatId, messageId, menuTxt, { reply_markup: menuKb });
    return sendTelegramMessage(botToken, chatId, menuTxt, { reply_markup: menuKb });
  }

  if (data === 'tng:buat') {
    if (messageId) return editTelegramMessage(botToken, chatId, messageId,
      '🏆 *Buat Tantangan Baru*\n\nPilih tipe tantangan:',
      { reply_markup: { inline_keyboard: [
        [{ text: '🚫 Puasa Belanja', callback_data: 'tng:tipe:no_spend' }, { text: '📝 Rajin Catat', callback_data: 'tng:tipe:daily_log' }],
        [{ text: '⬅️ Kembali', callback_data: 'tng:menu' }]
      ] } });
    return;
  }

  if (data === 'tng:tipe:no_spend' || data === 'tng:tipe:daily_log') {
    const type = data === 'tng:tipe:no_spend' ? 'no_spend' : 'daily_log';
    const cats = [['🍜 Makanan','Food'],['🛍️ Belanja','Shopping'],['🚗 Transport','Transport'],['💡 Bills','Bills'],['💊 Kesehatan','Health'],['🎮 Hiburan','Entertainment'],['📚 Edukasi','Education'],['🎁 Lainnya','Other']];
    const rows = [];
    for (let i = 0; i < cats.length; i += 2) {
      const row = [{ text: cats[i][0], callback_data: `tng:kat:${type}:${cats[i][1]}` }];
      if (cats[i+1]) row.push({ text: cats[i+1][0], callback_data: `tng:kat:${type}:${cats[i+1][1]}` });
      rows.push(row);
    }
    if (type === 'daily_log') rows.push([{ text: '⏭️ Lewati', callback_data: `tng:kat:${type}:_skip` }]);
    rows.push([{ text: '⬅️ Kembali', callback_data: 'tng:buat' }]);
    if (messageId) return editTelegramMessage(botToken, chatId, messageId,
      `🏆 *Buat: ${type === 'no_spend' ? '🚫 Puasa Belanja' : '📝 Rajin Catat'}*\n\nPilih kategori:`,
      { reply_markup: { inline_keyboard: rows } });
    return;
  }

  if (data.startsWith('tng:kat:')) {
    const parts = data.replace('tng:kat:', '').split(':');
    const type = parts[0], category = parts[1];
    setPendingChallenge(chatId, { step: 'judul', type, category: category === '_skip' ? null : category });
    if (messageId) return editTelegramMessage(botToken, chatId, messageId,
      `🏆 *Buat Tantangan*\n` +
      (category !== '_skip' ? `📁 Kategori: *${escapeMarkdown(category)}*\n\n` : '\n') +
      '✏️ Ketik *judul tantangan* kamu:\n_(contoh: 30 Hari Tanpa Kopi)_',
      { reply_markup: { inline_keyboard: [[{ text: '❌ Batal', callback_data: 'tng:menu' }]] } });
    return;
  }

  if (data.startsWith('tng:confirm_buat:')) {
    if (data.endsWith(':yes')) {
      const p = getPendingChallenge(chatId);
      if (!p || !p.title || !db) {
        if (messageId) return editTelegramMessage(botToken, chatId, messageId, '❌ Sesi kedaluwarsa. Ketik /tantangan untuk mulai lagi.');
        return;
      }
      const startDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
      const endD = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
      endD.setDate(endD.getDate() + 30);
      const endDate = `${endD.getFullYear()}-${String(endD.getMonth() + 1).padStart(2, '0')}-${String(endD.getDate()).padStart(2, '0')}`;
      const cDoc = await db.collection('challenges').add({
        title: p.title, type: p.type, category: p.type === 'no_spend' ? p.category : null,
        days: 30, startDate, endDate,
        creatorChatId: String(chatId),
        participants: [{ chatId: String(chatId), uid: uid || `tg_${chatId}`, displayName: userFrom.first_name || 'Teman', joinedAt: new Date().toISOString() }],
        status: 'active', createdAt: new Date().toISOString()
      });
      clearPendingChallenge(chatId);
      const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'PocketPlanBot';
      const joinLink = `https://t.me/${botUsername}?start=join_${cDoc.id}`;
      if (messageId) return editTelegramMessage(botToken, chatId, messageId,
        `🏆 *Tantangan Dibuat!*\n\n📌 *${escapeMarkdown(p.title)}*\nTipe: ${p.type === 'no_spend' ? `🚫 Tanpa belanja ${escapeMarkdown(p.category || '')}` : '📝 Catat tiap hari'}\n📅 ${startDate} — ${endDate} (30 hari)\n\nAjak teman join:\n\`${joinLink}\``,
        { reply_markup: { inline_keyboard: [[{ text: '🔗 Bagikan', url: joinLink }], [{ text: '⬅️ Menu Tantangan', callback_data: 'tng:menu' }]] } });
      return;
    }
    clearPendingChallenge(chatId);
    if (messageId) return editTelegramMessage(botToken, chatId, messageId, menuTxt, { reply_markup: menuKb });
    return;
  }

  if (data === 'tng:list') return handleTngList(botToken, chatId, messageId, db);
  if (data === 'tng:milik') return handleTngMilik(botToken, chatId, messageId, db);
  if (data.startsWith('tng:detail:')) return handleTngDetail(data.replace('tng:detail:', ''), botToken, chatId, messageId, uid, userFrom, db);
  if (data.startsWith('tng:gabung:')) return handleTngGabung(data.replace('tng:gabung:', ''), botToken, chatId, messageId, uid, userFrom, db);
  if (data.startsWith('tng:keluar:')) return handleTngKeluar(data.replace('tng:keluar:', ''), botToken, chatId, messageId, db);
  if (data.startsWith('tng:hapus:')) return handleTngHapus(data.replace('tng:hapus:', ''), botToken, chatId, messageId, db);
}

async function handleTngList(botToken, chatId, messageId, db) {
  if (!db) return;
  try {
    const cSnap = await db.collection('challenges').where('status', '==', 'active').get();
    const all = [];
    cSnap.forEach(d => all.push({ id: d.id, ...d.data() }));
    if (all.length === 0) {
      const txt = '🏆 *Belum ada tantangan aktif*\n\nBuat tantangan baru untuk mulai!';
      const kb = { inline_keyboard: [[{ text: '➕ Buat Tantangan Baru', callback_data: 'tng:buat' }], [{ text: '⬅️ Kembali', callback_data: 'tng:menu' }]] };
      if (messageId) return editTelegramMessage(botToken, chatId, messageId, txt, { reply_markup: kb });
      return sendTelegramMessage(botToken, chatId, txt, { reply_markup: kb });
    }
    let out = '📋 *Tantangan Aktif:*\n\n';
    const buttons = [];
    for (const c of all) {
      const pCount = (c.participants || []).length;
      const typeIcon = c.type === 'no_spend' ? '🚫' : '📝';
      out += `${typeIcon} *${escapeMarkdown(c.title)}* (${pCount} peserta)\n`;
      buttons.push([{ text: `👁️ ${c.title.slice(0, 30)}`, callback_data: `tng:detail:${c.id}` }]);
    }
    buttons.push([{ text: '⬅️ Kembali', callback_data: 'tng:menu' }]);
    if (messageId) return editTelegramMessage(botToken, chatId, messageId, out, { reply_markup: { inline_keyboard: buttons } });
    return sendTelegramMessage(botToken, chatId, out, { reply_markup: { inline_keyboard: buttons } });
  } catch (err) {
    console.error('tng:list error:', err?.message);
  }
}

async function handleTngMilik(botToken, chatId, messageId, db) {
  if (!db) return;
  try {
    const cSnap = await db.collection('challenges').where('status', '==', 'active').get();
    const mine = [];
    cSnap.forEach(d => {
      const c = d.data();
      if ((c.participants || []).some(p => String(p.chatId) === String(chatId))) mine.push({ id: d.id, ...c });
    });
    if (mine.length === 0) {
      const txt = '👤 *Kamu belum ikut tantangan*\n\nGabung atau buat tantangan baru!';
      const kb = { inline_keyboard: [[{ text: '📋 Tantangan Aktif', callback_data: 'tng:list' }], [{ text: '➕ Buat Baru', callback_data: 'tng:buat' }], [{ text: '⬅️ Kembali', callback_data: 'tng:menu' }]] };
      if (messageId) return editTelegramMessage(botToken, chatId, messageId, txt, { reply_markup: kb });
      return sendTelegramMessage(botToken, chatId, txt, { reply_markup: kb });
    }
    let out = '👤 *Tantanganku:*\n\n';
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
    const buttons = [];
    for (const c of mine) {
      const totalDays = c.days || 30;
      const daysPassed = Math.max(0, Math.min(totalDays, Math.round((new Date(todayStr + 'T00:00:00') - new Date(c.startDate + 'T00:00:00')) / 86400000)));
      const me = (c.participants || []).find(p => String(p.chatId) === String(chatId));
      const passedDays = Object.values(me?.progress || {}).filter(v => v === true).length;
      const pct = daysPassed > 0 ? Math.round((passedDays / daysPassed) * 100) : 0;
      out += `${c.type === 'no_spend' ? '🚫' : '📝'} *${escapeMarkdown(c.title)}*\n📅 Hari ${daysPassed}/${totalDays} • ${pct}% ✅\n\n`;
      buttons.push([{ text: `👁️ ${c.title.slice(0, 30)}`, callback_data: `tng:detail:${c.id}` }]);
    }
    buttons.push([{ text: '⬅️ Kembali', callback_data: 'tng:menu' }]);
    if (messageId) return editTelegramMessage(botToken, chatId, messageId, out, { reply_markup: { inline_keyboard: buttons } });
    return sendTelegramMessage(botToken, chatId, out, { reply_markup: { inline_keyboard: buttons } });
  } catch (err) {
    console.error('tng:milik error:', err?.message);
  }
}

async function handleTngDetail(cId, botToken, chatId, messageId, uid, userFrom, db) {
  if (!db) return;
  try {
    const cRef = db.collection('challenges').doc(cId);
    const cDoc = await cRef.get();
    if (!cDoc.exists) { if (messageId) return editTelegramMessage(botToken, chatId, messageId, '❌ Tantangan tidak ditemukan.'); return; }
    const c = cDoc.data();
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
    const totalDays = c.days || 30;
    const todayD = new Date(todayStr + 'T00:00:00');
    const daysPassed = Math.max(0, Math.min(totalDays, Math.round((todayD - new Date(c.startDate + 'T00:00:00')) / 86400000)));
    let out = `📌 *${escapeMarkdown(c.title)}*\n${c.type === 'no_spend' ? `🚫 Tanpa belanja ${escapeMarkdown(c.category || '')}` : '📝 Catat tiap hari'}\n📅 Hari ${daysPassed}/${totalDays}\n\n*Peserta:*\n`;
    for (const p of (c.participants || [])) {
      const progress = p.progress || {};
      const passedCnt = Object.values(progress).filter(v => v === true).length;
      const pct = daysPassed > 0 ? Math.round((passedCnt / daysPassed) * 100) : 0;
      let streak7 = '';
      for (let i = 6; i >= 0; i--) {
        const d = new Date(todayD); d.setDate(d.getDate() - i);
        const ds = d.toISOString().split('T')[0];
        if (ds < c.startDate) { streak7 += '⬜'; continue; }
        streak7 += progress[ds] === true ? '✅' : progress[ds] === false ? '❌' : '⬜';
      }
      out += `  ${escapeMarkdown(p.displayName)} ${pct}% ${streak7}\n`;
    }
    const isParticipant = (c.participants || []).some(p => String(p.chatId) === String(chatId));
    const isCreator = String(c.creatorChatId) === String(chatId);
    const btns = [];
    if (!isParticipant) btns.push([{ text: '➕ Gabung', callback_data: `tng:gabung:${cId}` }]);
    if (isParticipant && !isCreator) btns.push([{ text: '🚪 Keluar', callback_data: `tng:keluar:${cId}` }]);
    if (isCreator) btns.push([{ text: '🗑️ Hapus', callback_data: `tng:hapus:${cId}` }]);
    const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'PocketPlanBot';
    btns.push([{ text: '🔗 Undang Teman', url: `https://t.me/${botUsername}?start=join_${cId}` }]);
    btns.push([{ text: '⬅️ Kembali', callback_data: 'tng:milik' }]);
    if (messageId) return editTelegramMessage(botToken, chatId, messageId, out, { reply_markup: { inline_keyboard: btns } });
    return sendTelegramMessage(botToken, chatId, out, { reply_markup: { inline_keyboard: btns } });
  } catch (err) { console.error('tng:detail error:', err?.message); }
}

async function handleTngGabung(cId, botToken, chatId, messageId, uid, userFrom, db) {
  if (!db) return;
  try {
    const cRef = db.collection('challenges').doc(cId);
    const cDoc = await cRef.get();
    if (!cDoc.exists) { if (messageId) return editTelegramMessage(botToken, chatId, messageId, '❌ Tantangan tidak ditemukan.'); return; }
    const cData = cDoc.data();
    if ((cData.participants || []).some(p => String(p.chatId) === String(chatId))) {
      if (messageId) return editTelegramMessage(botToken, chatId, messageId, '✅ Kamu sudah ikut tantangan ini!', { reply_markup: { inline_keyboard: [[{ text: '👁️ Detail', callback_data: `tng:detail:${cId}` }]] } });
      return;
    }
    const participants = [...(cData.participants || []), { chatId: String(chatId), uid: uid || `tg_${chatId}`, displayName: userFrom.first_name || 'Teman', joinedAt: new Date().toISOString() }];
    await cRef.set({ participants }, { merge: true });
    if (cData.creatorChatId && String(cData.creatorChatId) !== String(chatId)) {
      sendTelegramMessage(botToken, cData.creatorChatId, `🎉 *${escapeMarkdown(userFrom.first_name || 'Seseorang')}* bergabung ke tantangan *${escapeMarkdown(cData.title)}*! (${participants.length} peserta)`).catch(() => {});
    }
    if (messageId) return editTelegramMessage(botToken, chatId, messageId,
      `🎯 *Kamu ikut tantangan!*\n\n📌 *${escapeMarkdown(cData.title)}*\nPeserta: ${participants.length} orang`,
      { reply_markup: { inline_keyboard: [[{ text: '👁️ Lihat Detail', callback_data: `tng:detail:${cId}` }], [{ text: '⬅️ Menu Tantangan', callback_data: 'tng:menu' }]] } });
  } catch (err) { console.error('tng:gabung error:', err?.message); }
}

async function handleTngKeluar(cId, botToken, chatId, messageId, db) {
  if (!db) return;
  try {
    const cRef = db.collection('challenges').doc(cId);
    const cDoc = await cRef.get();
    if (!cDoc.exists) { if (messageId) return editTelegramMessage(botToken, chatId, messageId, '❌ Tantangan tidak ditemukan.'); return; }
    const cData = cDoc.data();
    const remaining = (cData.participants || []).filter(p => String(p.chatId) !== String(chatId));
    if (remaining.length === (cData.participants || []).length) {
      if (messageId) return editTelegramMessage(botToken, chatId, messageId, 'ℹ️ Kamu belum bergabung di tantangan ini.');
      return;
    }
    await cRef.set({ participants: remaining }, { merge: true });
    if (messageId) return editTelegramMessage(botToken, chatId, messageId,
      `🚪 *Kamu telah keluar dari tantangan:*\n📌 *${escapeMarkdown(cData.title)}*`,
      { reply_markup: { inline_keyboard: [[{ text: '⬅️ Menu Tantangan', callback_data: 'tng:menu' }]] } });
  } catch (err) { console.error('tng:keluar error:', err?.message); }
}

async function handleTngHapus(cId, botToken, chatId, messageId, db) {
  if (!db) return;
  try {
    const cRef = db.collection('challenges').doc(cId);
    const cDoc = await cRef.get();
    if (!cDoc.exists) { if (messageId) return editTelegramMessage(botToken, chatId, messageId, '❌ Tantangan tidak ditemukan.'); return; }
    const cData = cDoc.data();
    if (String(cData.creatorChatId) !== String(chatId)) {
      if (messageId) return editTelegramMessage(botToken, chatId, messageId, '❌ Hanya pembuat tantangan yang dapat menghapus.');
      return;
    }
    await cRef.set({ status: 'cancelled' }, { merge: true });
    if (messageId) return editTelegramMessage(botToken, chatId, messageId,
      `🗑️ *Tantangan berhasil dibatalkan/dihapus:*\n📌 *${escapeMarkdown(cData.title)}*`,
      { reply_markup: { inline_keyboard: [[{ text: '⬅️ Menu Tantangan', callback_data: 'tng:menu' }]] } });
  } catch (err) { console.error('tng:hapus error:', err?.message); }
}

// --- Budget inline menu handler (bdg:*) ---
async function handleBudgetList(chatId, uid, db, botToken, messageId) {
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
      const txt = '💰 *BUDGET SAYA*\n\nBelum ada budget. Buat budget baru!';
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
    let out = `💰 *Budget Bulan Ini (${monthKey})*\n\n`;
    const buttons = [];
    for (const bDoc of budgetDocs) {
      const b = bDoc.data();
      const lim = Number(b.monthlyLimit || b.amount) || 0;
      const label = b.customLabel || b.rawCategory || b.category || 'Budget';
      const allKw = [...(b.keywords || []).map(k => k.toLowerCase()), ...label.toLowerCase().split(/\s+/).filter(w => w.length >= 2)];
      let spent = 0;
      txDocs.forEach(d => {
        const t = d.data();
        if ((t.type || '').toLowerCase() === 'expense' && getTxMonth(t) === monthKey) {
          const txText = `${t.description || ''} ${t.category || ''}`.toLowerCase();
          if (allKw.some(kw => txText.includes(kw))) spent += Number(t.amount) || 0;
        }
      });
      const pct = lim > 0 ? Math.round((spent / lim) * 100) : 0;
      const si = pct >= 100 ? '🚨' : pct >= 80 ? '⚠️' : '✅';
      out += `${si} *${escapeMarkdown(label)}*\n   ${formatRupiah(spent)} / ${formatRupiah(lim)} (${pct}%)\n   ${renderBar(spent, lim)}\n\n`;
      buttons.push([{ text: `👁️ ${label.slice(0, 28)}`, callback_data: `bdg:detail:${bDoc.id}` }]);
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
    setPendingBudget(chatId, { step: 'label' });
    const txt = '💰 *Buat Budget Baru*\n\nMau budget untuk apa? Ketik labelnya.\nContoh: `beli laptop`, `makan luar`, `transport`';
    if (messageId) return editTelegramMessage(botToken, chatId, messageId, txt, { reply_markup: { inline_keyboard: [[{ text: '❌ Batal', callback_data: 'bdg:list' }]] } });
    return sendTelegramMessage(botToken, chatId, txt);
  }
  if (data.startsWith('bdg:detail:')) {
    const bId = data.replace('bdg:detail:', '');
    if (!db) return;
    try {
      const bDoc = db.collection('users').doc(uid).collection('budgets').doc(bId);
      const b = bDoc.data();
      if (!b || !b.customLabel) { if (messageId) return editTelegramMessage(botToken, chatId, messageId, '❌ Budget tidak ditemukan.'); return; }
      const label = b.customLabel || b.rawCategory || b.category || 'Budget';
      const lim = Number(b.monthlyLimit || b.amount) || 0;
      const keywords = b.keywords || [];
      const monthKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date()).slice(0, 7);
      const txSnap = await db.collection('users').doc(uid).collection('transactions').get();
      const allKw = [...keywords.map(k => k.toLowerCase()), ...label.toLowerCase().split(/\s+/).filter(w => w.length >= 2)];
      let spent = 0;
      txSnap.docs.forEach(d => {
        const t = d.data();
        if ((t.type || '').toLowerCase() === 'expense' && getTxMonth(t) === monthKey) {
          const txText = `${t.description || ''} ${t.category || ''}`.toLowerCase();
          if (allKw.some(kw => txText.includes(kw))) spent += Number(t.amount) || 0;
        }
      });
      const pct = lim > 0 ? Math.round((spent / lim) * 100) : 0;
      const si = pct >= 100 ? '🚨' : pct >= 80 ? '⚠️' : '✅';
      const txt = `${si} *${escapeMarkdown(label)}*\nTerpakai: ${formatRupiah(spent)} / ${formatRupiah(lim)} (${pct}%)\nKeyword: ${keywords.map(k => `\`${k}\``).join(', ') || '_—_'}`;
      const btns = [[{ text: '✏️ Ubah Limit', callback_data: `bdg:limit:${bId}` }, { text: '🗑️ Hapus', callback_data: `bdg:hapus:${bId}` }], [{ text: '⬅️ Kembali', callback_data: 'bdg:list' }]];
      if (messageId) return editTelegramMessage(botToken, chatId, messageId, txt, { reply_markup: { inline_keyboard: btns } });
    } catch (err) { console.error('bdg:detail error:', err?.message); }
  }
  if (data.startsWith('bdg:hapus:')) {
    const bId = data.replace('bdg:hapus:', '');
    if (!db) return;
    try {
      const bRef = db.collection('users').doc(uid).collection('budgets').doc(bId);
      const label = bRef.data()?.customLabel || bRef.data()?.rawCategory || 'Budget';
      await bRef.ref.delete();
      if (messageId) return editTelegramMessage(botToken, chatId, messageId, `🗑️ Budget *${escapeMarkdown(label)}* dihapus.`, { reply_markup: { inline_keyboard: [[{ text: '⬅️ Kembali', callback_data: 'bdg:list' }]] } });
    } catch (err) { console.error('bdg:hapus error:', err?.message); }
  }
  if (data.startsWith('bdg:limit:')) {
    const bId = data.replace('bdg:limit:', '');
    setPendingBudget(chatId, { step: 'limit', budgetId: bId });
    const txt = '✏️ *Ubah Limit Budget*\n\nKetik nominal baru.\nContoh: `500k`, `1.5jt`';
    if (messageId) return editTelegramMessage(botToken, chatId, messageId, txt, { reply_markup: { inline_keyboard: [[{ text: '❌ Batal', callback_data: `bdg:detail:${bId}` }]] } });
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
  if (top.length === 0) {
    return sendTelegramMessage(botToken, chatId,
      `🔍 Tidak ketemu transaksi dengan kata "${escapeMarkdown(keyword)}".\nCoba kata lain.`,
      { reply_markup: { inline_keyboard: [[{ text: '⬅️ Kembali ke Riwayat', callback_data: 'cr:kembali' }]] } }
    );
  }
  let out = `🔍 *Hasil pencarian "${escapeMarkdown(keyword)}":*\n\n`;
  for (const t of top) {
    const sign = t.type === 'Income' ? '🟢 +' : '🔴 -';
    out += `📅 ${formatShortDate(t.date)} — ${sign}*${formatRupiah(t.amount)}*\n   ${escapeMarkdown(t.description || t.category)}\n\n`;
  }
  if (results.length > 10) out += `_...dan ${results.length - 10} lagi_\n`;
  return sendTelegramMessage(botToken, chatId, out,
    { reply_markup: { inline_keyboard: [[{ text: '⬅️ Kembali ke Riwayat', callback_data: 'cr:kembali' }]] } }
  );
}

async function sendSaldo(chatId, uid, db, botToken) {
  const { bal, inc, exp } = await getBalance(uid, db);
  const text = `💳 *Dompet Pocketplan*\n\n💰 *Saldo:* \`${formatRupiah(bal)}\`\n🟢 Pemasukan: ${formatRupiah(inc)}\n🔴 Pengeluaran: ${formatRupiah(exp)}\n\n_Uang tercatat rapi, masa depan tenang._`;
  return sendTelegramMessage(botToken, chatId, text, {
    reply_markup: { inline_keyboard: [[{ text: '🎯 Lihat Target Impian', callback_data: 'goals' }]] }
  });
}

async function sendGoals(chatId, uid, db, botToken) {
  const { bal } = await getBalance(uid, db);
  let goals = [];
  if (db && uid) {
    const gSnap = await db.collection('users').doc(uid).collection('goals').get();
    goals = gSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  if (goals.length === 0) {
    return sendTelegramMessage(
      botToken,
      chatId,
      '🎯 *Belum ada target*\n\nBuat target baru:\n`/goal Laptop Baru 10jt`\n`/goal Sepatu Lari 500k`'
    );
  }

  let text = `🎯 *Target Impianmu*\n💵 Saldo Tersedia: *${formatRupiah(bal)}*\n\n`;
  const buttons = [];
  goals.forEach((g, i) => {
    const tgt = Number(g.target) || 1;
    const done = bal >= tgt;
    text += `${i + 1}. *${escapeMarkdown(g.name)}*\n   Target: ${formatRupiah(tgt)}\n   Progres: ${renderBar(bal, tgt)}${done ? ' 🏆 *BISA DIBELI!*' : ''}\n\n`;
    if (done) buttons.push([{ text: `🛍️ Beli: ${g.name}`, callback_data: `buy:${g.id}` }]);
  });

  return sendTelegramMessage(botToken, chatId, text, {
    reply_markup: buttons.length > 0 ? { inline_keyboard: buttons } : undefined
  });
}

async function sendWebAccess(chatId, uid, db, botToken) {
  const { code, expiresAt } = await generateWebLoginCode(uid, db);
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

export async function dispatchDailyReminders(db, botToken, type = 'morning', force = false) {
  if (!db || !botToken) return { sent: 0, skipped: 0 };
  const todayWib = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
  const linkSnap = await db.collection('telegram_links').get();
  let sent = 0;
  let skipped = 0;

  for (const doc of linkSnap.docs) {
    const chatId = doc.id;
    const { uid, firstName, username } = doc.data() || {};
    if (!uid || !chatId) continue;

    try {
      const userRef = db.collection('users').doc(uid);
      const userDoc = await userRef.get();
      const userData = userDoc.data() || {};

      if (userData.dailyReminderEnabled === false) {
        skipped++;
        continue;
      }

      const dateField = type === 'morning' ? 'lastMorningReminderDate' : 'lastEveningReminderDate';
      if (!force && userData[dateField] === todayWib) {
        skipped++;
        continue;
      }

      const { bal } = await getBalance(uid, db);
      const displayName = userData.name || firstName || username || 'Teman';

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
    } catch (err) {
      console.error(`Error sending ${type} reminder to chatId ${chatId}:`, err?.message);
    }
  }

  return { sent, skipped };
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
      const thisSnap = await userRef.collection('transactions')
        .where('type', '==', 'Expense')
        .where('date', '>=', thisWeekStart)
        .where('date', '<=', todayWib)
        .get();
      let thisTotal = 0;
      const catMap = {};
      thisSnap.forEach(d => {
        const t = d.data();
        const a = Number(t.amount) || 0;
        thisTotal += a;
        catMap[t.category] = (catMap[t.category] || 0) + a;
      });

      // Last week expenses
      const lastSnap = await userRef.collection('transactions')
        .where('type', '==', 'Expense')
        .where('date', '>=', lastWeekStart)
        .where('date', '<=', lastWeekEnd)
        .get();
      let lastTotal = 0;
      lastSnap.forEach(d => { lastTotal += Number(d.data().amount) || 0; });

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

// Fase 6: Daily challenge evaluation — evaluate yesterday's status for each participant
export async function dispatchChallengeEvaluation(db, botToken) {
  if (!db) return;
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
  const yesterday = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

  try {
    const cSnap = await db.collection('challenges').where('status', '==', 'active').get();
    for (const cDoc of cSnap.docs) {
      const c = cDoc.data();
      // Check if challenge ended
      if (todayStr > c.endDate) {
        let bestPct = -1, winners = [];
        const totalDays = c.days || 30;
        for (const p of (c.participants || [])) {
          const progress = p.progress || {};
          const passed = Object.values(progress).filter(v => v === true).length;
          const pct = Math.round((passed / totalDays) * 100);
          if (pct > bestPct) { bestPct = pct; winners = [p]; }
          else if (pct === bestPct) winners.push(p);
        }
        await cDoc.ref.set({ status: 'finished' }, { merge: true });
        for (const p of (c.participants || [])) {
          const isWinner = winners.some(w => String(w.chatId) === String(p.chatId));
          const badge = isWinner ? `challenge_win_${cDoc.id}` : `challenge_done_${cDoc.id}`;
          if (p.uid) {
            try {
              const uRef = db.collection('users').doc(p.uid);
              const uDoc = await uRef.get();
              const seen = (uDoc.data() || {}).achievementsSeen || [];
              const seenAt = (uDoc.data() || {}).achievementsSeenAt || {};
              if (!seen.includes(badge)) {
                seen.push(badge);
                seenAt[badge] = new Date().toISOString();
                await uRef.set({ achievementsSeen: seen, achievementsSeenAt: seenAt }, { merge: true });
              }
            } catch {}
          }
          const winText = isWinner ? '🏆 *Kamu pemenangnya!*' : '👏 *Tantangan selesai!*';
          sendTelegramMessage(botToken, p.chatId,
            `${winText}\n\n📌 *${escapeMarkdown(c.title)}* telah berakhir.\nSkor tertinggi: ${bestPct}%`
          ).catch(() => {});
        }
        continue;
      }
      // Evaluate yesterday
      if (yStr < c.startDate) continue;
      const updatedParticipants = [];
      for (const p of (c.participants || [])) {
        const progress = { ...(p.progress || {}) };
        if (progress[yStr] !== undefined) { updatedParticipants.push({ ...p, progress }); continue; }
        const pUid = p.uid || `tg_${p.chatId}`;
        let passed = false;
        try {
          if (c.type === 'daily_log') {
            const txSnap = await db.collection('users').doc(pUid).collection('transactions')
              .where('date', '==', yStr).limit(1).get();
            passed = !txSnap.empty;
          } else if (c.type === 'no_spend') {
            const txSnap = await db.collection('users').doc(pUid).collection('transactions')
              .where('type', '==', 'Expense')
              .where('category', '==', c.category)
              .where('date', '==', yStr).limit(1).get();
            passed = txSnap.empty;
          }
        } catch {}
        progress[yStr] = passed;
        updatedParticipants.push({ ...p, progress });
      }
      await cDoc.ref.set({ participants: updatedParticipants }, { merge: true });
    }
  } catch (err) {
    console.error('challenge evaluation error:', err?.message);
  }
}

