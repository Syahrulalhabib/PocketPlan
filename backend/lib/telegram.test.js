import assert from 'assert';
import { parseAmount, parseTransactionCommand, formatRupiah } from './telegramParser.js';
import { generateLinkCode, getLinkStatus, unlinkAccount } from './telegramBotCore.js';
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
    replies.push(JSON.parse(opts.body));
    return { json: async () => ({ ok: true }) };
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

  // Photo receipt unlinked check
  replies = [];
  await handleTelegramUpdate({
    message: { chat: { id: 888 }, photo: [{ file_id: 'abc' }], from: { first_name: 'Unlinked' } }
  }, null, 'token');
  assert(replies[0].text.includes('belum terhubung'));


  // Auto-provision & Web Login Code test
  const { ensureTelegramUser, generateWebLoginCode, verifyWebLoginCode } = await import('./telegramBotCore.js');
  const newUid = await ensureTelegramUser(999, { first_name: 'Budi' }, null);
  assert.strictEqual(newUid, 'tg_999');

  const { code: webCode } = await generateWebLoginCode(newUid, null);
  assert.strictEqual(webCode.length, 6);

  const verified = await verifyWebLoginCode(webCode, null);
  assert.strictEqual(verified.uid, 'tg_999');

  console.log('All Telegram integration tests passed!');
}

testBot();
