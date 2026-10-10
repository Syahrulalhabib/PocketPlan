import assert from 'assert';
import {
  generateLinkCode, getLinkStatus, unlinkAccount,
  findLinkedUid, linkChatWithCode, ensureTelegramUser,
  generateWebLoginCode, verifyWebLoginCode
} from './telegramBotCore.js';

console.log('Running user isolation tests...');

async function testIsolation() {
  // Stub fetch (sendTelegramMessage calls it)
  global.fetch = async () => ({ json: async () => ({ ok: true }) });

  // Two independent users, different chatIds
  const uidA = await ensureTelegramUser(100, { first_name: 'Alice', username: 'alice' }, null);
  const uidB = await ensureTelegramUser(200, { first_name: 'Bob', username: 'bob' }, null);

  assert.strictEqual(uidA, 'tg_100');
  assert.strictEqual(uidB, 'tg_200');
  assert.notStrictEqual(uidA, uidB, 'UIDs must be different');

  // Each chatId resolves to its own uid
  assert.strictEqual(await findLinkedUid(100, null), uidA);
  assert.strictEqual(await findLinkedUid(200, null), uidB);
  assert.strictEqual(await findLinkedUid(999, null), null, 'Unknown chatId returns null');

  // Link code belongs to one user, cannot be claimed by other
  const { code } = await generateLinkCode('web-user-1', null, 'TestBot');
  const claimResult = await linkChatWithCode(300, code, { first_name: 'Carol' }, null);
  assert.strictEqual(claimResult, 'web-user-1', 'Code links to original web user');
  assert.strictEqual(await findLinkedUid(300, null), 'web-user-1');
  // Same code cannot be reused
  const reuse = await linkChatWithCode(400, code, { first_name: 'Dave' }, null);
  assert.strictEqual(reuse, null, 'Used code returns null');

  // Web login code isolation
  const { code: codeA } = await generateWebLoginCode(uidA, null);
  const { code: codeB } = await generateWebLoginCode(uidB, null);
  const verA = await verifyWebLoginCode(codeA, null);
  assert.strictEqual(verA.uid, uidA, 'Web code A resolves to user A');
  const verB = await verifyWebLoginCode(codeB, null);
  assert.strictEqual(verB.uid, uidB, 'Web code B resolves to user B');

  // Unlinking one user doesn't affect another
  await unlinkAccount(uidA, null);
  assert.strictEqual((await getLinkStatus(uidA, null)).linked, false);
  assert.strictEqual((await getLinkStatus(uidB, null)).linked, true, 'User B still linked after A unlinks');

  console.log('All user isolation tests passed!');
}

testIsolation();
