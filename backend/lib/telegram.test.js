import assert from 'assert';
import { parseAmount, parseTransactionCommand, formatRupiah } from './telegramParser.js';
import { generateLinkCode, getLinkStatus, unlinkAccount, linkChatWithCode } from './telegramBotCore.js';
import { handleTelegramUpdate } from './telegramBot.js';

console.log('Running Telegram integration tests...');

// 1. Amount parser
assert.strictEqual(parseAmount('50000'), 50000);
assert.strictEqual(parseAmount('50.000'), 50000);
assert.strictEqual(parseAmount('50k'), 50000);
assert.strictEqual(parseAmount('50rb'), 50000);
assert.strictEqual(parseAmount('1.5jt'), 1500000);
assert.strictEqual(parseAmount('Rp 75.000'), 75000);

// 2. Command parser
const tx1 = parseTransactionCommand('/catat 50000 makan nasi padang');
assert.strictEqual(tx1.type, 'Expense');
assert.strictEqual(tx1.amount, 50000);
assert.strictEqual(tx1.category, 'Food');

const tx2 = parseTransactionCommand('/masuk 2.5jt gaji bulanan');
assert.strictEqual(tx2.type, 'Income');
assert.strictEqual(tx2.amount, 2500000);
assert.strictEqual(tx2.category, 'Salary');

const tx3 = parseTransactionCommand('/catat makan nasi padang 50000');
assert.strictEqual(tx3.type, 'Expense');
assert.strictEqual(tx3.amount, 50000);
assert.strictEqual(tx3.category, 'Food');

const tx4 = parseTransactionCommand('/masuk gaji bulanan 2.5jt');
assert.strictEqual(tx4.type, 'Income');
assert.strictEqual(tx4.amount, 2500000);

const tx5 = parseTransactionCommand('kopi kenangan 50k');
assert.strictEqual(tx5.type, 'Expense');
assert.strictEqual(tx5.amount, 50000);
assert.strictEqual(tx5.category, 'Food');
assert.strictEqual(tx2.category, 'Salary');

// 3. Bot commands flow
async function testBot() {
  const uid = 'test-uid';
  const { code, deepLink } = await generateLinkCode(uid, null, 'PocketPlanBot');
  assert.strictEqual(code.length, 6);
  assert(deepLink.includes(code));

  let replies = [];
  global.fetch = async (url, opts) => {
    if (opts?.body) {
      try { replies.push(JSON.parse(opts.body)); } catch {}
    }
    if (typeof url === 'string' && url.includes('/getFile')) {
      return { ok: true, json: async () => ({ ok: true, result: { file_path: 'photo.jpg' } }) };
    }
    if (typeof url === 'string' && url.includes('/file/')) {
      return { ok: true, arrayBuffer: async () => Buffer.from('fake-image-bytes') };
    }
    if (typeof url === 'string' && url.includes('models/')) {
      return {
        ok: true,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  merchant_name: 'Warung Nasi',
                  date: '2026-10-15',
                  items: [{ item_name: 'Nasi Rendang', quantity: 1, unit_price: 25000, total_price: 25000 }],
                  total_amount: 25000,
                  category: 'Food',
                  payment_method: 'CASH'
                })
              }]
            }
          }]
        })
      };
    }
    return { ok: true, json: async () => ({ ok: true }) };
  };

  // Link
  await handleTelegramUpdate({
    message: { chat: { id: 777 }, text: `/start ${code}`, from: { first_name: 'Dewi', username: 'dewi' } }
  }, null, 'token');
  assert(replies[0].text.includes('terhubung') || replies[0].text.includes('Tersambung') || replies[0].text.includes('Berhasil'));

  const status = await getLinkStatus(uid, null);
  assert.strictEqual(status.linked, true);

  // Catat
  replies = [];
  await handleTelegramUpdate({
    message: { chat: { id: 777 }, text: '/catat 25k makan bakso', from: { first_name: 'Dewi' } }
  }, null, 'token');
  assert(replies[0].text.includes('Pengeluaran Dicatat') || replies[0].text.includes('Tercatat'));

  // Catat format baru: /catat [keterangan] [nominal]
  replies = [];
  await handleTelegramUpdate({
    message: { chat: { id: 777 }, text: '/catat nasi goreng 30k', from: { first_name: 'Dewi' } }
  }, null, 'token');
  assert(replies[0].text.includes('Pengeluaran Dicatat') || replies[0].text.includes('Tercatat'));
  assert(replies[0].text.includes('Nasi Goreng'));

  // Masuk format baru: /masuk [keterangan] [nominal]
  replies = [];
  await handleTelegramUpdate({
    message: { chat: { id: 777 }, text: '/masuk honor project 500k', from: { first_name: 'Dewi' } }
  }, null, 'token');
  assert(replies[0].text.includes('Pemasukan Dicatat'));

  // Shorthand direct amount catat: [keterangan] [nominal]
  replies = [];
  await handleTelegramUpdate({
    message: { chat: { id: 777 }, text: 'es kopi susu 18k', from: { first_name: 'Dewi' } }
  }, null, 'token');
  assert(replies[0].text.includes('Pengeluaran Dicatat') || replies[0].text.includes('Tercatat'));

  // Goal format baru: /goal [nama] [nominal]
  replies = [];
  await handleTelegramUpdate({
    message: { chat: { id: 777 }, text: '/goal Motor Baru 20jt', from: { first_name: 'Dewi' } }
  }, null, 'token');
  assert(replies[0].text.includes('Target Baru Dibuat'));
  assert(replies[0].text.includes('Motor Baru'));

  // Saldo
  replies = [];
  await handleTelegramUpdate({
    message: { chat: { id: 777 }, text: '/saldo', from: { first_name: 'Dewi' } }
  }, null, 'token');
  assert(replies[0].text.includes('Saldo'));

  // Unlink
  await unlinkAccount(uid, null);
  assert.strictEqual((await getLinkStatus(uid, null)).linked, false);

  // Photo receipt scan check (must be linked first)
  process.env.GEMINI_API_KEYS = 'test_key';
  const { code: code888 } = await generateLinkCode('user-888', null, 'TestBot');
  await linkChatWithCode(888, code888, { first_name: 'User' }, null);

  replies = [];
  await handleTelegramUpdate({
    message: { chat: { id: 888 }, photo: [{ file_id: 'abc' }], from: { first_name: 'User' } }
  }, null, 'token');
  assert(replies.some(r => (r.text || '').includes('membaca struk') || (r.text || '').includes('Struk Berhasil Dicatat') || (r.text || '').includes('Warung Nasi')));

  // Test receipt action callbacks
  await handleTelegramUpdate({
    callback_query: { id: 'cb1', data: 'ok:dummy-tx', message: { chat: { id: 888 }, message_id: 1, text: 'Struk Berhasil Dicatat' } }
  }, null, 'token');

  await handleTelegramUpdate({
    callback_query: { id: 'cb2', data: 'edit:dummy-tx', message: { chat: { id: 888 }, message_id: 1 } }
  }, null, 'token');

  // Test /koreksi command
  replies = [];
  await handleTelegramUpdate({
    message: { chat: { id: 888 }, text: '/koreksi 150k', from: { first_name: 'User' } }
  }, null, 'token');
  assert(replies[0].text.includes('150.000'));


  // Auto-provision & Web Login Code test
  const {
    ensureTelegramUser,
    generateWebLoginCode,
    verifyWebLoginCode,
    attachMessageToWebCode,
    cancelWebLoginCode,
    cancelLinkCode,
    findLinkedUid
  } = await import('./telegramBotCore.js');
  const { generateMorningReminder, generateEveningReminder } = await import('./telegramBot.js');

  const newUid = await ensureTelegramUser(999, { first_name: 'Budi' }, null);
  assert.strictEqual(newUid, 'tg_999');

  const { code: webCode } = await generateWebLoginCode(newUid, null);
  assert.strictEqual(webCode.length, 6);
  await attachMessageToWebCode(webCode, 12345, 999, null);

  const verified = await verifyWebLoginCode(webCode, null);
  assert.strictEqual(verified.uid, 'tg_999');
  assert.strictEqual(verified.messageId, 12345);

  // Test cancelWebLoginCode
  const { code: webCode2 } = await generateWebLoginCode(newUid, null);
  const cancelRes = await cancelWebLoginCode(webCode2, null);
  assert.strictEqual(cancelRes.success, true);
  const verifyAfterCancel = await verifyWebLoginCode(webCode2, null);
  assert.strictEqual(verifyAfterCancel, null);

  // Test cancelLinkCode
  const { code: linkCodeToCancel } = await generateLinkCode('user-cancel', null, 'TestBot');
  const cancelLinkRes = await cancelLinkCode('user-cancel', null);
  assert.strictEqual(cancelLinkRes.success, true);
  const linkAttempt = await linkChatWithCode(9999, linkCodeToCancel, { first_name: 'Test' }, null);
  assert.strictEqual(linkAttempt, null);

  // Test /pengingat command
  replies = [];
  await handleTelegramUpdate({
    message: { chat: { id: 999 }, text: '/pengingat', from: { first_name: 'Budi' } }
  }, null, 'token');
  assert(replies[0].text.includes('Pengaturan Pengingat Harian'));
  assert(replies[0].text.includes('08:00 WIB'));
  assert(replies[0].text.includes('20:00 WIB'));

  // Test reminder generators
  const morningMsg = generateMorningReminder('Budi', 500000, { name: 'Liburan', amount: 100000, target: 1000000 });
  assert(morningMsg.includes('Selamat Pagi, Budi!'));
  assert(morningMsg.includes('500.000'));
  assert(morningMsg.includes('Liburan'));

  const eveningMsg = generateEveningReminder('Budi', { totalExpense: 75000, currentBalance: 425000, expenseCount: 2 });
  assert(eveningMsg.includes('Rekap Malam'));
  assert(eveningMsg.includes('75.000'));
  assert(eveningMsg.includes('425.000'));

  // Test findLinkedUid caching
  const cachedUid = await findLinkedUid(888, null);
  assert.strictEqual(cachedUid, 'user-888');

  console.log('All Telegram integration tests passed!');
}

testBot();
