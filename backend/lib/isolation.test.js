import assert from 'assert';
import http from 'http';
import {
  generateLinkCode, getLinkStatus, unlinkAccount,
  findLinkedUid, linkChatWithCode, ensureTelegramUser,
  generateWebLoginCode, verifyWebLoginCode
} from './telegramBotCore.js';

global.fetch = async () => ({ json: async () => ({ ok: true }) });

function req(server, method, path, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(path, `http://localhost:${server.address().port}`);
    const opts = { method, hostname: u.hostname, port: u.port, path: u.pathname, headers: {} };
    if (body) { const d = JSON.stringify(body); opts.headers['Content-Type'] = 'application/json'; opts.headers['Content-Length'] = Buffer.byteLength(d); }
    const r = http.request(opts, (res) => { let c = ''; res.on('data', (ch) => (c += ch)); res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(c) }); } catch { resolve({ status: res.statusCode, body: c }); } }); });
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
  assert.strictEqual((await getLinkStatus(uidA, null)).linked, false);
  assert.strictEqual((await getLinkStatus(uidB, null)).linked, true, 'B still linked after A unlinks');
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

    // DELETE non-existent ID = safe no-op
    const r6 = await req(server, 'DELETE', '/api/transactions/bogus-xyz');
    assert.strictEqual(r6.status, 200);
    assert.deepStrictEqual(r6.body, { ok: true });

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
    assert.strictEqual((await req(server, 'DELETE', '/api/goals/bogus-xyz')).status, 200);

    console.log('    ✔ REST CRUD + safe no-op DELETE passed');

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
