import assert from 'assert';
import {
  generateLinkCode,
  linkChatWithCode,
  unlinkAccount,
  getLinkStatus,
  migrateTelegramDataToUser,
  completeTelegramLink,
  ensureTelegramUser,
  generateWebLoginCode,
  verifyWebLoginCode
} from './telegramBotCore.js';
import { handleTelegramUpdate } from './telegramBot.js';

async function runAccountLinkingTests() {
  console.log('Running Account Linking & Notification unit tests...');

  const sentMessages = [];
  global.fetch = async (url, options) => {
    if (url.includes('sendMessage')) {
      const body = JSON.parse(options.body);
      sentMessages.push(body);
      return { json: async () => ({ ok: true, result: { message_id: 111 } }) };
    }
    if (url.includes('deleteMessage')) {
      return { json: async () => ({ ok: true }) };
    }
    return { json: async () => ({ ok: true }) };
  };

  // 1: Link Telegram A (chatId 1001) to Web X ('web-user-x')
  const { code: codeX } = await generateLinkCode('web-user-x', null, 'TestBot');
  assert.ok(codeX, 'Code X generated');

  const linkRes1 = await linkChatWithCode(1001, codeX, { first_name: 'Alice', username: 'alice' }, null);
  assert.strictEqual(linkRes1, 'web-user-x');

  const statusX = await getLinkStatus('web-user-x', null);
  assert.strictEqual(statusX.linked, true, 'Web X is linked');
  assert.strictEqual(statusX.fullyLinked, true, 'Web user is fully linked');
  assert.strictEqual(statusX.dataLinked, true);
  assert.strictEqual(statusX.chatId, '1001');

  // KRITERIA 1: Telegram A (1001) coba hubungkan ke Web Y -> DITOLAK
  const { code: codeY } = await generateLinkCode('web-user-y', null, 'TestBot');
  const linkResAtoY = await linkChatWithCode(1001, codeY, { first_name: 'Alice' }, null);
  assert.strictEqual(linkResAtoY, 'ALREADY_LINKED_TG', 'Telegram A cannot link to Web Y');

  sentMessages.length = 0;
  await handleTelegramUpdate({
    update_id: 991,
    message: { chat: { id: 1001 }, text: `/start ${codeY}`, from: { first_name: 'Alice' } }
  }, null, 'token');
  assert.ok(sentMessages.some(m => m.text.includes('sudah terhubung ke akun web')), 'Bot warns Telegram A already linked');

  // KRITERIA 2: Web X coba hubungkan ke Telegram B -> DITOLAK
  await assert.rejects(
    async () => await generateLinkCode('web-user-x', null, 'TestBot'),
    (err) => err.message.includes('sudah terhubung'),
    'Web X cannot generate link code when already linked'
  );

  await assert.rejects(
    async () => await generateLinkCode('tg_1001', null, 'TestBot'),
    (err) => err.message.includes('sudah terhubung'),
    'Telegram A cannot generate link code when already linked'
  );

  // MIGRATION CHECKS
  await assert.rejects(
    async () => await migrateTelegramDataToUser(9999, 'web-user-x', null),
    (err) => err.message.includes('sudah terhubung ke akun Telegram lain'),
    'Cannot migrate to Web X from another telegram account'
  );

  await migrateTelegramDataToUser(1001, 'web-user-x', null);
  await assert.rejects(
    async () => await migrateTelegramDataToUser(1001, 'web-user-other', null),
    (err) => err.message.includes('sudah pernah di-migrate'),
    'Source telegram cannot be migrated to a different web account'
  );
  // KRITERIA 3: Setelah /unlink, masing-masing bisa dihubungkan lagi ke akun lain
  await unlinkAccount('web-user-x', null);

  const statusXAfter = await getLinkStatus('web-user-x', null);
  assert.strictEqual(statusXAfter.linked, false, 'Web X unlinked');
  const statusAAfter = await getLinkStatus('tg_1001', null);
  assert.strictEqual(statusAAfter.linked, false, 'Telegram A unlinked');

  // Telegram A (1001) CAN connect to Web Y
  const { code: codeY2 } = await generateLinkCode('web-user-y', null, 'TestBot');
  const linkResAtoY2 = await linkChatWithCode(1001, codeY2, { first_name: 'Alice' }, null);
  assert.strictEqual(linkResAtoY2, 'web-user-y', 'Telegram A linked to Web Y after unlink');

  // Web X CAN connect to Telegram B (1002)
  const { code: codeX2 } = await generateLinkCode('web-user-x', null, 'TestBot');
  const linkResBtoX2 = await linkChatWithCode(1002, codeX2, { first_name: 'Bob' }, null);
  assert.strictEqual(linkResBtoX2, 'web-user-x', 'Web X linked to Telegram B after unlink');

  console.log('  ✔ Strict 1:1 linking & unlink scenarios passed');

  // ========================================================
  // BAGIAN 3: Alur Bot -> Web & Pencegahan Notif Prematur
  // ========================================================

  await ensureTelegramUser(5001, { first_name: 'Charlie', username: 'charlie' }, null);
  const { code: webCode } = await generateWebLoginCode('tg_5001', null);

  sentMessages.length = 0;
  const verifiedWeb = await verifyWebLoginCode(webCode, null);
  assert.strictEqual(verifiedWeb.uid, 'tg_5001');

  // Kriteria 1 & 2: User isi email di web, verifikasi email -> TIDAK ada notif
  const statusPre = await getLinkStatus('tg_5001', null);
  assert.strictEqual(statusPre.fullyLinked, false, 'Not fully linked yet');
  assert.strictEqual(statusPre.linked, false, 'linked is false for uncompleted tg user');
  assert.strictEqual(sentMessages.length, 0, 'No premature notification sent to Telegram');

  // Kriteria 3: User selesai buat password web -> BARU ada notif "🎉 Akun berhasil terhubung!"
  const completeRes = await completeTelegramLink('tg_5001', null, 'fake-token');
  assert.strictEqual(completeRes.success, true);
  assert.ok(completeRes.linkCompletedAt);

  const statusPost = await getLinkStatus('tg_5001', null);
  assert.strictEqual(statusPost.fullyLinked, true, 'Fully linked after setup');
  assert.strictEqual(statusPost.linked, true);
  assert.ok(statusPost.linkCompletedAt);

  assert.strictEqual(sentMessages.length, 1, 'Exactly one notification sent on completion');
  assert.ok(sentMessages[0].text.includes('Akun berhasil terhubung'), 'Notification text matches');
  assert.strictEqual(sentMessages[0].chat_id, '5001');

  // Kriteria 4: Re-login via /web tidak meminta verifikasi ulang
  const { code: reloginCode } = await generateWebLoginCode('tg_5001', null);
  const verifiedRelogin = await verifyWebLoginCode(reloginCode, null);
  assert.strictEqual(verifiedRelogin.isTelegramUser, true);
  assert.strictEqual(verifiedRelogin.isFullyLinked, true, 'Charlie should be isFullyLinked on relogin');
  assert.strictEqual(verifiedRelogin.emailVerified, true, 'Charlie emailVerified should be true on relogin');
  assert.strictEqual(verifiedRelogin.webPasswordSet, true, 'Charlie webPasswordSet should be true on relogin');

  // Kriteria 5: Web user yang ditautkan Telegram login via /web tidak dianggap unverified Telegram user
  const { code: webCodeAlice } = await generateWebLoginCode('web-user-x', null);
  const verifiedAlice = await verifyWebLoginCode(webCodeAlice, null);
  assert.strictEqual(verifiedAlice.isTelegramUser, false, 'Alice is a web user');
  assert.strictEqual(verifiedAlice.isFullyLinked, true, 'Alice is already fully linked');
  assert.strictEqual(verifiedAlice.emailVerified, true, 'Alice email is verified');
  assert.strictEqual(verifiedAlice.webPasswordSet, true, 'Alice web password is set');

  console.log('  ✔ Bot-to-web linking lifecycle & delayed notification passed');
  console.log('  ✔ Passwordless SSO re-login retains verified status passed');
  console.log('All Account Linking unit tests passed! ✅');
}

runAccountLinkingTests().catch((err) => {
  console.error('Account Linking test failed:', err);
  process.exit(1);
});

