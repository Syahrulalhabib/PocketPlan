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
  verifyWebLoginCode,
  linkTelegramAccount,
  findLinkedUid,
  fixStaleTelegramLinks
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

  // ========================================================
  // BAGIAN 4: Telegram /web Login Custom Token uses webUid from telegramUsers
  // ========================================================

  // Test 4A: Firestore mock with telegramUsers collection mapping
  const store = {
    users: {
      'web-user-linked-77': {
        name: 'Linked Alice',
        email: 'alice@example.com',
        isTelegramUser: false
      },
      'tg_7777': {
        name: 'Alice Tg',
        telegramChatId: '7777',
        isTelegramUser: true
      }
    },
    telegramUsers: {
      '7777': {
        uid: 'web-user-linked-77',
        username: 'alice_tg'
      }
    },
    telegram_web_codes: {}
  };

  const mdb = {
    batch: () => ({
      set: () => {},
      delete: () => {},
      commit: async () => {}
    }),
    collection: (colName) => ({
      get: async () => {
        const col = store[colName] || {};
        const docs = Object.entries(col).map(([id, item]) => ({
          id,
          data: () => item
        }));
        return {
          size: docs.length,
          empty: docs.length === 0,
          docs
        };
      },
      doc: (docId) => {
        const docRef = {
          collection: () => ({
            get: async () => ({ empty: true, docs: [] })
          }),
          delete: async () => {
            if (store[colName]) delete store[colName][docId];
          },
          set: async (data, opts) => {
            store[colName] = store[colName] || {};
            store[colName][docId] = opts?.merge
              ? Object.assign(store[colName][docId] || {}, data)
              : { ...data };
          }
        };
        return {
          ...docRef,
          get: async () => ({
            id: docId,
            ref: docRef,
            exists: Boolean(store[colName]?.[docId]),
            data: () => store[colName]?.[docId] || {}
          })
        };
      },
      where: (field, op, val) => ({
        limit: () => ({
          get: async () => {
            const matches = [];
            const col = store[colName] || {};
            for (const [id, item] of Object.entries(col)) {
              if (op === '==' && item?.[field] === val) {
                matches.push({ id, data: () => item });
              }
            }
            return {
              empty: matches.length === 0,
              docs: matches
            };
          }
        })
      })
    })
  };

  const { code: code77 } = await generateWebLoginCode('tg_7777', mdb);
  assert.ok(code77, 'Web login code generated for tg_7777');

  const verified77 = await verifyWebLoginCode(code77, mdb);
  assert.strictEqual(verified77.uid, 'web-user-linked-77', 'UID resolved to linked webUid from telegramUsers');
  assert.strictEqual(verified77.isTelegramUser, false, 'Linked account is recognized as web user');
  assert.strictEqual(verified77.isFullyLinked, true, 'Linked web account is fully linked');
  assert.strictEqual(verified77.email, 'alice@example.com');

  // Verify custom token uses webUid from telegramUsers (same logic as app.post('/api/telegram/web-login'))
  let mintedTokenUid = null;
  const mockAuth = {
    createCustomToken: async (uid) => {
      mintedTokenUid = uid;
      return `custom-jwt-token-for-${uid}`;
    }
  };
  const customToken = await mockAuth.createCustomToken(verified77.uid);
  assert.strictEqual(mintedTokenUid, 'web-user-linked-77', 'Custom token must use webUid from telegramUsers');
  assert.strictEqual(customToken, 'custom-jwt-token-for-web-user-linked-77');

  // Test 4B: Fall back to users/tg_{telegramUserId} only if unlinked Telegram-native account
  store.users['tg_8888'] = {
    name: 'Unlinked Bob',
    telegramChatId: '8888',
    isTelegramUser: true
  };
  const { code: code88 } = await generateWebLoginCode('tg_8888', mdb);
  const verified88 = await verifyWebLoginCode(code88, mdb);
  assert.strictEqual(verified88.uid, 'tg_8888', 'Unlinked account falls back to tg_8888');
  assert.strictEqual(verified88.isTelegramUser, true, 'Unlinked account stays Telegram-native user');

  // Test 4C: linkTelegramAccount helper & demo mode resolution
  await linkTelegramAccount(9999, 'web-user-demo-99', null);
  const { code: code99 } = await generateWebLoginCode('tg_9999', null);
  const verified99 = await verifyWebLoginCode(code99, null);
  assert.strictEqual(verified99.uid, 'web-user-demo-99', 'Demo mode resolves webUid from telegramUsers mapping');
  assert.strictEqual(verified99.isTelegramUser, false);
  const customTokenDemo = await mockAuth.createCustomToken(verified99.uid);
  assert.strictEqual(customTokenDemo, 'custom-jwt-token-for-web-user-demo-99');

  // Test 4D: Legacy linked account (only telegramChatId in users doc, no telegramUsers doc)
  store.users['web-user-legacy-66'] = {
    name: 'Legacy Charlie',
    email: 'charlie@example.com',
    telegramChatId: '6666',
    isTelegramUser: false
  };
  // findLinkedUid resolves to web-user-legacy-66
  const legacyResolvedUid = await findLinkedUid('6666', mdb);
  assert.strictEqual(legacyResolvedUid, 'web-user-legacy-66', 'findLinkedUid resolves webUid from users.telegramChatId query');

  // Even if web code was minted for tg_6666, verifyWebLoginCode resolves to web-user-legacy-66
  const { code: code66 } = await generateWebLoginCode('tg_6666', mdb);
  const verified66 = await verifyWebLoginCode(code66, mdb);
  assert.strictEqual(verified66.uid, 'web-user-legacy-66', 'verifyWebLoginCode resolves webUid for legacy linked account');
  assert.strictEqual(verified66.isTelegramUser, false);
  assert.strictEqual(verified66.email, 'charlie@example.com');
  // Verify self-healing updated telegramUsers and telegram_links
  assert.strictEqual(store.telegramUsers['6666']?.uid, 'web-user-legacy-66', 'Self-healing populated telegramUsers');
  assert.strictEqual(store.telegram_links['6666']?.uid, 'web-user-legacy-66', 'Self-healing populated telegram_links');

  // ========================================================
  // BAGIAN 5: Fix Telegram /web Login Minting New Account
  // ========================================================

  // Test 5A (Kriteria 1): migrateTelegramDataToUser updates telegram_links to targetUid
  store.users['web-user-batre'] = {
    name: 'Batre Web',
    email: 'batreboros12@gmail.com',
    isTelegramUser: false
  };
  store.users['tg_12345'] = {
    name: 'Batre Telegram',
    telegramChatId: '12345',
    isTelegramUser: true
  };
  store.telegram_links['12345'] = {
    uid: 'tg_12345',
    linkedAt: new Date().toISOString()
  };

  await migrateTelegramDataToUser(12345, 'web-user-batre', mdb);

  assert.strictEqual(
    store.telegram_links['12345']?.uid,
    'web-user-batre',
    'Kriteria 1: migrateTelegramDataToUser must update telegram_links doc to targetUid'
  );
  assert.strictEqual(
    store.telegram_links['12345']?.previousUid,
    'tg_12345',
    'Kriteria 1: migrateTelegramDataToUser sets previousUid on telegram_links'
  );
  assert.ok(
    store.telegram_links['12345']?.migratedAt,
    'Kriteria 1: migrateTelegramDataToUser sets migratedAt on telegram_links'
  );
  console.log('  ✔ Kriteria 1: migrateTelegramDataToUser updates telegram_links to web UID');

  // Test 5B (Kriteria 2): fixStaleTelegramLinks fixes existing stale records in telegram_links
  store.telegram_links['stale_chat_1'] = { uid: 'tg_stale_1' };
  store.users['tg_stale_1'] = { migratedTo: 'web-user-stale-1' };

  store.telegram_links['stale_chat_2'] = { uid: 'tg_stale_2' };
  store.users['tg_stale_2'] = { linkedWebUid: 'web-user-stale-2' };

  store.telegram_links['fresh_chat_3'] = { uid: 'tg_fresh_3' };
  store.users['tg_fresh_3'] = { isTelegramUser: true };

  const fixReport = await fixStaleTelegramLinks(mdb);
  assert.strictEqual(fixReport.fixedCount, 2, 'Kriteria 2: fixStaleTelegramLinks must fix exactly 2 stale links');
  assert.strictEqual(store.telegram_links['stale_chat_1']?.uid, 'web-user-stale-1');
  assert.strictEqual(store.telegram_links['stale_chat_2']?.uid, 'web-user-stale-2');
  assert.strictEqual(store.telegram_links['fresh_chat_3']?.uid, 'tg_fresh_3', 'Kriteria 2: unmigrated links remain untouched');
  console.log(`  ✔ Kriteria 2: fixStaleTelegramLinks scanned & repaired stale links (fixed: ${fixReport.fixedCount})`);

  // Test 5C (Kriteria 3): verifyWebLoginCode uses effectiveUid when data is stale
  store.users['tg_stale_code_user'] = {
    name: 'Stale Bot User',
    migratedTo: 'web-user-actual-target',
    telegramChatId: '554433'
  };
  store.users['web-user-actual-target'] = {
    name: 'Target Web User',
    email: 'target@example.com',
    telegramChatId: '554433',
    isTelegramUser: false
  };

  const { code: staleWebCode } = await generateWebLoginCode('tg_stale_code_user', mdb);
  const verifiedStale = await verifyWebLoginCode(staleWebCode, mdb);
  assert.strictEqual(
    verifiedStale.uid,
    'web-user-actual-target',
    'Kriteria 3: verifyWebLoginCode must resolve effectiveUid from migratedTo'
  );
  assert.strictEqual(verifiedStale.email, 'target@example.com');
  assert.strictEqual(verifiedStale.isTelegramUser, false);
  console.log('  ✔ Kriteria 3: verifyWebLoginCode uses effectiveUid even with stale code data');

  // Test 5D (Kriteria 4): Simulation: connected user -> /web -> code -> web login -> logs into web user, NOT new tg_ account
  const connectedChatId = '12345';
  const botResolvedUid = await ensureTelegramUser(connectedChatId, { first_name: 'Batre' }, mdb);
  assert.strictEqual(
    botResolvedUid,
    'web-user-batre',
    'findLinkedUid/ensureTelegramUser on linked user resolves to web account'
  );

  const { code: botLoginPasscode } = await generateWebLoginCode(botResolvedUid, mdb);
  const verifiedBotLogin = await verifyWebLoginCode(botLoginPasscode, mdb);
  assert.strictEqual(
    verifiedBotLogin.uid,
    'web-user-batre',
    'Kriteria 4: Web login verifies web user UID'
  );
  assert.strictEqual(verifiedBotLogin.isTelegramUser, false);
  assert.strictEqual(verifiedBotLogin.email, 'batreboros12@gmail.com');

  const customTokenForWeb = await mockAuth.createCustomToken(verifiedBotLogin.uid);
  assert.strictEqual(
    customTokenForWeb,
    'custom-jwt-token-for-web-user-batre',
    'Kriteria 4: Token minted for web user, NOT new tg_12345 account'
  );
  console.log('  ✔ Kriteria 4: Simulation connected user -> /web -> logs into existing web user, NO new account minted');

  // Test 5E (Kriteria 5): User belum terhubung -> /web -> tetap berfungsi normal
  const unlinkedChatId = '98765';
  store.users['tg_98765'] = {
    name: 'Native Unlinked Guy',
    telegramChatId: '98765',
    isTelegramUser: true
  };
  const unlinkedBotUid = await ensureTelegramUser(unlinkedChatId, { first_name: 'Native Guy' }, mdb);
  assert.strictEqual(unlinkedBotUid, 'tg_98765', 'Kriteria 5: Unlinked user resolves to tg_98765');

  const { code: unlinkedCode } = await generateWebLoginCode(unlinkedBotUid, mdb);
  const verifiedUnlinked = await verifyWebLoginCode(unlinkedCode, mdb);
  assert.strictEqual(verifiedUnlinked.uid, 'tg_98765', 'Kriteria 5: Unlinked login code verifies to tg_98765');
  assert.strictEqual(verifiedUnlinked.isTelegramUser, true, 'Kriteria 5: Unlinked account is marked as Telegram user');

  const unlinkedToken = await mockAuth.createCustomToken(verifiedUnlinked.uid);
  assert.strictEqual(unlinkedToken, 'custom-jwt-token-for-tg_98765');
  console.log('  ✔ Kriteria 5: Unlinked user /web flow remains fully functional');

  console.log('  ✔ Telegram /web login resolves webUid from telegramUsers for custom token passed');
  console.log('  ✔ Legacy web user telegramChatId query resolution and self-healing passed');
  console.log('  ✔ Fallback to tg_{telegramUserId} for unlinked Telegram-native account passed');
  console.log('  ✔ Bot-to-web linking lifecycle & delayed notification passed');
  console.log('  ✔ Passwordless SSO re-login retains verified status passed');
  console.log('All Account Linking unit tests passed! ✅');
}

runAccountLinkingTests().catch((err) => {
  console.error('Account Linking test failed:', err);
  process.exit(1);
});

