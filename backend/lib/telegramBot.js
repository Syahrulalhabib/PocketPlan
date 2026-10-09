import { parseTransactionCommand, parseAmount, formatRupiah } from './telegramParser.js';
import {
  sendTelegramMessage,
  answerTelegramCallback,
  generateLinkCode,
  getLinkStatus,
  unlinkAccount,
  findLinkedUid,
  linkChatWithCode,
  ensureTelegramUser,
  generateWebLoginCode
} from './telegramBotCore.js';

export { generateLinkCode, getLinkStatus, unlinkAccount, sendTelegramMessage };

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

export async function handleTelegramUpdate(update, db, botToken) {
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
          await db.collection('users').doc(uid).collection('transactions').add({
            category: 'Shopping',
            type: 'Expense',
            amount: amt,
            description: `Pembelian Goal: ${g.name}`,
            date: new Date().toISOString().split('T')[0],
            createdAt: new Date().toISOString()
          });
          await ref.delete();
          await answerTelegramCallback(botToken, cb.id, '🎉 Impian terbeli!');
          return sendTelegramMessage(
            botToken,
            chatId,
            `🥳 *HOREEE! IMPIAN TERCAPAI!* 🎉🛍️\n\nBarang idamanmu *${g.name}* (${formatRupiah(amt)}) resmi dibeli!\n\n✅ Pengeluaran dicatat\n🎯 Target selesai & diarsipkan\n\nKeren banget, nabungnya berhasil! 🪙✨`
          );
        }
      }
      await answerTelegramCallback(botToken, cb.id, 'Target tidak ditemukan.');
      return;
    }

    if (data === 'saldo') {
      await answerTelegramCallback(botToken, cb.id);
      return sendSaldo(chatId, uid, db, botToken);
    }
    if (data === 'goals') {
      await answerTelegramCallback(botToken, cb.id);
      return sendGoals(chatId, uid, db, botToken);
    }
    await answerTelegramCallback(botToken, cb.id);
    return;
  }
  const msg = update?.message || update?.edited_message;
  if (!msg?.text) return;

  const chatId = msg.chat.id;
  const text = msg.text.trim();
  const userFrom = msg.from || {};
  const userName = userFrom.first_name || 'Teman';

  if (text.startsWith('/start')) {
    const parts = text.split(/\s+/);
    if (parts.length > 1) {
      const res = await linkChatWithCode(chatId, parts[1], userFrom, db);
      if (res === 'EXPIRED') return sendTelegramMessage(botToken, chatId, '⌛ *Ups, kodenya kedaluwarsa!*\nBikin kode baru di web yuk: *Profile > Telegram Bot*.');
      if (res) {
        return sendTelegramMessage(
          botToken,
          chatId,
          '🎉 *Hore, akunmu terhubung!* 🪙\nSemua catatan di bot ini langsung sinkron ke PocketPlan web.\n\nMau catat apa hari ini? 🚀',
          { reply_markup: KEYBOARD }
        );
      }
      return sendTelegramMessage(botToken, chatId, '❌ *Kodenya kurang pas nih.*\nCek lagi 6 karakter kodenya di menu *Profile* website ya!');
    }
    await ensureTelegramUser(chatId, userFrom, db);
    return sendTelegramMessage(
      botToken,
      chatId,
      `👋 *Hai, ${userName}!* Aku *Pocky* 🪙✨\nTeman pintar buat atur keuangan & wujudkan impianmu!\n\n💡 *Cara cepat catat uang:*\n• \`35k makan bakso\` *(langsung dicatat!)*\n• \`/masuk 2jt gaji bulanan\`\n• \`/saldo\` — intip sisa uang\n• \`/goals\` — cek target impian\n• \`/web\` — kode login website\n\nYuk mulai, mau catat apa hari ini? 👇`,
      { reply_markup: KEYBOARD }
    );
  }

  if (text.startsWith('/link') || text.startsWith('/hubungkan')) {
    const parts = text.split(/\s+/);
    if (parts.length < 2) {
      return sendTelegramMessage(botToken, chatId, '💡 *Cara Hubungkan Akun:*\nKetik: `/link [KODE]`\nContoh: `/link AB12CD`\n\n_(Ambil kodenya di menu Profile website PocketPlan)_');
    }
    const res = await linkChatWithCode(chatId, parts[1], userFrom, db);
    if (res === 'EXPIRED') return sendTelegramMessage(botToken, chatId, '⌛ *Kodenya sudah kedaluwarsa!*\nAmbil kode baru di menu Profile website ya.');
    if (res) {
      return sendTelegramMessage(
        botToken,
        chatId,
        '🎉 *Sip, akunmu tersambung!*\nSemua catatan di sini langsung sinkron ke website PocketPlan.',
        { reply_markup: KEYBOARD }
      );
    }
    return sendTelegramMessage(botToken, chatId, '❌ *Kode tidak ditemukan.*\nPastikan kodenya sama persis dengan yang ada di web ya!');
  }

  const uid = await ensureTelegramUser(chatId, userFrom, db);

  if (text === '/unlink' || text === '/putus') {
    await unlinkAccount(uid, db);
    return sendTelegramMessage(botToken, chatId, '🔌 *Koneksi Terputus!*\nAkun Telegram kamu sudah dilepas dari website.');
  }

  if (text === '/menu') return sendTelegramMessage(botToken, chatId, '📱 *Menu PocketPlan:*', { reply_markup: KEYBOARD });

  if (text === '💸 Catat Keluar' || text === '💸 Catat Pengeluaran') {
    return sendTelegramMessage(botToken, chatId, '💸 *Catat Pengeluaran*\nLangsung ketik nominal & keterangannya, atau sebaliknya:\n👉 `25k kopi susu`\n👉 `kopi susu 25k`\n👉 `/catat makan siang 50k`');
  }

  if (text === '💰 Catat Masuk' || text === '💰 Tambah Pemasukan') {
    return sendTelegramMessage(botToken, chatId, '💰 *Catat Pemasukan*\nKetik keterangan & sumber pemasukannya:\n👉 `/masuk gaji bulanan 2.5jt`\n👉 `/masuk 300k freelance`');
  }

  if (text === '/goals' || text === '🎯 Target Impian' || text === '🎯 Target Goals') {
    return sendGoals(chatId, uid, db, botToken);
  }

  if (text === '/web' || text === '🌐 Buka di Web' || text === '🌐 Akses Web') {
    return sendWebAccess(chatId, uid, db, botToken);
  }

  if (text.startsWith('/goal')) {
    const raw = text.replace('/goal', '').trim();
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
      `🎯 *Target Baru Dibuat!* ✨\n\n📌 *${name}*\n🎯 Target: *${formatRupiah(amt)}*\n\nKetik \`/goals\` kapan saja buat cek progres tabunganmu! 🚀`
    );
  }

  if (text.startsWith('/beligoal')) {
    const q = text.replace('/beligoal', '').trim().toLowerCase();
    if (db) {
      const snap = await db.collection('users').doc(uid).collection('goals').get();
      const match = snap.docs.find((d) => d.id === q || d.data().name?.toLowerCase().includes(q));
      if (!match) return sendTelegramMessage(botToken, chatId, `❌ Target "${q}" tidak ditemukan.`);
      const g = match.data();
      const amt = Number(g.target) || 0;
      await db.collection('users').doc(uid).collection('transactions').add({
        category: 'Shopping',
        type: 'Expense',
        amount: amt,
        description: `Pembelian Goal: ${g.name}`,
        date: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString()
      });
      await match.ref.delete();
      return sendTelegramMessage(
        botToken,
        chatId,
        `🥳 *HOREEE! IMPIAN TERCAPAI!* 🎉🛍️\n\nBarang idamanmu *${g.name}* (${formatRupiah(amt)}) resmi dibeli!\n\n✅ Pengeluaran dicatat\n🎯 Target selesai & diarsipkan\n\nHebat! Nabungnya membuahkan hasil 🪙✨`
      );
    }
    return sendTelegramMessage(botToken, chatId, 'Target dibeli.');
  }

  if (text === '/help' || text === '/bantuan') {
    return sendTelegramMessage(
      botToken,
      chatId,
      '📖 *PANDUAN SINGKAT POCKY* 🪙\n\n• `makan siang 35k` — catat keluar kilat\n• `/catat bensin 50k` — catat pengeluaran\n• `/masuk gaji 2jt` — catat pemasukan\n• `/saldo` — cek sisa saldo\n• `/goals` — lihat target impian\n• `/goal Motor 10jt` — buat target baru\n• `/beligoal [nama]` — beli target tercapai\n• `/web` — kode login website\n• `/riwayat` — 5 transaksi terakhir\n• `/batal` — hapus transaksi terakhir',
      { reply_markup: KEYBOARD }
    );
  }

  if (text === '/saldo' || text === '/balance' || text === '📊 Cek Saldo') {
    return sendSaldo(chatId, uid, db, botToken);
  }

  if (text === '/riwayat' || text === '/history' || text === '📜 Riwayat' || text === '📜 5 Riwayat') {
    if (db) {
      const snap = await db.collection('users').doc(uid).collection('transactions').orderBy('date', 'desc').limit(5).get();
      if (snap.empty) return sendTelegramMessage(botToken, chatId, '📜 *Belum ada transaksi.*\nYuk mulai catat, misalnya ketik: `25k makan siang`');
      let out = '📜 *5 Transaksi Terakhir:*\n\n';
      let i = 1;
      snap.forEach((d) => {
        const t = d.data();
        const sign = t.type === 'Income' ? '🟢 +' : '🔴 -';
        out += `${i}. ${sign}*${formatRupiah(t.amount)}*\n   ${t.description || t.category} • ${formatShortDate(t.date)}\n\n`;
        i++;
      });
      out += '💡 _Salah catat? Ketik `/batal` untuk hapus yang terakhir._';
      return sendTelegramMessage(botToken, chatId, out);
    }
    return sendTelegramMessage(botToken, chatId, 'Mode demo aktif.');
  }

  if (text === '/batal' || text === '/hapus') {
    if (db) {
      const snap = await db.collection('users').doc(uid).collection('transactions').orderBy('createdAt', 'desc').limit(1).get();
      if (snap.empty) return sendTelegramMessage(botToken, chatId, '🤷 Tidak ada transaksi untuk dibatalkan.');
      const d = snap.docs[0];
      const data = d.data();
      await d.ref.delete();
      return sendTelegramMessage(botToken, chatId, `🗑️ *Dibatalkan!*\nTransaksi *${data.description}* (${formatRupiah(data.amount)}) telah dihapus.`);
    }
    return sendTelegramMessage(botToken, chatId, 'Dibatalkan.');
  }

  const parsed = parseTransactionCommand(text);
  if (parsed) {
    if (db) await db.collection('users').doc(uid).collection('transactions').add(parsed);
    if (parsed.type === 'Income') {
      return sendTelegramMessage(
        botToken,
        chatId,
        `✨ *Pemasukan Dicatat!*\n🟢 +*${formatRupiah(parsed.amount)}*\n📝 *${parsed.description}*\n📁 ${parsed.category} • 📅 ${formatShortDate(parsed.date)}`
      );
    }
    return sendTelegramMessage(
      botToken,
      chatId,
      `✨ *Pengeluaran Dicatat!*\n🔴 -*${formatRupiah(parsed.amount)}*\n📝 *${parsed.description}*\n📁 ${parsed.category} • 📅 ${formatShortDate(parsed.date)}`
    );
  }

  return sendTelegramMessage(
    botToken,
    chatId,
    '💡 *Pocky bingung nih...*\nCoba ketik langsung seperti ini:\n👉 `25k es kopi`\n👉 `/masuk 1jt gaji`\n\nAtau pilih menu di bawah ya! 👇',
    { reply_markup: KEYBOARD }
  );
}

async function sendSaldo(chatId, uid, db, botToken) {
  let bal = 0, inc = 0, exp = 0;
  if (db && uid) {
    const uDoc = await db.collection('users').doc(uid).get();
    const base = Number(uDoc.data()?.baseBalance || 0);
    const snap = await db.collection('users').doc(uid).collection('transactions').get();
    snap.forEach((d) => {
      const t = d.data();
      const a = Number(t.amount) || 0;
      if (t.type === 'Income') inc += a;
      else exp += a;
    });
    bal = base + inc - exp;
  }
  const text = `💳 *DOMPET POCKETPLAN*\n\n💰 *Sisa Saldo:* \`${formatRupiah(bal)}\`\n🟢 Pemasukan: ${formatRupiah(inc)}\n🔴 Pengeluaran: ${formatRupiah(exp)}\n\n✨ _"Uang yang tercatat rapi bikin masa depan tenang."_`;
  return sendTelegramMessage(botToken, chatId, text, {
    reply_markup: { inline_keyboard: [[{ text: '🎯 Lihat Target Impian', callback_data: 'goals' }]] }
  });
}

async function sendGoals(chatId, uid, db, botToken) {
  let goals = [], bal = 0;
  if (db && uid) {
    const uDoc = await db.collection('users').doc(uid).get();
    let inc = 0, exp = 0;
    const base = Number(uDoc.data()?.baseBalance || 0);
    const txSnap = await db.collection('users').doc(uid).collection('transactions').get();
    txSnap.forEach((d) => {
      const t = d.data();
      const a = Number(t.amount) || 0;
      if (t.type === 'Income') inc += a;
      else exp += a;
    });
    bal = base + inc - exp;
    const gSnap = await db.collection('users').doc(uid).collection('goals').get();
    goals = gSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  if (goals.length === 0) {
    return sendTelegramMessage(
      botToken,
      chatId,
      '🎯 *Belum ada target impian nih!*\n\nBikin target yuk biar makin semangat nabung:\n👉 `/goal Laptop Baru 10jt`\n👉 `/goal Sepatu Lari 500k`'
    );
  }

  let text = `🎯 *TARGET IMPIAN KAMU*\n💵 Saldo Tersedia: *${formatRupiah(bal)}*\n\n`;
  const buttons = [];
  goals.forEach((g, i) => {
    const tgt = Number(g.target) || 1;
    const done = bal >= tgt;
    text += `${i + 1}. *${g.name}*\n   Target: ${formatRupiah(tgt)}\n   Progres: ${renderBar(bal, tgt)}${done ? ' 🏆 *BISA DIBELI!*' : ''}\n\n`;
    if (done) buttons.push([{ text: `🛍️ Beli: ${g.name}`, callback_data: `buy:${g.id}` }]);
  });

  return sendTelegramMessage(botToken, chatId, text, {
    reply_markup: buttons.length > 0 ? { inline_keyboard: buttons } : undefined
  });
}

async function sendWebAccess(chatId, uid, db, botToken) {
  const { code } = await generateWebLoginCode(uid, db);
  const text = `🌐 *KODE LOGIN WEBSITE*\n\nBuka PocketPlan di browser, pilih tab *Telegram*, lalu masukkan kode ini:\n\n🔑 Kode: \`${code}\`\n⏱️ _(Berlaku 15 menit)_\n\n🚀 Nikmati visual grafik & kelola keuanganmu di layar lebar!`;
  return sendTelegramMessage(botToken, chatId, text);
}
