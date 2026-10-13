import { parseTransactionCommand, parseAmount, formatRupiah } from './telegramParser.js';
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

export { generateLinkCode, getLinkStatus, unlinkAccount, generateAchievementCard, generateAchievementSvg, sendTelegramPhoto };

const KEYBOARD = {
  keyboard: [
    [{ text: '💸 Catat Keluar' }, { text: '💰 Catat Masuk' }],
    [{ text: '📊 Cek Saldo' }, { text: '🎯 Target Impian' }],
    [{ text: '📜 Riwayat' }, { text: '🌐 Buka di Web' }]
  ],
  resize_keyboard: true
};

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

// Fase 4: Achievement card system
function getAchievementTheme(type, percent, streakDays, barW) {
  const isStreak = type === 'streak';
  const pct = Math.min(100, Math.max(0, percent || 0));
  if (isStreak) {
    return {
      bg0: '#080C14', bg1: '#0F172A', glow: '#FF5722', glow2: '#FF9800',
      b1: '#FF6B35', b2: '#FF0055', b3: '#6366F1', n1: '#FFFFFF', n2: '#FFB74D',
      badgeBg: '#FF5722', badgeTxt: '#FF9E80', badgeLbl: 'STREAK MILESTONE',
      num: streakDays || 0, subLbl: 'HARI BERTURUT-TURUT',
      hero: '<g transform="translate(485, 280) scale(2.3)"><path d="M24 2 C25 8 31 13 31 21 C31 28 25 34 18 34 C10 34 5 28 5 20 C5 14 9 9 13 5 C13 11 17 14 18 19 C18 21 16 23 14 23 C12 23 11 21 11 19 C11 15 16 9 24 2 Z" fill="url(#flame)"/><path d="M20 18 C20 22 17 26 14 26 C12 26 10 24 10 21 C10 18 12 15 15 13 C15 16 17 17 18 18 Z" fill="#FFF9C4" opacity="0.8"/></g>',
      tracker: '<g transform="translate(180, 840)"><rect width="720" height="110" rx="24" fill="#0A0F1D" stroke="rgba(255,255,255,0.08)" stroke-width="1.5"/><text x="360" y="38" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif" font-size="16" font-weight="800" fill="#64748B" letter-spacing="3">REKOR CATATAN AKTIF</text><g transform="translate(55, 54)">' + [0,1,2,3,4,5,6].map(i => `<circle cx="${35 + i*90}" cy="22" r="18" fill="#FF5722"/><text x="${35 + i*90}" y="28" text-anchor="middle" font-size="16" fill="#FFF" font-weight="bold">&#x2713;</text>`).join('') + '</g></g>'
    };
  }
  return {
    bg0: '#051512', bg1: '#0A221C', glow: '#10B981', glow2: '#06B6D4',
    b1: '#10B981', b2: '#06B6D4', b3: '#3B82F6', n1: '#FFFFFF', n2: '#A7F3D0',
    badgeBg: '#10B981', badgeTxt: '#6EE7B7', badgeLbl: 'TARGET MILESTONE',
    num: `${pct}%`, subLbl: 'TARGET TERCAPAI',
    hero: '<circle cx="540" cy="340" r="65" fill="none" stroke="#10B981" stroke-width="6"/><circle cx="540" cy="340" r="40" fill="none" stroke="#06B6D4" stroke-width="6"/><circle cx="540" cy="340" r="18" fill="#FFFFFF"/>',
    tracker: `<g transform="translate(180, 870)"><rect width="720" height="36" rx="18" fill="#061A14" stroke="rgba(255,255,255,0.1)" stroke-width="1.5"/><rect width="${barW}" height="36" rx="18" fill="url(#bGrad)"/><text x="360" y="70" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif" font-size="20" font-weight="800" fill="#6EE7B7" letter-spacing="2">${pct}% OF GOAL</text></g>`
  };
}


function generateAchievementSvg({ type, title, subtitle, percent, streakDays }) {
  const isStreak = type === 'streak';
  const pct = Math.min(100, Math.max(0, percent || 0));
  const barW = Math.round((pct / 100) * 720);
  const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const safeTitle = esc(title || (isStreak ? `Streak ${streakDays || 0} Hari!` : 'Target Tabungan'));
  const safeSub = esc(subtitle || (isStreak ? 'Disiplin finansial makin konsisten' : `Progres ${pct}% tercapai`));
  const dateStr = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
  const t = getAchievementTheme(type, percent, streakDays, barW);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.8" y2="1"><stop offset="0%" stop-color="${t.bg0}"/><stop offset="50%" stop-color="${t.bg1}"/><stop offset="100%" stop-color="#020408"/></linearGradient>
    <radialGradient id="glow" cx="50%" cy="30%" r="42%"><stop offset="0%" stop-color="${t.glow}" stop-opacity="0.45"/><stop offset="60%" stop-color="${t.glow2}" stop-opacity="0.12"/><stop offset="100%" stop-color="${t.bg1}" stop-opacity="0"/></radialGradient>
    <linearGradient id="border" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${t.b1}"/><stop offset="50%" stop-color="${t.b2}"/><stop offset="100%" stop-color="${t.b3}"/></linearGradient>
    <linearGradient id="num" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${t.n1}"/><stop offset="100%" stop-color="${t.n2}"/></linearGradient>
    <linearGradient id="flame" x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stop-color="#D84315"/><stop offset="50%" stop-color="#FF5722"/><stop offset="100%" stop-color="#FFD54F"/></linearGradient>
    <linearGradient id="bGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#10B981"/><stop offset="100%" stop-color="#06B6D4"/></linearGradient>
  </defs>
  <rect width="1080" height="1350" fill="url(#bg)"/>
  <circle cx="540" cy="350" r="450" fill="url(#glow)"/>
  <rect x="50" y="50" width="980" height="1250" rx="44" fill="${t.bg1}" fill-opacity="0.85" stroke="url(#border)" stroke-width="2.5"/>
  <rect x="360" y="110" width="360" height="54" rx="27" fill="${t.badgeBg}" fill-opacity="0.15" stroke="${t.badgeBg}" stroke-opacity="0.4" stroke-width="1.5"/>
  <text x="540" y="145" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" font-size="20" font-weight="800" fill="${t.badgeTxt}" letter-spacing="3">${t.badgeLbl}</text>
  <circle cx="540" cy="340" r="120" fill="#0E1626" stroke="url(#border)" stroke-width="4"/>
  <circle cx="540" cy="340" r="95" fill="url(#glow)"/>
  ${t.hero}
  <text x="540" y="575" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" font-size="140" font-weight="900" fill="url(#num)">${t.num}</text>
  <text x="540" y="635" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" font-size="26" font-weight="800" fill="#94A3B8" letter-spacing="6">${t.subLbl}</text>
  <text x="540" y="730" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" font-size="44" font-weight="800" fill="#FFFFFF">${safeTitle}</text>
  <text x="540" y="780" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" font-size="24" font-weight="500" fill="#94A3B8">${safeSub}</text>
  ${t.tracker}
  <line x1="120" y1="1025" x2="960" y2="1025" stroke="rgba(255,255,255,0.08)" stroke-width="1.5"/>
  <text x="540" y="1085" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" font-size="28" font-weight="800" fill="#FFFFFF" letter-spacing="2">POCKY • POCKETPLAN</text>
  <text x="540" y="1125" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" font-size="20" font-weight="500" fill="#64748B">${dateStr} • pocketplan.id</text>
  <text x="540" y="1180" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" font-size="16" font-weight="500" fill="#475569">Nominal &amp; Saldo Pribadi Tetap Terlindungi</text>
</svg>`;
}

async function generateAchievementCard(opts) {
  const svg = generateAchievementSvg(opts);
  const sharp = (await import('sharp')).default;
  return sharp(Buffer.from(svg)).png().toBuffer();
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
    await userRef.set({ achievementsSeen: seen }, { merge: true });
    await sendTelegramMessage(botToken, chatId,
      `🏅 *Achievement Unlocked!*\n\n${title}\n_${subtitle}_`,
      {
        reply_markup: {
          inline_keyboard: [[{ text: '🎨 Lihat Kartu', callback_data: `ach:${achievementKey}` }]]
        }
      }
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
            await userRef.set({ achievementsSeen: seen }, { merge: true });
            const safeName = g.name || 'Target';
            await sendTelegramMessage(botToken, chatId,
              `🏅 *Achievement Unlocked!*\n\n🎯 ${escapeMarkdown(safeName)} — ${milestone}%\n_Progres target tabunganmu!_`,
              {
                reply_markup: {
                  inline_keyboard: [[{ text: '🎨 Lihat Kartu', callback_data: `ach:${key}` }]]
                }
              }
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
      '🪙 Pocky lihat kamu sudah catat 20 transaksi! Keren banget 🎉\n\n' +
      'Biar datamu aman kalau ganti HP, tautkan ke Pocketplan web yuk — ' +
      'tinggal ketik /link dengan kode dari menu *Profile* di web.'
    );
  } catch (err) {
    console.error('linkNudge error:', err?.message);
  }
}

// Budget warning: check if expense category exceeds 80% or 100% of monthly budget
async function checkBudgetWarnings(chatId, uid, db, botToken, category) {
  if (!db || !uid || !category) return;
  try {
    const budgetSnap = await db.collection('users').doc(uid).collection('budgets')
      .where('category', '==', category).limit(1).get();
    if (budgetSnap.empty) return;
    const budgetDoc = budgetSnap.docs[0];
    const budget = budgetDoc.data();
    const limit = Number(budget.monthlyLimit) || 0;
    if (limit <= 0) return;

    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthStart = `${monthKey}-01`;
    const nextMonth = now.getMonth() === 11
      ? `${now.getFullYear() + 1}-01-01`
      : `${now.getFullYear()}-${String(now.getMonth() + 2).padStart(2, '0')}-01`;

    const txSnap = await db.collection('users').doc(uid).collection('transactions')
      .where('type', '==', 'Expense')
      .where('category', '==', category)
      .where('date', '>=', monthStart)
      .where('date', '<', nextMonth)
      .get();
    let total = 0;
    txSnap.forEach(d => { total += Number(d.data().amount) || 0; });

    const pct = (total / limit) * 100;
    const warn80Key = `warn80_${monthKey}`;
    const warn100Key = `warn100_${monthKey}`;

    if (pct >= 100 && !budget[warn100Key]) {
      await budgetDoc.ref.set({ [warn100Key]: true }, { merge: true });
      await sendTelegramMessage(botToken, chatId,
        `🚨 *Budget ${escapeMarkdown(category)} habis!*\n\n` +
        `Bulan ini kamu sudah keluar *${formatRupiah(total)}* dari batas *${formatRupiah(limit)}* (${Math.round(pct)}%).\n` +
        `Yuk tahan dulu pengeluaran ${escapeMarkdown(category)} ya! 💪`
      );
    } else if (pct >= 80 && !budget[warn80Key]) {
      await budgetDoc.ref.set({ [warn80Key]: true }, { merge: true });
      await sendTelegramMessage(botToken, chatId,
        `⚠️ *Budget ${escapeMarkdown(category)} hampir habis!*\n\n` +
        `Sudah terpakai *${formatRupiah(total)}* dari *${formatRupiah(limit)}* (${Math.round(pct)}%).\n` +
        `Sisa budget: *${formatRupiah(Math.max(0, limit - total))}* — hati-hati ya! 🪙`
      );
    }
  } catch (err) {
    console.error('budgetWarning error:', err?.message);
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
            `🥳 *Impian Tercapai!* 🎉\n\n*${escapeMarkdown(g.name)}* (${formatRupiah(amt)}) berhasil dibeli!\n\n✅ Pengeluaran dicatat\n🎯 Target selesai & diarsipkan\n\nHebat, nabungmu membuahkan hasil! 🪙`
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

    // Fase 4: achievement card callback
    if (data.startsWith('ach:')) {
      await answerTelegramCallback(botToken, cb.id, '🎨 Membuat kartu...');
      const achKey = data.replace('ach:', '');
      try {
        let opts;
        if (achKey.startsWith('streak_')) {
          const days = parseInt(achKey.replace('streak_', ''), 10);
          opts = { type: 'streak', title: `Streak ${days} Hari!`, subtitle: `${days} hari berturut-turut catat keuangan`, streakDays: days };
        } else if (achKey.startsWith('goal_')) {
          const parts = achKey.split('_');
          const pct = parseInt(parts[parts.length - 1], 10);
          const gId = parts.slice(1, -1).join('_');
          let goalName = 'Target';
          if (db && uid) {
            try {
              const gDoc = await db.collection('users').doc(uid).collection('goals').doc(gId).get();
              if (gDoc.exists) goalName = gDoc.data()?.name || 'Target';
            } catch {}
          }
          opts = { type: 'goal', title: goalName, subtitle: `Progres ${pct}%`, percent: pct };
        } else {
          opts = { type: 'streak', title: 'Achievement', subtitle: achKey, streakDays: 0 };
        }
        const png = await generateAchievementCard(opts);
        await sendTelegramPhoto(botToken, chatId, png,
          'Ini kartu achievement kamu! Simpan gambarnya lalu bagikan ke status WA/IG kalau mau 🪙',
          { parse_mode: 'Markdown' }
        );
      } catch (err) {
        console.error('achievement card error:', err?.message);
        await sendTelegramMessage(botToken, chatId, '😅 Gagal membuat kartu. Coba lagi nanti ya!');
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

    await sendTelegramMessage(botToken, chatId, '🔍 *Pocky lagi teliti membaca struk & bukti transaksi kamu nih...*\nSebentar ya, Pocky periksa apakah ini struk belanja, bukti transfer, atau tagihan! 🪙');
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
      if (db) {
        const docRef = await db.collection('users').doc(uid).collection('transactions').add(tx);
        txId = docRef.id;
        await maybeSendLinkNudge(chatId, uid, db, botToken);
        if (tx.type === 'Expense') await checkBudgetWarnings(chatId, uid, db, botToken, tx.category);
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

      const reply = `${headerTitle}\n\n` +
        `${entityLabel} ${escapeMarkdown(r.merchant_name)}\n` +
        `💵 *Total:* *${amountSign}${formatRupiah(r.total_amount)}* (${txType === 'Income' ? '🟢 Pemasukan' : '🔴 Pengeluaran'})\n` +
        `🏷️ *Kategori:* ${escapeMarkdown(r.category)}\n` +
        `📅 *Tanggal:* ${formatShortDate(r.date)}\n` +
        `💳 *Metode:* ${escapeMarkdown(r.payment_method)}\n` +
        itemSummary +
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
          `🪙 *Hai ${userName}! Salam kenal, aku Pocky!*\n\n⚠️ Link tantangan tidak ditemukan atau sudah berakhir.\n\nAsisten keuangan pribadimu. Pocky bantu kamu:\n\n💸 Catat pemasukan & pengeluaran\n🧾 Scan foto struk otomatis\n🎯 Buat & pantau target tabungan\n📊 Cek saldo & riwayat kapan saja\n\nMulai: ketik \`kopi susu 25k\` atau kirim foto struk! 📖 /help`,
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
          `🪙 *Hai ${userName}! Salam kenal, aku Pocky!*\n\n🎁 Kamu diajak teman untuk pakai Pocketplan — selamat datang!\n\nAsisten keuangan pribadimu. Pocky bantu kamu:\n\n💸 Catat pemasukan & pengeluaran\n🧾 Scan foto struk otomatis\n🎯 Buat & pantau target tabungan\n📊 Cek saldo & riwayat kapan saja\n\nMulai: ketik \`kopi susu 25k\` atau kirim foto struk! 📖 /help`,
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
      `🪙 *Hai ${userName}! Salam kenal, aku Pocky!*\n\nAsisten keuangan pribadimu dari Pocketplan. Pocky bantu kamu:\n\n💸 Catat pemasukan & pengeluaran\n🧾 Scan foto struk & bukti transfer otomatis\n🎯 Buat & pantau target tabungan\n📊 Cek saldo & riwayat kapan saja\n\n*Mulai gampang banget:*\n• Kirim foto struk atau bukti transfer → otomatis dicatat Pocky!\n• Ketik langsung → \`kopi susu 25k\`\n• Pengeluaran → \`/catat bensin 50k\`\n• Pemasukan → \`/masuk gaji 2jt\`\n• Target baru → \`/goal Laptop 10jt\`\n• Cek saldo → \`/saldo\`\n\nKetik /help untuk panduan lengkap 📖`,
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
        `🥳 *Impian Tercapai!* 🎉\n\n*${escapeMarkdown(g.name)}* (${formatRupiah(amt)}) berhasil dibeli!\n\n✅ Pengeluaran dicatat\n🎯 Target selesai & diarsipkan\n\nHebat, nabungmu membuahkan hasil! 🪙`
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
      '📖 *PANDUAN LENGKAP POCKY* 🪙\n\n' +
      '*🧾 SCAN STRUK BARENG POCKY*\n' +
      '• Cukup kirim foto struk belanja atau bukti transfer langsung ke chat ini!\n' +
      '• Pocky otomatis membaca nama toko, daftar barang, & total transaksi.\n\n' +
      '*📝 CATAT PENGELUARAN*\n' +
      '• `kopi susu 25k` — ketik langsung\n' +
      '• `25k kopi susu` — nominal duluan juga bisa\n' +
      '• `/catat bensin 50k` — pakai perintah\n' +
      '• `/keluar makan siang 35k`\n\n' +
      '*💰 CATAT PEMASUKAN*\n' +
      '• `/masuk gaji 2jt`\n' +
      '• `/masuk freelance 500k`\n\n' +
      '*🎯 TARGET IMPIAN*\n' +
      '• `/goal Laptop Baru 10jt` — buat target\n' +
      '• `/goals` — lihat semua target & progres\n' +
      '• `/beligoal Laptop` — beli target tercapai\n\n' +
      '*💰 BUDGET BULANAN*\n' +
      '• `/budget Makan 1jt` — atur batas\n' +
      '• `/budget` — lihat semua budget\n' +
      '• `/budget hapus Makan` — hapus budget\n\n' +
      '*🎉 AJAK TEMAN*\n' +
      '• `/ajak` — dapatkan link referral untuk ajak teman\n\n' +
      '*🏆 TANTANGAN NABUNG BARENG (30 HARI)*\n' +
      '• `/tantangan` — cek tantangan & progres peserta\n' +
      '• *Tipe no_spend (Puasa Belanja)*: tantangan menahan diri tidak beli barang tertentu (kopi, boba, jajan, rokok, dll).\n' +
      '  Format: `/tantangan buat no_spend Kopi 30 Hari Tanpa Kopi`\n' +
      '• *Tipe daily_log (Rajin Catat)*: tantangan disiplin catat keuangan minimal 1x sehari bareng teman tanpa bolong.\n' +
      '  Format: `/tantangan buat daily_log Nabung Konsisten 30 Hari`\n' +
      '• `/tantangan gabung <ID>` — gabung lewat ID (atau klik link undangan teman)\n\n' +
      '*⏰ PENGINGAT HARIAN*\n' +
      '• `/pengingat` — kelola pengingat pagi & malam\n\n' +
      '*📊 INFO KEUANGAN*\n' +
      '• `/saldo` — cek sisa saldo\n' +
      '• `/riwayat` — 5 transaksi terakhir\n' +
      '• `/batal` — batalkan transaksi terakhir\n\n' +
      '*🔗 LAINNYA*\n' +
      '• `/web` — kode login website\n' +
      '• `/link KODE` — hubungkan akun website\n' +
      '• `/menu` — tampilkan keyboard menu\n\n' +
      '💡 _Nominal bisa ditulis: 50k, 50rb, 50.000, 1.5jt, Rp50000_',
      { reply_markup: KEYBOARD }
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
      return sendTelegramMessage(botToken, chatId, out);
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
  // Developer test command — preview streak / goal achievement card
  if (cmdText === '/teststreak' || cmdText.startsWith('/teststreak ') || cmdText === '/testkartu' || cmdText.startsWith('/testkartu ')) {
    const rawArgs = text.replace(/^\/(teststreak|testkartu)(@\S+)?\s*/i, '').trim();
    const isGoal = rawArgs.toLowerCase().startsWith('goal');
    let days = 7;
    let targetChatId = chatId;
    const parts = rawArgs.split(/\s+/).filter(Boolean);
    for (const p of parts) {
      if (/^\d{7,12}$/.test(p)) targetChatId = p;
      else if (/^\d+$/.test(p)) days = parseInt(p, 10);
    }
    const opts = isGoal
      ? { type: 'goal', title: 'Target Tabungan', subtitle: 'Target Rp 10.000.000', percent: 75 }
      : { type: 'streak', title: `Streak ${days} Hari! 🔥`, subtitle: `${days} hari berturut-turut catat keuangan`, streakDays: days };

    try {
      const png = await generateAchievementCard(opts);
      await sendTelegramPhoto(botToken, targetChatId, png,
        `🎨 *Kartu Achievement (${opts.type.toUpperCase()})*\n\nSimpan atau bagikan kartu ini ke status IG/WA! 🪙`,
        { parse_mode: 'Markdown' }
      );
      if (String(targetChatId) !== String(chatId)) {
        await sendTelegramMessage(botToken, chatId, `✅ Kartu achievement berhasil dikirim ke Chat ID: \`${targetChatId}\``);
      }
      return sendTelegramMessage(botToken, targetChatId,
        `🔥 *Tes Notifikasi Streak Milestone*\n\nSelamat! Kamu telah mencapai streak *${days} hari* berturut-turut! 🎉\n\n_Pocky Developer Preview_`
      );
    } catch (err) {
      return sendTelegramMessage(botToken, chatId, `⚠️ Gagal generate kartu: ${err?.message}`);
    }
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

    // /tantangan (list active challenges)
    try {
      const cSnap = await db.collection('challenges').where('status', '==', 'active').get();
      const mine = [];
      cSnap.forEach(d => {
        const c = d.data();
        if ((c.participants || []).some(p => String(p.chatId) === String(chatId))) {
          mine.push({ id: d.id, ...c });
        }
      });
      if (mine.length === 0) {
        return sendTelegramMessage(botToken, chatId,
          '🏆 *Belum ada tantangan aktif*\n\n' +
          'Yuk mulai tantangan 30 hari bareng teman:\n\n' +
          '🚫 *Puasa Belanja (`no_spend`)*:\n' +
          '`/tantangan buat no_spend Kopi 30 Hari Tanpa Kopi`\n\n' +
          '📝 *Rajin Catat (`daily_log`)*:\n' +
          '`/tantangan buat daily_log Nabung 30 Hari Rajin Catat`\n\n' +
          '💡 _Pocky otomatis kirim link undangan untuk temanmu bergabung!_',
          { reply_markup: KEYBOARD }
        );
      }
      let out = '🏆 *Tantangan Aktifmu:*\n\n';
      const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
      for (const c of mine) {
        const totalDays = c.days || 30;
        const startD = new Date(c.startDate + 'T00:00:00');
        const todayD = new Date(todayStr + 'T00:00:00');
        const daysPassed = Math.max(0, Math.min(totalDays, Math.round((todayD - startD) / (86400000))));
        out += `📌 *${escapeMarkdown(c.title)}*\n📅 Hari ${daysPassed}/${totalDays}\n`;
        for (const p of (c.participants || [])) {
          const progress = p.progress || {};
          const passedDays = Object.values(progress).filter(v => v === true).length;
          const pct = daysPassed > 0 ? Math.round((passedDays / daysPassed) * 100) : 0;
          let streak7 = '';
          for (let i = 6; i >= 0; i--) {
            const d = new Date(todayD); d.setDate(d.getDate() - i);
            const ds = d.toISOString().split('T')[0];
            if (ds < c.startDate) { streak7 += '⬜'; continue; }
            streak7 += progress[ds] === true ? '✅' : progress[ds] === false ? '❌' : '⬜';
          }
          out += `  ${escapeMarkdown(p.displayName)} ${pct}% ${streak7}\n`;
        }
        out += '\n';
      }
      return sendTelegramMessage(botToken, chatId, out, { reply_markup: KEYBOARD });
    } catch (err) {
      console.error('tantangan list error:', err?.message);
      return sendTelegramMessage(botToken, chatId, '❌ Gagal memuat tantangan.');
    }
  }

  // /budget command — list, set, or delete budget per category
  if (cmdText === '/budget' || cmdText.startsWith('/budget ')) {
    const args = text.replace(/^\/budget(@\S+)?\s*/i, '').trim();
    if (!db) return sendTelegramMessage(botToken, chatId, 'Mode demo aktif.');

    // /budget hapus <category>
    const hapusMatch = args.match(/^hapus\s+(.+)/i);
    if (hapusMatch) {
      const cat = hapusMatch[1].trim();
      const snap = await db.collection('users').doc(uid).collection('budgets')
        .where('category', '==', cat).limit(1).get();
      if (snap.empty) return sendTelegramMessage(botToken, chatId, `🤷 Budget *${escapeMarkdown(cat)}* tidak ditemukan.`);
      await snap.docs[0].ref.delete();
      return sendTelegramMessage(botToken, chatId, `🗑️ Budget *${escapeMarkdown(cat)}* dihapus.`, { reply_markup: KEYBOARD });
    }

    // /budget <category> <amount> — set budget
    const setMatch = args.match(/^(.+?)\s+([\d.,]+(?:k|rb|jt|juta|ribu)?(?:\d*)?)$/i);
    if (setMatch) {
      const cat = setMatch[1].trim();
      const limit = parseAmount(setMatch[2]);
      if (!limit || limit <= 0) return sendTelegramMessage(botToken, chatId, '❌ Nominal budget tidak valid.');
      const snap = await db.collection('users').doc(uid).collection('budgets')
        .where('category', '==', cat).limit(1).get();
      if (snap.empty) {
        await db.collection('users').doc(uid).collection('budgets').add({
          category: cat, monthlyLimit: limit, createdAt: new Date().toISOString()
        });
      } else {
        await snap.docs[0].ref.set({ monthlyLimit: limit }, { merge: true });
      }
      return sendTelegramMessage(botToken, chatId,
        `💰 *Budget ${escapeMarkdown(cat)} diatur!*\nBatas bulanan: *${formatRupiah(limit)}*`,
        { reply_markup: KEYBOARD }
      );
    }

    // /budget — list all budgets
    const budgetSnap = await db.collection('users').doc(uid).collection('budgets').get();
    if (budgetSnap.empty) {
      return sendTelegramMessage(botToken, chatId,
        '💰 *Belum ada budget*\n\nAtur budget:\n`/budget Makan 1jt`\n`/budget Transport 500k`\n\nHapus:\n`/budget hapus Makan`'
      );
    }

    // Get current month spending per category
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthStart = `${monthKey}-01`;
    const nextMonth = now.getMonth() === 11
      ? `${now.getFullYear() + 1}-01-01`
      : `${now.getFullYear()}-${String(now.getMonth() + 2).padStart(2, '0')}-01`;

    const txSnap = await db.collection('users').doc(uid).collection('transactions')
      .where('type', '==', 'Expense')
      .where('date', '>=', monthStart)
      .where('date', '<', nextMonth)
      .get();
    const spending = {};
    txSnap.forEach(d => {
      const t = d.data();
      spending[t.category] = (spending[t.category] || 0) + (Number(t.amount) || 0);
    });

    let out = '💰 *Budget Bulan Ini*\n\n';
    budgetSnap.forEach(d => {
      const b = d.data();
      const spent = spending[b.category] || 0;
      const lim = Number(b.monthlyLimit) || 0;
      const pct = lim > 0 ? Math.round((spent / lim) * 100) : 0;
      const icon = pct >= 100 ? '🚨' : pct >= 80 ? '⚠️' : '✅';
      out += `${icon} *${escapeMarkdown(b.category)}*\n   ${formatRupiah(spent)} / ${formatRupiah(lim)} (${pct}%)\n   ${renderBar(spent, lim)}\n\n`;
    });
    out += '_Atur: `/budget Makan 1jt` • Hapus: `/budget hapus Makan`_';
    return sendTelegramMessage(botToken, chatId, out, { reply_markup: KEYBOARD });
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
    if (db) await db.collection('users').doc(uid).collection('transactions').add(parsed);
    await maybeSendLinkNudge(chatId, uid, db, botToken);
    if (parsed.type === 'Expense') await checkBudgetWarnings(chatId, uid, db, botToken, parsed.category);
    await handleStreakAfterTransaction(chatId, uid, db, botToken);
    if (parsed.type === 'Income') {
      return sendTelegramMessage(
        botToken,
        chatId,
        `🎉 *Yey, Pemasukan Dicatat Pocky!* 💰\n🟢 +*${formatRupiah(parsed.amount)}*\n📝 *${escapeMarkdown(parsed.description)}*\n📁 ${escapeMarkdown(parsed.category)} • 📅 ${formatShortDate(parsed.date)}`
      );
    }
    return sendTelegramMessage(
      botToken,
      chatId,
      `💸 *Pengeluaran Dicatat Pocky!* ✨\n🔴 -*${formatRupiah(parsed.amount)}*\n📝 *${escapeMarkdown(parsed.description)}*\n📁 ${escapeMarkdown(parsed.category)} • 📅 ${formatShortDate(parsed.date)}\n\n💡 _Salah catat? Ketik \`/batal\` buat menghapus._`
    );
  }

  return sendTelegramMessage(
    botToken,
    chatId,
    `❓ *Perintah tidak dikenali*\n\nBerikut contoh yang bisa kamu ketik:\n📝 \`kopi susu 25k\` — catat pengeluaran\n💰 \`/masuk gaji 2jt\` — catat pemasukan\n🎯 \`/goal Laptop 10jt\` — buat target\n\nKetik /help untuk panduan lengkap 📖`,
    { reply_markup: KEYBOARD }
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
              if (!seen.includes(badge)) { seen.push(badge); await uRef.set({ achievementsSeen: seen }, { merge: true }); }
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

