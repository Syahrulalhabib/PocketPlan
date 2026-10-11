import { parseTransactionCommand, parseAmount, formatRupiah } from './telegramParser.js';
import { parseReceiptText } from './parseReceipt.js';
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
    [{ text: '📜 Riwayat' }, { text: '📸 Scan Struk' }],
    [{ text: '🌐 Buka di Web' }]
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

// TODO(perf): getBalance reads all transactions; add server-side balance caching if collection grows large
async function getBalance(uid, db) {
  let inc = 0, exp = 0, base = 0;
  if (db && uid) {
    const uDoc = await db.collection('users').doc(uid).get();
    base = Number(uDoc.data()?.baseBalance || 0);
    const snap = await db.collection('users').doc(uid).collection('transactions').get();
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
  if (!msg) return;

  const chatId = msg.chat.id;
  const userFrom = msg.from || {};

  // Handle photo (receipt scan)
  if (msg.photo && msg.photo.length > 0) {
    const uid = await findLinkedUid(chatId, db);
    if (!uid) {
      return sendTelegramMessage(botToken, chatId,
        '🔗 *Akun belum terhubung*\n\nHubungkan dulu di web PocketPlan, lalu kirim kode 6 huruf ke sini.'
      );
    }
    return handleReceiptPhoto(msg, chatId, uid, db, botToken);
  }

  if (!msg.text) return;
  const text = msg.text.trim();
  const userName = escapeMarkdown(userFrom.first_name || 'Teman');

  if (text.startsWith('/start')) {
    const parts = text.split(/\s+/);
    if (parts.length > 1) {
      if (!checkLinkRateLimit(chatId)) {
        return sendTelegramMessage(botToken, chatId, '⚠️ Terlalu banyak percobaan kode gagal. Coba lagi nanti.');
      }

      const res = await linkChatWithCode(chatId, parts[1], userFrom, db);
      if (res === 'EXPIRED') return sendTelegramMessage(botToken, chatId, '⏳ *Kode kedaluwarsa*\nBuat kode baru di website: *Profile → Telegram Bot*.');
      if (res) {
        return sendTelegramMessage(
          botToken,
          chatId,
          '🎉 *Akun berhasil terhubung!*\n\nSemua catatan keuanganmu kini sinkron otomatis antara Telegram dan PocketPlan web.\n\nMau mulai catat? Coba ketik: `kopi 15k`',
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
      `🪙 *Hai ${userName}! Salam kenal, aku Pocky!*\n\nAsisten keuangan pribadimu di Telegram. Aku bantu kamu:\n\n💸 Catat pemasukan & pengeluaran\n🎯 Buat & pantau target tabungan\n📊 Cek saldo & riwayat kapan saja\n\n*Mulai gampang banget:*\n• Ketik langsung → \`kopi susu 25k\`\n• Pengeluaran → \`/catat bensin 50k\`\n• Pemasukan → \`/masuk gaji 2jt\`\n• Target baru → \`/goal Laptop 10jt\`\n• Cek saldo → \`/saldo\`\n\nKetik /help untuk panduan lengkap 📖`,
      { reply_markup: KEYBOARD }
    );
  }

  if (text.startsWith('/link') || text.startsWith('/hubungkan')) {
    const parts = text.split(/\s+/);
    if (parts.length < 2) {
      return sendTelegramMessage(botToken, chatId, '🔗 *Hubungkan Akun Website*\n\nKetik: `/link KODE`\nContoh: `/link AB12CD`\n\n_Ambil kode di menu Profile → Telegram Bot di website PocketPlan._');
    }
    if (!checkLinkRateLimit(chatId)) {
      return sendTelegramMessage(botToken, chatId, '⚠️ Terlalu banyak percobaan kode gagal. Coba lagi nanti.');
    }

    const res = await linkChatWithCode(chatId, parts[1], userFrom, db);
    if (res === 'EXPIRED') return sendTelegramMessage(botToken, chatId, '⏳ *Kode kedaluwarsa*\nBuat kode baru di menu Profile website.');
    if (res) {
      return sendTelegramMessage(
        botToken,
        chatId,
        '🎉 *Akun tersambung!*\nSemua catatan kini sinkron otomatis ke website PocketPlan.',
        { reply_markup: KEYBOARD }
      );
    }
    recordLinkFail(chatId);

    return sendTelegramMessage(botToken, chatId, '❌ *Kode tidak ditemukan*\nPastikan kode sama persis dengan yang tertera di website.');
  }

  const uid = await ensureTelegramUser(chatId, userFrom, db);

  if (text === '/unlink' || text === '/putus' || text.startsWith('/unlink@') || text.startsWith('/putus@')) {
    await unlinkAccount(uid, db);
    return sendTelegramMessage(botToken, chatId, '🔌 *Koneksi diputus*\nAkun Telegram tidak lagi terhubung ke website PocketPlan.');
  }

  if (text === '/menu' || text.startsWith('/menu@')) return sendTelegramMessage(botToken, chatId, '📱 *Menu PocketPlan*\nPilih menu di bawah atau ketik perintah langsung.', { reply_markup: KEYBOARD });

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

  if (text === '📸 Scan Struk') {
    return sendTelegramMessage(botToken, chatId,
      '📸 *Scan Struk*\nKirim foto struk/receipt ke sini, dan aku akan otomatis membaca dan mencatat transaksinya\\!\n\n💡 *Tips:*\n• Pastikan foto jelas dan tidak buram\n• Bisa tambahkan caption untuk override, misal: `25k makan`\n• Foto struk apapun — minimarket, restoran, SPBU, dll'
    );
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
      '📖 *PANDUAN LENGKAP POCKY* 🪙\n\n*📝 CATAT PENGELUARAN*\n• `kopi susu 25k` — ketik langsung\n• `25k kopi susu` — nominal duluan juga bisa\n• `/catat bensin 50k` — pakai perintah\n• `/keluar makan siang 35k`\n\n*💰 CATAT PEMASUKAN*\n• `/masuk gaji 2jt`\n• `/masuk freelance 500k`\n\n*🎯 TARGET IMPIAN*\n• `/goal Laptop Baru 10jt` — buat target\n• `/goals` — lihat semua target & progres\n• `/beligoal Laptop` — beli target tercapai\n\n*📊 INFO KEUANGAN*\n• `/saldo` — cek sisa saldo\n• `/riwayat` — 5 transaksi terakhir\n• `/batal` — batalkan transaksi terakhir\n\n*🔗 LAINNYA*\n• `/web` — kode login website\n• `/link KODE` — hubungkan akun website\n• `/menu` — tampilkan keyboard menu\n\n💡 _Nominal bisa ditulis: 50k, 50rb, 50.000, 1.5jt, Rp50000_',
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
        return sendTelegramMessage(botToken, chatId, `🗑️ *Dibatalkan!*\nTransaksi *${data.description}* (${formatRupiah(data.amount)}) telah dihapus.\n\n🎯 Target *${gb.name}* telah dikembalikan ke daftar goal.`);
      }
      return sendTelegramMessage(botToken, chatId, `🗑️ *Dibatalkan!*\nTransaksi *${data.description}* (${formatRupiah(data.amount)}) telah dihapus.`);
    }
    return sendTelegramMessage(botToken, chatId, 'Dibatalkan.');
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
    if (parsed.type === 'Income') {
      return sendTelegramMessage(
        botToken,
        chatId,
        `✅ *Pemasukan Dicatat*\n🟢 +*${formatRupiah(parsed.amount)}*\n📝 *${escapeMarkdown(parsed.description)}*\n📁 ${escapeMarkdown(parsed.category)} • 📅 ${formatShortDate(parsed.date)}`
      );
    }
    return sendTelegramMessage(
      botToken,
      chatId,
      `✅ *Pengeluaran Dicatat*\n🔴 -*${formatRupiah(parsed.amount)}*\n📝 *${escapeMarkdown(parsed.description)}*\n📁 ${escapeMarkdown(parsed.category)} • 📅 ${formatShortDate(parsed.date)}`
    );
  }

  return sendTelegramMessage(
    botToken,
    chatId,
    `❓ *Perintah tidak dikenali*\n\nBerikut contoh yang bisa kamu ketik:\n📝 \`kopi susu 25k\` — catat pengeluaran\n💰 \`/masuk gaji 2jt\` — catat pemasukan\n🎯 \`/goal Laptop 10jt\` — buat target\n\nKetik /help untuk panduan lengkap 📖`,
    { reply_markup: KEYBOARD }
  );
}

async function handleReceiptPhoto(msg, chatId, uid, db, botToken) {
  // Get largest photo (last in array)
  const photo = msg.photo[msg.photo.length - 1];
  const caption = msg.caption || '';

  try {
    // Tell user we're processing
    await sendTelegramMessage(botToken, chatId, '🔍 _Memindai struk..._');

    // Download file from Telegram
    const fileRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${photo.file_id}`);
    const fileData = await fileRes.json();
    if (!fileData.ok || !fileData.result?.file_path) {
      return sendTelegramMessage(botToken, chatId, '❌ Gagal mengunduh foto. Coba kirim ulang.');
    }

    const imageUrl = `https://api.telegram.org/file/bot${botToken}/${fileData.result.file_path}`;
    const imgRes = await fetch(imageUrl);
    const imgBuffer = Buffer.from(await imgRes.arrayBuffer());

    // OCR via Tesseract.js
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker('ind+eng');
    const { data: { text: ocrText } } = await worker.recognize(imgBuffer);
    await worker.terminate();

    if (!ocrText || ocrText.trim().length < 5) {
      return sendTelegramMessage(botToken, chatId,
        '❌ *Tidak bisa membaca struk*\n\nPastikan foto jelas dan tidak buram. Coba foto ulang.'
      );
    }

    // Parse receipt
    const parsed = parseReceiptText(ocrText);

    // Override from caption if user typed something like "makan" or amount
    if (caption) {
      const captionParsed = parseTransactionCommand(caption, 'Expense');
      if (captionParsed?.amount) parsed.amount = captionParsed.amount;
      if (captionParsed?.category && captionParsed.category !== 'General') parsed.category = captionParsed.category;
      if (captionParsed?.description) parsed.description = captionParsed.description;
    }

    if (!parsed.amount) {
      return sendTelegramMessage(botToken, chatId,
        `🧾 *Struk terbaca, tapi nominal tidak terdeteksi*\n\n📝 Teks: _${escapeMarkdown(ocrText.substring(0, 200))}..._\n\nCoba kirim ulang dengan caption nominal, contoh:\n\`25000\` atau \`25k\``
      );
    }

    // Save transaction
    const txData = {
      type: parsed.type || 'Expense',
      category: parsed.category || 'Shopping',
      amount: parsed.amount,
      description: parsed.description || 'Struk',
      date: parsed.date || new Date().toISOString().slice(0, 10),
      createdAt: new Date().toISOString(),
      source: 'telegram-ocr'
    };

    if (db) await db.collection('users').doc(uid).collection('transactions').add(txData);

    const emoji = txData.type === 'Income' ? '🟢 +' : '🔴 -';
    return sendTelegramMessage(botToken, chatId,
      `✅ *Struk Berhasil Dicatat!*\n${emoji}*${formatRupiah(txData.amount)}*\n📝 *${escapeMarkdown(txData.description)}*\n📁 ${escapeMarkdown(txData.category)} • 📅 ${formatShortDate(txData.date)}\n\n_📸 Dari scan struk otomatis_`
    );
  } catch (err) {
    console.error('Receipt OCR error:', err);
    return sendTelegramMessage(botToken, chatId,
      '❌ *Gagal memproses struk*\n\nMungkin timeout atau gambar terlalu besar. Coba foto lebih kecil atau catat manual.\nContoh: `kopi susu 25k`'
    );
  }
}



async function sendSaldo(chatId, uid, db, botToken) {
  const { bal, inc, exp } = await getBalance(uid, db);
  const text = `💳 *Dompet PocketPlan*\n\n💰 *Saldo:* \`${formatRupiah(bal)}\`\n🟢 Pemasukan: ${formatRupiah(inc)}\n🔴 Pengeluaran: ${formatRupiah(exp)}\n\n_Uang tercatat rapi, masa depan tenang._`;
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
  const { code } = await generateWebLoginCode(uid, db);
  const text = `🌐 *Kode Login Website*\n\nBuka PocketPlan di browser, pilih tab *Telegram*, masukkan kode:\n\n🔑 Kode: \`${code}\`\n⏱️ _Berlaku 15 menit_`;
  return sendTelegramMessage(botToken, chatId, text);
}
