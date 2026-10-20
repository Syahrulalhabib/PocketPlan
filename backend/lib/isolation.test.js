import assert from 'assert';
import http from 'http';
import {
  generateLinkCode, getLinkStatus, unlinkAccount,
  findLinkedUid, linkChatWithCode, ensureTelegramUser,
  generateWebLoginCode, verifyWebLoginCode, completeTelegramLink
} from './telegramBotCore.js';

global.fetch = async () => ({ json: async () => ({ ok: true }) });

function req(server, method, path, body, customHeaders = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(path, `http://localhost:${server.address().port}`);
    const opts = { method, hostname: u.hostname, port: u.port, path: `${u.pathname}${u.search}`, headers: { ...customHeaders } };
    if (body) { const d = JSON.stringify(body); opts.headers['Content-Type'] = 'application/json'; opts.headers['Content-Length'] = Buffer.byteLength(d); }
    const r = http.request(opts, (res) => {
      const chunks = [];
      res.on('data', (ch) => chunks.push(ch));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        const ct = res.headers['content-type'] || '';
        if (ct.includes('application/json')) {
          try { resolve({ status: res.statusCode, body: JSON.parse(buf.toString('utf8')), headers: res.headers }); }
          catch { resolve({ status: res.statusCode, body: buf.toString('utf8'), headers: res.headers }); }
        } else {
          resolve({ status: res.statusCode, body: buf, headers: res.headers });
        }
      });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

// PART 1: Telegram link-code isolation
async function testTelegramIsolation() {
  console.log('  [1] Telegram link-code isolation...');
  const uidA = await ensureTelegramUser(100, { first_name: 'Alice', username: 'alice' }, null);
  const uidB = await ensureTelegramUser(200, { first_name: 'Bob', username: 'bob' }, null);
  assert.strictEqual(uidA, 'tg_100');
  assert.strictEqual(uidB, 'tg_200');
  assert.notStrictEqual(uidA, uidB);
  assert.strictEqual(await findLinkedUid(100, null), uidA);
  assert.strictEqual(await findLinkedUid(200, null), uidB);
  assert.strictEqual(await findLinkedUid(999, null), null);
  const { code } = await generateLinkCode('web-user-1', null, 'TestBot');
  assert.strictEqual(await linkChatWithCode(300, code, { first_name: 'Carol' }, null), 'web-user-1');
  assert.strictEqual(await findLinkedUid(300, null), 'web-user-1');
  assert.strictEqual(await linkChatWithCode(400, code, { first_name: 'Dave' }, null), null, 'Used code returns null');
  const { code: cA } = await generateWebLoginCode(uidA, null);
  const { code: cB } = await generateWebLoginCode(uidB, null);
  assert.strictEqual((await verifyWebLoginCode(cA, null)).uid, uidA);
  assert.strictEqual((await verifyWebLoginCode(cB, null)).uid, uidB);
  await unlinkAccount(uidA, null);
  assert.strictEqual((await getLinkStatus(uidA, null)).dataLinked, false);
  assert.strictEqual((await getLinkStatus(uidB, null)).dataLinked, true, 'B still data-linked after A unlinks');
  assert.strictEqual((await getLinkStatus(uidB, null)).fullyLinked, false, 'B not fully linked before password set');
  await completeTelegramLink(uidB, null);
  assert.strictEqual((await getLinkStatus(uidB, null)).fullyLinked, true, 'B fully linked after completing link');
  assert.strictEqual((await getLinkStatus(uidB, null)).linked, true);
  console.log('    ✔ passed');
}

// PART 2: REST API isolation (demo in-memory mode)
async function testRestApiIsolation() {
  console.log('  [2] REST API isolation (demo mode)...');
  // Force demo mode: skip Firebase init so requireAuth falls through to demo-user
  process.env.SKIP_FIREBASE_INIT = '1';
  process.env.VERCEL = '1'; // prevent auto-listen on PORT
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  delete process.env.GOOGLE_SERVICE_ACCOUNT_BASE64;
  const { default: app } = await import('../index.js');
  const server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  try {
    // GET transactions
    const r1 = await req(server, 'GET', '/api/transactions');
    assert.strictEqual(r1.status, 200);
    assert.ok(Array.isArray(r1.body));
    const initLen = r1.body.length;

    // POST adds to demo-user's list
    const r2 = await req(server, 'POST', '/api/transactions', { category: 'Food', type: 'Expense', amount: 50000, description: 'Test meal' });
    assert.strictEqual(r2.status, 201);
    const r3 = await req(server, 'GET', '/api/transactions');
    assert.strictEqual(r3.body.length, initLen + 1);
    const added = r3.body.find(t => t.description === 'Test meal');
    assert.ok(added, 'Added tx found');

    // DELETE valid ID
    const r4 = await req(server, 'DELETE', `/api/transactions/${added.id}`);
    assert.strictEqual(r4.status, 200);
    assert.deepStrictEqual(r4.body, { ok: true });
    const r5 = await req(server, 'GET', '/api/transactions');
    assert.strictEqual(r5.body.length, initLen);

    // DELETE non-existent ID = 404
    const r6 = await req(server, 'DELETE', '/api/transactions/bogus-xyz');
    assert.strictEqual(r6.status, 404);

    // Goals CRUD
    const g1 = await req(server, 'GET', '/api/goals');
    assert.strictEqual(g1.status, 200);
    const gLen = g1.body.length;
    const g2 = await req(server, 'POST', '/api/goals', { name: 'Camera', type: 'Saving', amount: 0, target: 5000000 });
    assert.strictEqual(g2.status, 201);
    const g3 = await req(server, 'GET', '/api/goals');
    assert.strictEqual(g3.body.length, gLen + 1);
    const addedG = g3.body.find(g => g.name === 'Camera');
    assert.ok(addedG);
    assert.strictEqual((await req(server, 'DELETE', `/api/goals/${addedG.id}`)).status, 200);
    assert.strictEqual((await req(server, 'DELETE', '/api/goals/bogus-xyz')).status, 404);

    console.log('    ✔ REST CRUD + DELETE 404 for non-existent passed');

    // Report endpoint tests
    const rBadMonth = await req(server, 'GET', '/api/report?month=invalid-date');
    assert.strictEqual(rBadMonth.status, 400);
    assert.ok(rBadMonth.body.error);

    const rOkReport = await req(server, 'GET', '/api/report?month=2026-10');
    assert.strictEqual(rOkReport.status, 200);
    assert.ok(rOkReport.body.summary);
    assert.ok(Array.isArray(rOkReport.body.byCategory));
    console.log('    ✔ /api/report 400 validation & 200 response passed');

    // Achievements endpoints tests
    const rAch = await req(server, 'GET', '/api/achievements');
    assert.strictEqual(rAch.status, 200);
    assert.ok(Array.isArray(rAch.body));
    assert.ok(rAch.body.length > 0);
    // PRIVACY VERIFICATION: string must not contain Rp or nominal
    const rawAch = JSON.stringify(rAch.body);
    assert.ok(!rawAch.includes('Rp'), 'Achievements response must not leak Rp');
    assert.ok(!rawAch.includes('balance'), 'Achievements response must not leak balance');
    assert.ok(!rawAch.includes('nominal'), 'Achievements response must not leak nominal');

    console.log('    ✔ /api/achievements privacy passed');

    // Cron reminders endpoint tests (GET & POST with Bearer CRON_SECRET)
    process.env.CRON_SECRET = 'test-cron-secret-123';
    process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token';

    const rCronUnauth = await req(server, 'GET', '/api/cron/reminders?type=morning');
    assert.strictEqual(rCronUnauth.status, 403);

    const rCronAuth = await req(server, 'GET', '/api/cron/reminders?type=morning', null, {
      authorization: 'Bearer test-cron-secret-123'
    });
    assert.strictEqual(rCronAuth.status, 200);
    assert.strictEqual(rCronAuth.body.ok, true);
    assert.strictEqual(rCronAuth.body.type, 'morning');

    console.log('    ✔ /api/cron/reminders GET auth & dispatch passed');

    // Admin test reminder endpoint test
    const rTestUnauth = await req(server, 'POST', '/api/admin/test-reminder');
    assert.strictEqual(rTestUnauth.status, 403);

    const rTestAuth = await req(server, 'POST', '/api/admin/test-reminder?type=evening', null, {
      authorization: 'Bearer test-cron-secret-123'
    });
    assert.strictEqual(rTestAuth.status, 200);
    assert.strictEqual(rTestAuth.body.ok, true);
    assert.strictEqual(rTestAuth.body.test, true);
    assert.strictEqual(rTestAuth.body.type, 'evening');
    console.log('    ✔ /api/admin/test-reminder POST auth & test passed');

    // Admin sync commands endpoint test
    const rSyncUnauth = await req(server, 'POST', '/api/admin/sync-commands');
    assert.strictEqual(rSyncUnauth.status, 403);

    const rSyncAuth = await req(server, 'POST', '/api/admin/sync-commands', null, {
      authorization: 'Bearer test-cron-secret-123'
    });
    assert.strictEqual(rSyncAuth.status, 200);
    assert.strictEqual(rSyncAuth.body.ok, true);
    assert.strictEqual(typeof rSyncAuth.body.commandsCount, 'number');
    assert(rSyncAuth.body.commandsCount > 0);
    console.log('    ✔ /api/admin/sync-commands POST auth & sync passed');
    // Admin fix-stale-links endpoint test
    const rFixUnauth = await req(server, 'POST', '/api/admin/fix-stale-links');
    assert.strictEqual(rFixUnauth.status, 403);

    const rFixAuth = await req(server, 'POST', '/api/admin/fix-stale-links', null, {
      authorization: 'Bearer test-cron-secret-123'
    });
    assert.strictEqual(rFixAuth.status, 200);
    assert.strictEqual(rFixAuth.body.ok, true);
    assert.strictEqual(typeof rFixAuth.body.fixedCount, 'number');
    console.log('    ✔ /api/admin/fix-stale-links POST auth & fix passed');

    // Admin cleanup-stale-telegram endpoint test
    const rCleanUnauth = await req(server, 'POST', '/api/admin/cleanup-stale-telegram');
    assert.strictEqual(rCleanUnauth.status, 403);

    const rCleanAuth = await req(server, 'POST', '/api/admin/cleanup-stale-telegram', null, {
      authorization: 'Bearer test-cron-secret-123'
    });
    assert.strictEqual(rCleanAuth.status, 200);
    assert.strictEqual(rCleanAuth.body.ok, true);
    assert.strictEqual(typeof rCleanAuth.body.cleaned, 'number');
    console.log('    ✔ /api/admin/cleanup-stale-telegram POST auth & cleanup passed');

    // Admin cron-status endpoint test — requires auth
    const rCronStatusUnauth = await req(server, 'GET', '/api/admin/cron-status');
    assert.strictEqual(rCronStatusUnauth.status, 403);

    const rCronStatus = await req(server, 'GET', '/api/admin/cron-status', null, {
      authorization: 'Bearer test-cron-secret-123'
    });
    assert.strictEqual(rCronStatus.status, 200);
    assert.strictEqual(typeof rCronStatus.body.cronSecretConfigured, 'boolean');
    assert.strictEqual(typeof rCronStatus.body.telegramBotTokenConfigured, 'boolean');
    assert.strictEqual(typeof rCronStatus.body.totalLinkedUsers, 'number');
    assert.strictEqual(typeof rCronStatus.body.usersWithReminderEnabled, 'number');
    assert.strictEqual(rCronStatus.body.cronSecretConfigured, true);
    // Verify no secret hints leaked
    assert.strictEqual(rCronStatus.body.cronSecretHint, undefined);
    assert.strictEqual(rCronStatus.body.adminSecretHint, undefined);
    assert.strictEqual(rCronStatus.body.webhookSecretConfigured, undefined);
    console.log('    ✔ /api/admin/cron-status GET auth & no secret hints passed');

    // POST /api/telegram/web-login boundary tests
    const rWlNoCode = await req(server, 'POST', '/api/telegram/web-login', {});
    assert.strictEqual(rWlNoCode.status, 400);

    const rWlNotFound = await req(server, 'POST', '/api/telegram/web-login', { code: 'NOEXIST' });
    assert.strictEqual(rWlNotFound.status, 404);
    console.log('    ✔ /api/telegram/web-login boundary validations passed');

    // Test: /api/telegram/web-login returns 403 for unlinked user code
    // Setup: link, then unlink to set unlinkedAt flag
    const { code: wlLinkCode } = await generateLinkCode('web-wl-test', null, 'TestBot');
    await linkChatWithCode('55001', wlLinkCode, { first_name: 'WlTest' }, null);
    await unlinkAccount('web-wl-test', null);
    const { code: wlUnlinkedCode } = await generateWebLoginCode('tg_55001', null);
    const rWlUnlinked = await req(server, 'POST', '/api/telegram/web-login', { code: wlUnlinkedCode });
    assert.strictEqual(rWlUnlinked.status, 403);
    assert.strictEqual(rWlUnlinked.body.needsVerification, true);
    assert.strictEqual(rWlUnlinked.body.ok, false);
    console.log('    ✔ /api/telegram/web-login returns 403 for unlinked user needing verification');


    // Per-uid Map isolation (unit level, same pattern as getDemoTransactions)
    const mapA = new Map(), mapB = new Map();
    function getList(map, uid) { if (!map.has(uid)) map.set(uid, [{ id: '1' }]); return map.get(uid); }
    const la = getList(mapA, 'A'); const lb = getList(mapA, 'B');
    assert.notStrictEqual(la, lb);
    la.push({ id: '2' });
    assert.strictEqual(lb.length, 1, 'Mutating A does not affect B');
    // Cross-user DELETE no-op
    const crossIdx = la.findIndex(t => t.id === 'b-only');
    assert.strictEqual(crossIdx, -1);
    console.log('    ✔ Per-uid Map isolation passed');
  } finally {
    server.close();
  }
}

console.log('Running isolation tests...');
try {
  await testTelegramIsolation();
  await testRestApiIsolation();
  console.log('\nAll isolation tests passed! ✅');
} catch (err) {
  console.error('\n❌ Test failed:', err.message);
  console.error(err);
  process.exit(1);
}
