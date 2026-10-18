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
  fixStaleTelegramLinks,
  sendTelegramMessage
} from './telegramBotCore.js';
import { handleTelegramUpdate, sendWebAccess } from './telegramBot.js';

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
      add: async (data) => {
        const id = 'tmp-' + Math.random().toString(36).slice(2);
        store[colName] = store[colName] || {};
        store[colName][id] = data;
        return { id };
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

  // ========================================================
  // BAGIAN 4: Fix Unlink - Bot Masih Bisa Login Pakai Kode
  // ========================================================
  console.log('\n  [BAGIAN 4] Testing Fix Unlink & Web Login Protection...');

  store.telegram_codes = store.telegram_codes || {};
  store.telegram_web_codes = store.telegram_web_codes || {};

  // Setup user tg_7001 linked to web-user-7001
  store.users['tg_7001'] = {
    name: 'Linked Guy',
    telegramChatId: '7001',
    linkedWebUid: 'web-user-7001'
  };
  store.telegram_links['7001'] = { uid: 'web-user-7001' };

  // KRITERIA 1: Unlink -> doc tg_7001 memiliki unlinkedAt + needsEmailVerification
  await unlinkAccount('tg_7001', mdb);
  const unlinkedDoc = store.users['tg_7001'];
  assert.ok(unlinkedDoc.unlinkedAt, 'Kriteria 1: doc tg_7001 has unlinkedAt timestamp');
  assert.strictEqual(unlinkedDoc.needsEmailVerification, true, 'Kriteria 1: needsEmailVerification is true');
  assert.strictEqual(unlinkedDoc.linkedWebUid, null, 'Kriteria 1: linkedWebUid is reset to null');
  assert.strictEqual(store.telegram_links['7001'], undefined, 'Kriteria 1: telegram_links doc is deleted');
  console.log('  ✔ Kriteria 1: Unlink marks tg_7001 with unlinkedAt and needsEmailVerification');

  // KRITERIA 2 & 3: Setelah unlink, ensureTelegramUser TIDAK auto-recreate link
  // dan /web mengarahkan ke verifikasi email, TIDAK memberikan kode login langsung
  const resolvedUnlinkedUid = await ensureTelegramUser('7001', { first_name: 'Linked Guy' }, mdb);
  assert.strictEqual(resolvedUnlinkedUid, 'tg_7001', 'ensureTelegramUser returns tg_7001 without link');
  assert.strictEqual(store.telegram_links['7001'], undefined, 'ensureTelegramUser did NOT recreate telegram_links entry');

  sentMessages.length = 0;
  await sendWebAccess('7001', resolvedUnlinkedUid, mdb, 'fake-bot-token');
  assert.ok(sentMessages.length > 0, 'Kriteria 2 & 3: message sent to user');
  assert.ok(sentMessages[0].text.includes('Verifikasi Email Diperlukan'), 'Kriteria 3: redirects to email verification');
  assert.strictEqual(sentMessages[0].text.includes('🔑 *KODE:*'), false, 'Kriteria 2: NO web login code provided');
  console.log('  ✔ Kriteria 2 & 3: /web after unlink directs to email verification without login code');

  // KRITERIA 4: Selesai verifikasi + linking -> flag dibersihkan dan linking berfungsi normal
  store.telegram_codes['CODE7001'] = { uid: 'web-user-new7', expiresAt: new Date(Date.now() + 600000).toISOString() };
  const linkedUid = await linkChatWithCode('7001', 'CODE7001', { first_name: 'Linked Guy' }, mdb);
  assert.strictEqual(linkedUid, 'web-user-new7');

  const reconnectedDoc = store.users['tg_7001'];
  assert.strictEqual(reconnectedDoc.unlinkedAt, null, 'Kriteria 4: unlinkedAt cleaned');
  assert.strictEqual(reconnectedDoc.needsEmailVerification, null, 'Kriteria 4: needsEmailVerification cleaned');
  assert.strictEqual(reconnectedDoc.emailVerified, true, 'Kriteria 4: emailVerified set to true');

  sentMessages.length = 0;
  await sendWebAccess('7001', linkedUid, mdb, 'fake-bot-token');
  assert.ok(sentMessages[0].text.includes('🔑 *KODE:*'), 'Kriteria 4: /web produces login code normally after linking');
  console.log('  ✔ Kriteria 4: Flags cleared after verification & linking complete');

  // KRITERIA 5: User fresh (tidak pernah di-unlink) alur normal tetap jalan
  const freshUid = await ensureTelegramUser('88889', { first_name: 'FreshGuy' }, mdb);
  assert.strictEqual(freshUid, 'tg_88889');
  assert.ok(store.telegram_links['88889'], 'Kriteria 5: telegram_links created for fresh user');
  sentMessages.length = 0;
  await sendWebAccess('88889', freshUid, mdb, 'fake-bot-token');
  assert.ok(sentMessages[0].text.includes('🔑 *KODE:*'), 'Kriteria 5: Fresh user receives web login code normally');
  console.log('  ✔ Kriteria 5: Fresh user flow unaffected');

  // TAMBAHAN 2: Kode kadaluarsa -> verifyWebLoginCode returns status EXPIRED with chatId
  store.telegram_web_codes['EXPCODE'] = {
    uid: 'tg_88889',
    chatId: '88889',
    expiresAt: new Date(Date.now() - 5000).toISOString()
  };
  const expRes = await verifyWebLoginCode('EXPCODE', mdb);
  assert.strictEqual(expRes.status, 'EXPIRED', 'Tambahan 2: verifyWebLoginCode returns EXPIRED status');
  assert.strictEqual(expRes.chatId, '88889', 'Tambahan 2: verifyWebLoginCode returns chatId');
  assert.strictEqual(store.telegram_web_codes['EXPCODE'], undefined, 'Tambahan 2: expired code deleted from store');

  // Simulation of /api/telegram/web-login notification sending on EXPIRED
  sentMessages.length = 0;
  if ((expRes === 'EXPIRED' || expRes?.status === 'EXPIRED') && expRes?.chatId) {
    await sendTelegramMessage(
      'fake-bot-token',
      expRes.chatId,
      '⏳ *Kode login kadaluarsa*\n\nKode kamu sudah tidak berlaku. Ketik /web untuk buat kode baru.'
    );
  }
  assert.strictEqual(sentMessages.length, 1);
  assert.ok(sentMessages[0].text.includes('Kode login kadaluarsa'));
  assert.strictEqual(sentMessages[0].chat_id, '88889');
  console.log('  ✔ Tambahan 2: verifyWebLoginCode returns EXPIRED and chatId with notification delivered');

  // BAGIAN 5: verifyWebLoginCode blocks unlinked user from resolving to old web UID
  console.log('\n  [BAGIAN 5] Testing verifyWebLoginCode unlinkedAt guard...');

  // Setup: link chatId 9001 to web-old-acct, then unlink
  store.telegram_codes['LINK9001'] = { uid: 'web-old-acct', expiresAt: new Date(Date.now() + 600000).toISOString() };
  const linked9001 = await linkChatWithCode('9001', 'LINK9001', { first_name: 'OldUser' }, mdb);
  assert.strictEqual(linked9001, 'web-old-acct');

  await unlinkAccount('web-old-acct', mdb);

  // Simulate stale telegramUsers entry that persists after unlink (old bug — pre-fix data)
  store.telegramUsers = store.telegramUsers || {};
  store.telegramUsers['9001'] = { uid: 'web-old-acct', webUid: 'web-old-acct' };

  // Generate web code for tg_9001 (unlinked user)
  const { code: code9001 } = await generateWebLoginCode('tg_9001', mdb);

  // Kriteria 1: verifyWebLoginCode must return needsVerification, NOT resolve to web-old-acct
  const verifyRes = await verifyWebLoginCode(code9001, mdb);
  assert.strictEqual(verifyRes.needsVerification, true, 'Bagian 5 K1: needsVerification is true');
  assert.strictEqual(verifyRes.unlinked, true, 'Bagian 5 K1: unlinked is true');
  assert.strictEqual(verifyRes.uid, 'tg_9001', 'Bagian 5 K1: uid stays tg_9001, not web-old-acct');
  assert.notStrictEqual(verifyRes.uid, 'web-old-acct', 'Bagian 5 K1: did NOT resolve to old web UID');
  console.log('  ✔ Bagian 5 K1: verifyWebLoginCode blocks unlinked user from resolving to old web UID');

  // Kriteria 3 & 4: after re-link + verify, verifyWebLoginCode resolves normally
  store.telegram_codes['RELINK9001'] = { uid: 'web-new-acct', expiresAt: new Date(Date.now() + 600000).toISOString() };
  const relinked = await linkChatWithCode('9001', 'RELINK9001', { first_name: 'NewUser' }, mdb);
  assert.strictEqual(relinked, 'web-new-acct');

  const { code: codeAfterRelink } = await generateWebLoginCode('web-new-acct', mdb);
  const verifyAfter = await verifyWebLoginCode(codeAfterRelink, mdb);
  assert.ok(!verifyAfter.needsVerification, 'Bagian 5 K3: no needsVerification after re-link');
  assert.ok(verifyAfter.uid, 'Bagian 5 K3: uid resolved');
  console.log('  ✔ Bagian 5 K3: after re-link, verifyWebLoginCode resolves normally');

  // Kriteria 5: fresh user unaffected
  const freshUid2 = await ensureTelegramUser('99001', { first_name: 'Fresh2' }, mdb);
  const { code: freshCode2 } = await generateWebLoginCode(freshUid2, mdb);
  const verifyFresh = await verifyWebLoginCode(freshCode2, mdb);
  assert.ok(!verifyFresh.needsVerification, 'Bagian 5 K5: fresh user has no needsVerification');
  assert.strictEqual(verifyFresh.uid, freshUid2, 'Bagian 5 K5: fresh user uid resolved correctly');
  console.log('  ✔ Bagian 5 K5: fresh user not affected by unlinkedAt guard');

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

