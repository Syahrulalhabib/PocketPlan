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

function escapeMarkdown(text) {
  if (!text) return '';
  return String(text).replace(/([*_`\[\]])/g, '\\$1');
}

// Optimized getBalance using parallel Firestore reads
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
  if (hits.length >= 10) { _scanHits.set(key, hits); return false; }
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
          `• 🌅 *08:00 WIB* — Info sisa saldo & progres semua target tabungan\n` +
          `• 🌙 *20:00 WIB* — Rekap pengeluaran hari ini & ajakan catat\n\n` +
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
    await answerTelegramCallback(botToken, cb.id);
    return;
  }
  const msg = update?.message || update?.edited_message;
  if (!msg) return;

  const chatId = msg.chat.id;
  const userFrom = msg.from || {};

  // Handle photo or document image receipt with Gemini AI
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

    // Rate limit: max 10 scans per hour per chat
    if (!checkScanRateLimit(chatId)) {
      return sendTelegramMessage(botToken, chatId,
        '⏳ *Terlalu banyak scan foto, istirahat dulu ya!*\nMaksimal 10 scan per jam. Coba lagi nanti atau catat manual: `kopi 25k`',
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
      const r = scanRes.data;

      const txType = r.type === 'Income' ? 'Income' : 'Expense';
      const tx = {
        category: r.category || (txType === 'Income' ? 'Salary' : 'Food'),
        type: txType,
        amount: Number(r.total_amount) || 0,
        description: r.merchant_name || (txType === 'Income' ? 'Transfer Masuk' : 'Struk Belanja'),
        date: r.date || new Date().toISOString().slice(0, 10),
        createdAt: new Date().toISOString(),
        paymentMethod: r.payment_method || (r.doc_type?.startsWith('transfer') ? 'TRANSFER' : 'CASH'),
        receiptItems: r.items || [],
        docType: r.doc_type || 'receipt'
      };

      let txId = '';
      if (db) {
        const docRef = await db.collection('users').doc(uid).collection('transactions').add(tx);
        txId = docRef.id;
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
      return sendTelegramMessage(
        botToken,
        chatId,
        `🙈 *Aduh, mata Pocky agak burem baca gambar ini!*\n\n_${escapeMarkdown(err.message || 'Gambarnya kurang terbaca')}_\n\nCoba kirim foto struk atau bukti transfer yang lebih terang, tegak, dan jelas yaa ✨\nAtau kamu bisa minta Pocky catat manual: \`kopi 25k\` atau \`/catat makan 50k\``,
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
      `• 🌅 *08:00 WIB* — Info sisa saldo & progres semua target tabungan\n` +
      `• 🌙 *20:00 WIB* — Rekap pengeluaran hari ini & ajakan catat\n\n` +
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
      '📖 *PANDUAN LENGKAP POCKY* 🪙\n\n*🧾 SCAN STRUK DENGAN AI*\n• Cukup kirim foto struk belanja langsung ke chat ini!\n• AI Gemini otomatis membaca merchant, daftar barang, & total pengeluaran.\n\n*📝 CATAT PENGELUARAN*\n• `kopi susu 25k` — ketik langsung\n• `25k kopi susu` — nominal duluan juga bisa\n• `/catat bensin 50k` — pakai perintah\n• `/keluar makan siang 35k`\n\n*💰 CATAT PEMASUKAN*\n• `/masuk gaji 2jt`\n• `/masuk freelance 500k`\n\n*🎯 TARGET IMPIAN*\n• `/goal Laptop Baru 10jt` — buat target\n• `/goals` — lihat semua target & progres\n• `/beligoal Laptop` — beli target tercapai\n\n*⏰ PENGINGAT HARIAN*\n• `/pengingat` — kelola pengingat pagi & malam\n\n*📊 INFO KEUANGAN*\n• `/saldo` — cek sisa saldo\n• `/riwayat` — 5 transaksi terakhir\n• `/batal` — batalkan transaksi terakhir\n\n*🔗 LAINNYA*\n• `/web` — kode login website\n• `/link KODE` — hubungkan akun website\n• `/menu` — tampilkan keyboard menu\n\n💡 _Nominal bisa ditulis: 50k, 50rb, 50.000, 1.5jt, Rp50000_',
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

export function generateMorningReminder(userName, balance = 0, goals = []) {
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

  return (
    `🌅 *Selamat Pagi, ${name}!* ☀️\n\n` +
    `Pocky siap menemani harimu. Cek kondisi dompet sebelum beraktivitas ya:\n\n` +
    `💳 *Sisa Saldo:* \`${formatRupiah(balance)}\`\n` +
    goalText +
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
        const text = generateMorningReminder(displayName, bal, goals);
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
