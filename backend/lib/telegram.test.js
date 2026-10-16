import assert from 'assert';
import { parseAmount, parseTransactionCommand, formatRupiah, normalizeBudgetCategory, guessBudgetCategory } from './telegramParser.js';
import { generateLinkCode, getLinkStatus, unlinkAccount, linkChatWithCode, cancelLinkCode, DEFAULT_BOT_COMMANDS, invalidateUidCache } from './telegramBotCore.js';
import { handleTelegramUpdate, queueTempMessage, cleanExpiredTempMessages } from './telegramBot.js';

console.log('Running Telegram integration tests...');

// 1. Amount parser
assert.strictEqual(parseAmount('50000'), 50000);
assert.strictEqual(parseAmount('50.000'), 50000);
assert.strictEqual(parseAmount('50k'), 50000);
assert.strictEqual(parseAmount('50rb'), 50000);
assert.strictEqual(parseAmount('1.5jt'), 1500000);
assert.strictEqual(parseAmount('Rp 75.000'), 75000);
assert.strictEqual(parseAmount('25k,-'), 25000);
assert.strictEqual(parseAmount('Rp 25.000,-'), 25000);
assert.strictEqual(parseAmount('(50k)'), 50000);
assert.strictEqual(parseAmount('☕25k'), 25000);
assert.strictEqual(parseAmount('50k🍔'), 50000);

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

const txEmoji1 = parseTransactionCommand('☕ 25k');
assert.strictEqual(txEmoji1.amount, 25000);
assert.strictEqual(txEmoji1.category, 'Food');

const txEmoji2 = parseTransactionCommand('bensin ⛽ 50k');
assert.strictEqual(txEmoji2.amount, 50000);
assert.strictEqual(txEmoji2.category, 'Transport');

const txEmoji3 = parseTransactionCommand('+500k 💰 freelance');
assert.strictEqual(txEmoji3.type, 'Income');
assert.strictEqual(txEmoji3.amount, 500000);
assert.strictEqual(txEmoji3.category, 'Salary');

// T9-B: Budget category normalization & alignment tests
assert.strictEqual(normalizeBudgetCategory('makan'), 'Food');
assert.strictEqual(normalizeBudgetCategory('makanan'), 'Food');
assert.strictEqual(normalizeBudgetCategory('Makanan (Food)'), 'Food');
assert.strictEqual(normalizeBudgetCategory('Food & Dining'), 'Food');
assert.strictEqual(normalizeBudgetCategory('transport'), 'Transport');
assert.strictEqual(normalizeBudgetCategory('Transportasi (Transport)'), 'Transport');
assert.strictEqual(normalizeBudgetCategory('belanja'), 'Shopping');
assert.strictEqual(normalizeBudgetCategory('Belanja (Shopping)'), 'Shopping');
assert.strictEqual(normalizeBudgetCategory('tagihan'), 'Bills');
assert.strictEqual(normalizeBudgetCategory('Bills & Utilities'), 'Bills');

// Category guessing tests
const guessedLaptop = guessBudgetCategory('beli laptop');
assert.strictEqual(guessedLaptop.category, 'Shopping');
assert.strictEqual(guessedLaptop.isGuessed, true);
const directFood = guessBudgetCategory('makan');
assert.strictEqual(directFood.category, 'Food');
assert.strictEqual(directFood.isGuessed, false);


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

  // Test /help command contains Pocky branding without AI mention
  replies = [];
  await handleTelegramUpdate({
    message: { chat: { id: 888 }, text: '/help', from: { first_name: 'User' } }
  }, null, 'token');
  assert(replies[0].text.includes('SCAN STRUK'));
  assert(!replies[0].text.includes(' AI '));

  // Test receipt scan on 503 / queue overload
  const oldFetch = global.fetch;
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
      return { ok: false, status: 503, text: async () => 'Service Unavailable' };
    }
    return { ok: true, json: async () => ({ ok: true, result: true }) };
  };

  replies = [];
  await handleTelegramUpdate({
    update_id: 99991,
    message: { chat: { id: 888 }, photo: [{ file_id: 'queue_pic' }], from: { first_name: 'User' } }
  }, null, 'token');
  assert(replies.some(r => (r.text || '').includes('ramai antreannya') && (r.text || '').includes('beberapa detik kembali')));

  // Test receipt scan on blurry / parsing error
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
            content: { parts: [{ text: 'bukan json format struk' }] }
          }]
        })
      };
    }
    return { ok: true, json: async () => ({ ok: true, result: true }) };
  };

  replies = [];
  await handleTelegramUpdate({
    update_id: 99992,
    message: { chat: { id: 888 }, photo: [{ file_id: 'blurry_pic' }], from: { first_name: 'User' } }
  }, null, 'token');
  assert(replies.some(r => (r.text || '').includes('burem') && (r.text || '').includes('kirimkan kembali')));

  // Test non-receipt photo detection
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
            content: { parts: [{ text: JSON.stringify({ is_receipt: false, rejection_reason: 'foto kucing' }) }] }
          }]
        })
      };
    }
    return { ok: true, json: async () => ({ ok: true, result: true }) };
  };

  replies = [];
  await handleTelegramUpdate({
    update_id: 99993,
    message: { chat: { id: 888 }, photo: [{ file_id: 'cat_pic' }], from: { first_name: 'User' } }
  }, null, 'token');
  assert(replies.some(r => (r.text || '').includes('Ups, ini bukan struk') && (r.text || '').includes('foto kucing')));

  global.fetch = oldFetch;


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
  assert(replies[0].text.includes('Pengingat'));
  assert(replies[0].text.includes('06:00 WIB'));
  assert(replies[0].text.includes('23:00 WIB'));

  // Test DEFAULT_BOT_COMMANDS includes pengingat
  assert(DEFAULT_BOT_COMMANDS.some((c) => c.command === 'pengingat'));

  // Test toggle_reminder callback
  replies = [];
  await handleTelegramUpdate({
    callback_query: { id: 'cb_toggle', data: 'toggle_reminder', message: { chat: { id: 999 }, message_id: 1 }, from: { first_name: 'Budi' } }
  }, null, 'token');

  // Test reminder generators (multiple goals + progress against balance)
  const morningMsg = generateMorningReminder('Budi', 500000, [
    { name: 'Liburan', target: 1000000 },
    { name: 'Beli Rumah', target: 50000000 }
  ]);
  assert(morningMsg.includes('Selamat Pagi, Budi!'));
  assert(morningMsg.includes('500.000'));
  assert(morningMsg.includes('Liburan'));
  assert(morningMsg.includes('Beli Rumah'));
  assert(morningMsg.includes('1.000.000'));
  assert(morningMsg.includes('50.000.000'));
  assert(morningMsg.includes('50%'));
  assert(morningMsg.includes('1%'));

  const eveningMsg = generateEveningReminder('Budi', { totalExpense: 75000, currentBalance: 425000, expenseCount: 2 });
  assert(eveningMsg.includes('Rekap Malam'));
  assert(eveningMsg.includes('75.000'));
  assert(eveningMsg.includes('425.000'));

  // Test findLinkedUid caching
  const cachedUid = await findLinkedUid(888, null);
  assert.strictEqual(cachedUid, 'user-888');

  // --- Fase 1: Link nudge at 20th transaction ---
  // Mock a minimal Firestore-like db for nudge test
  invalidateUidCache(); // clear stale cache from earlier tests
  const nudgeStore = { users: {}, telegram_links: {} };
  function mockDb() {
    const makeTopDocRef = (name, id) => {
      const topRef = {
        delete: async () => { if (nudgeStore[name]) delete nudgeStore[name][id]; },
        set: async (d, o) => {
          nudgeStore[name] = nudgeStore[name] || {};
          nudgeStore[name][id] = o?.merge ? Object.assign(nudgeStore[name][id] || {}, d) : { ...d };
        },
        update: async (d) => {
          nudgeStore[name] = nudgeStore[name] || {};
          nudgeStore[name][id] = Object.assign(nudgeStore[name][id] || {}, d);
        }
      };
      const hasData = Boolean(nudgeStore[name]?.[id] && Object.keys(nudgeStore[name][id]).some(k => k !== '_sub'));
      return {
        id,
        ref: topRef,
        exists: hasData,
        data: () => nudgeStore[name]?.[id] || {}
      };
    };
    return {
      collection: (name) => ({
        doc: (id) => {
          const topDoc = makeTopDocRef(name, id);
          return {
            id,
            ref: topDoc.ref,
            get: async () => makeTopDocRef(name, id),
            set: topDoc.ref.set,
            update: topDoc.ref.update,
            collection: (sub) => {
              nudgeStore[name] = nudgeStore[name] || {};
              nudgeStore[name][id] = nudgeStore[name][id] || {};
              const docData = nudgeStore[name][id];
              docData._sub = docData._sub || {};
              docData._sub[sub] = docData._sub[sub] || {};
              const subStore = docData._sub[sub];
              const makeDocRef = (k) => ({
                id: k,
                ref: {
                  delete: async () => { delete subStore[k]; },
                  set: async (d, o) => { Object.assign(subStore[k], d); },
                  update: async (d) => { Object.assign(subStore[k], d); }
                },
                exists: true,
                data: () => subStore[k]
              });
              return {
                add: async (d) => { const k = `${sub[0]}-${Date.now()}-${Math.random()}`; subStore[k] = { ...d }; return { id: k }; },
                doc: (k) => {
                  subStore[k] = subStore[k] || {};
                  return makeDocRef(k);
                },
                count: () => ({ get: async () => ({ data: () => ({ count: Object.keys(subStore).length }) }) }),
                get: async () => {
                  const docs = Object.keys(subStore).map(makeDocRef);
                  return { empty: docs.length === 0, docs, forEach: fn => docs.forEach(fn) };
                },
                where: (field, op, val) => {
                  const filter = (items) => items.filter(([, v]) => {
                    const fv = v[field]; if (op === '==') return fv === val; if (op === '>=') return fv >= val;
                    if (op === '<=') return fv <= val; if (op === '<') return fv < val; if (op === '>') return fv > val; return true;
                  });
                  const buildChain = (filterFn) => ({
                    where: (f2, o2, v2) => buildChain((items) => filterFn(items).filter(([, v]) => {
                      const fv = v[f2]; if (o2 === '==') return fv === v2; if (o2 === '>=') return fv >= v2;
                      if (o2 === '<=') return fv <= v2; if (o2 === '<') return fv < v2; if (o2 === '>') return fv > v2; return true;
                    })),
                    limit: (n) => ({ get: async () => {
                      const filtered = filterFn(Object.entries(subStore)).slice(0, n);
                      const docs = filtered.map(([k]) => makeDocRef(k));
                      return { empty: docs.length === 0, docs, forEach: fn => docs.forEach(fn) };
                    }}),
                    get: async () => {
                      const filtered = filterFn(Object.entries(subStore));
                      const docs = filtered.map(([k]) => makeDocRef(k));
                      return { empty: docs.length === 0, docs, forEach: fn => docs.forEach(fn) };
                    }
                  });
                  return buildChain(filter);
                },
                orderBy: () => ({ limit: () => ({ get: async () => ({ empty: true, docs: [] }) }) })
              };
            }
          };
        },
        add: async (d) => {
          nudgeStore[name] = nudgeStore[name] || {};
          const k = `${name[0]}-${Date.now()}-${Math.random()}`;
          nudgeStore[name][k] = { ...d };
          return { id: k };
        },
        where: (field, op, val) => {
          nudgeStore[name] = nudgeStore[name] || {};
          const store = nudgeStore[name];
          const filter = (items) => items.filter(([, v]) => {
            const fv = v[field]; if (op === '==') return fv === val; if (op === '>=') return fv >= val;
            if (op === '<=') return fv <= val; if (op === '<') return fv < val; return true;
          });
          return {
            get: async () => {
              const filtered = filter(Object.entries(store));
              const docs = filtered.map(([k]) => makeTopDocRef(name, k));
              return { empty: docs.length === 0, docs, forEach: fn => docs.forEach(fn) };
            },
            limit: (n) => ({ get: async () => {
              const filtered = filter(Object.entries(store)).slice(0, n);
              const docs = filtered.map(([k]) => makeTopDocRef(name, k));
              return { empty: docs.length === 0, docs, forEach: fn => docs.forEach(fn) };
            }})
          };
        },
        get: async () => {
          const ids = Object.keys(nudgeStore[name] || {});
          const docs = ids.map(id => makeTopDocRef(name, id));
          return { empty: docs.length === 0, docs, forEach: fn => docs.forEach(fn) };
        }
      })
    };
  }
  const mdb = mockDb();
  // Set up a tg_ user (unlinked)
  nudgeStore.users['tg_5000'] = { name: 'NudgeUser', isTelegramUser: true };
  nudgeStore.telegram_links['5000'] = { uid: 'tg_5000' };

  // Record 19 transactions — no nudge expected
  replies = [];
  for (let i = 0; i < 19; i++) {
    await handleTelegramUpdate({ message: { chat: { id: 5000 }, text: `/masuk gaji ${i + 1}k`, from: { first_name: 'NudgeUser' } } }, mdb, 'token');
  }
  const nudgeBefore20 = replies.filter(r => (r.text || '').includes('20 transaksi'));
  assert.strictEqual(nudgeBefore20.length, 0, 'No nudge before 20th tx');

  // 20th transaction — nudge should fire
  replies = [];
  await handleTelegramUpdate({ message: { chat: { id: 5000 }, text: '/masuk gaji 20k', from: { first_name: 'NudgeUser' } } }, mdb, 'token');
  const nudgeAt20 = replies.filter(r => (r.text || '').includes('20 transaksi'));
  assert.strictEqual(nudgeAt20.length, 1, 'Nudge sent at 20th tx');
  assert.strictEqual(nudgeStore.users['tg_5000'].linkNudgeSent, true, 'linkNudgeSent flag set');

  // 21st transaction — no nudge again
  replies = [];
  await handleTelegramUpdate({ message: { chat: { id: 5000 }, text: '/masuk gaji 21k', from: { first_name: 'NudgeUser' } } }, mdb, 'token');
  const nudgeAt21 = replies.filter(r => (r.text || '').includes('20 transaksi'));
  assert.strictEqual(nudgeAt21.length, 0, 'No nudge at 21st tx');

  // Linked user (uid does not start with tg_) — no nudge
  nudgeStore.users['web-user-linked'] = { name: 'Linked' };
  nudgeStore.telegram_links['6000'] = { uid: 'web-user-linked' };
  invalidateUidCache();
  replies = [];
  for (let i = 0; i < 21; i++) {
    await handleTelegramUpdate({ message: { chat: { id: 6000 }, text: `/masuk gaji ${i + 1}k`, from: { first_name: 'Linked' } } }, mdb, 'token');
  }
  const nudgeLinked = replies.filter(r => (r.text || '').includes('20 transaksi'));
  assert.strictEqual(nudgeLinked.length, 0, 'No nudge for linked user');

  // --- Fase 2: Budget command + budget warnings ---
  // Use user tg_5000 with mock db (already has income from nudge tests)
  invalidateUidCache();

  // /budget with no budgets set → shows empty message
  replies = [];
  await handleTelegramUpdate({ message: { chat: { id: 5000 }, text: '/budget', from: { first_name: 'NudgeUser' } } }, mdb, 'token');
  assert(replies.some(r => (r.text || '').includes('Belum ada budget')), 'Empty budget list');

  // /budget Makan 500k → set budget
  replies = [];
  await handleTelegramUpdate({ message: { chat: { id: 5000 }, text: '/budget Makan 500k', from: { first_name: 'NudgeUser' } } }, mdb, 'token');
  assert(replies.some(r => (r.text || '').includes('Budget') && (r.text || '').includes('diatur')), 'Budget set confirmation');

  // /budget → list should show Makan budget
  replies = [];
  await handleTelegramUpdate({ message: { chat: { id: 5000 }, text: '/budget', from: { first_name: 'NudgeUser' } } }, mdb, 'token');
  assert(replies.some(r => (r.text || '').includes('Makan')), 'Budget list shows Makan');

  // Add income 1jt then /catat 450k makan → triggers 80% warning (450k / 500k = 90%)
  await handleTelegramUpdate({ message: { chat: { id: 5000 }, text: '/masuk gaji 1jt', from: { first_name: 'NudgeUser' } } }, mdb, 'token');
  replies = [];
  await handleTelegramUpdate({ message: { chat: { id: 5000 }, text: '/catat 450k makan', from: { first_name: 'NudgeUser' } } }, mdb, 'token');
  assert(replies.some(r => (r.text || '').includes('hampir habis')), 'Budget warning 80% triggered on expense');
  // User scenario: /budget transport 200rb, /budget lists it, /catat 180k bensin (warning 80%), /catat 30k bensin (warning 100%)
  replies = [];
  await handleTelegramUpdate({ message: { chat: { id: 5000 }, text: '/budget transport 200rb', from: { first_name: 'NudgeUser' } } }, mdb, 'token');
  assert(replies.some(r => (r.text || '').includes('200.000')), 'Budget transport 200rb set');

  replies = [];
  await handleTelegramUpdate({ message: { chat: { id: 5000 }, text: '/budget', from: { first_name: 'NudgeUser' } } }, mdb, 'token');
  assert(replies.some(r => (r.text || '').includes('transport')), 'Budget list shows transport');

  replies = [];
  await handleTelegramUpdate({ message: { chat: { id: 5000 }, text: '/catat 180k bensin', from: { first_name: 'NudgeUser' } } }, mdb, 'token');
  assert(replies.some(r => (r.text || '').includes('hampir habis')), '180k expense on 200k transport budget triggers warning 80%');

  replies = [];
  await handleTelegramUpdate({ message: { chat: { id: 5000 }, text: '/catat 30k bensin', from: { first_name: 'NudgeUser' } } }, mdb, 'token');
  assert(replies.some(r => (r.text || '').includes('habis') && (r.text || '').includes('🚨')), 'Over limit expense triggers warning 100%');

  // /budget hapus transport → delete
  replies = [];
  await handleTelegramUpdate({ message: { chat: { id: 5000 }, text: '/budget hapus transport', from: { first_name: 'NudgeUser' } } }, mdb, 'token');
  assert(replies.some(r => (r.text || '').includes('dihapus')), 'Budget transport deleted');


  // /budget hapus Makan → delete
  replies = [];
  await handleTelegramUpdate({ message: { chat: { id: 5000 }, text: '/budget hapus Makan', from: { first_name: 'NudgeUser' } } }, mdb, 'token');
  assert(replies.some(r => (r.text || '').includes('dihapus')), 'Budget deleted');

  // /budget hapus NonExistent → not found
  replies = [];
  await handleTelegramUpdate({ message: { chat: { id: 5000 }, text: '/budget hapus NonExistent', from: { first_name: 'NudgeUser' } } }, mdb, 'token');
  assert(replies.some(r => (r.text || '').includes('tidak ditemukan')), 'Budget not found');

  // Point 11: Multi-category budget synchronization test across all 7 non-food categories
  const catTests = [
    { name: 'Transport', set: '/budget transport 500k', catat: '/catat 50k bensin', expectedLabel: 'transport', expectedSpent: '50.000' },
    { name: 'Shopping', set: '/budget shopping 1jt', catat: '/catat 100k belanja baju', expectedLabel: 'shopping', expectedSpent: '100.000' },
    { name: 'Bills', set: '/budget bills 300k', catat: '/catat 150k tagihan listrik', expectedLabel: 'bills', expectedSpent: '150.000' },
    { name: 'Health', set: '/budget health 200k', catat: '/catat 50k obat apotek', expectedLabel: 'health', expectedSpent: '50.000' },
    { name: 'Entertainment', set: '/budget entertainment 400k', catat: '/catat 60k nonton bioskop', expectedLabel: 'entertainment', expectedSpent: '60.000' },
    { name: 'Education', set: '/budget education 500k', catat: '/catat 80k buku kuliah', expectedLabel: 'education', expectedSpent: '80.000' },
    { name: 'Charity', set: '/budget charity 100k', catat: '/catat 20k donasi infaq', expectedLabel: 'charity', expectedSpent: '20.000' }
  ];

  await handleTelegramUpdate({ message: { chat: { id: 5000 }, text: '/masuk gaji 10jt', from: { first_name: 'NudgeUser' } } }, mdb, 'token');

  for (const ct of catTests) {
    await handleTelegramUpdate({ message: { chat: { id: 5000 }, text: ct.set, from: { first_name: 'NudgeUser' } } }, mdb, 'token');
    await handleTelegramUpdate({ message: { chat: { id: 5000 }, text: ct.catat, from: { first_name: 'NudgeUser' } } }, mdb, 'token');
  }

  replies = [];
  await handleTelegramUpdate({ message: { chat: { id: 5000 }, text: '/budget', from: { first_name: 'NudgeUser' } } }, mdb, 'token');
  const budgetListReply = replies[0]?.text || '';
  for (const ct of catTests) {
    assert(budgetListReply.includes(ct.expectedLabel), `Budget list contains ${ct.name} (${ct.expectedLabel})`);
    assert(budgetListReply.includes(ct.expectedSpent), `Budget list for ${ct.name} updated with spent ${ct.expectedSpent}`);
  }

  // Antigravity Audit Poin 1: Natural syntax expense recording across all 7 non-food categories without /catat prefix
  const naturalCatTests = [
    { name: 'Transport', set: '/budget transportasi 800k', catat: 'bensin 75rb', expectedLabel: 'transportasi', expectedSpent: '75.000' },
    { name: 'Shopping', set: '/budget belanja 1.5jt', catat: 'baju 120rb', expectedLabel: 'belanja', expectedSpent: '120.000' },
    { name: 'Bills', set: '/budget tagihan 600k', catat: 'token listrik 100rb', expectedLabel: 'tagihan', expectedSpent: '100.000' },
    { name: 'Health', set: '/budget kesehatan 400k', catat: 'obat 45rb', expectedLabel: 'kesehatan', expectedSpent: '45.000' },
    { name: 'Entertainment', set: '/budget hiburan 500k', catat: 'nonton 65rb', expectedLabel: 'hiburan', expectedSpent: '65.000' },
    { name: 'Education', set: '/budget pendidikan 700k', catat: 'buku 90rb', expectedLabel: 'pendidikan', expectedSpent: '90.000' },
    { name: 'Charity', set: '/budget amal 300k', catat: 'donasi 35rb', expectedLabel: 'amal', expectedSpent: '35.000' }
  ];

  await handleTelegramUpdate({ message: { chat: { id: 6000 }, text: '/masuk gaji 10jt', from: { first_name: 'NaturalUser' } } }, mdb, 'token');

  for (const nct of naturalCatTests) {
    await handleTelegramUpdate({ message: { chat: { id: 6000 }, text: nct.set, from: { first_name: 'NaturalUser' } } }, mdb, 'token');
    await handleTelegramUpdate({ message: { chat: { id: 6000 }, text: nct.catat, from: { first_name: 'NaturalUser' } } }, mdb, 'token');
  }

  replies = [];
  await handleTelegramUpdate({ message: { chat: { id: 6000 }, text: '/budget', from: { first_name: 'NaturalUser' } } }, mdb, 'token');
  const naturalBudgetListReply = replies[0]?.text || '';
  for (const nct of naturalCatTests) {
    assert(naturalBudgetListReply.includes(nct.expectedLabel), `Budget list contains natural ${nct.name} (${nct.expectedLabel})`);
    assert(naturalBudgetListReply.includes(nct.expectedSpent), `Budget list for natural ${nct.name} updated with spent ${nct.expectedSpent}`);
  }

  // Also test /pencapaian bot command (Point 18)
  replies = [];
  await handleTelegramUpdate({ message: { chat: { id: 5000 }, text: '/pencapaian', from: { first_name: 'NudgeUser' } } }, mdb, 'token');
  assert(replies.some(r => (r.text || '').includes('Pencapaian')), '/pencapaian returns achievement gallery');

  // Test DEFAULT_BOT_COMMANDS includes budget, ajak, streak (tantangan removed)
  assert(DEFAULT_BOT_COMMANDS.some(c => c.command === 'budget'), 'budget in bot commands');
  assert(DEFAULT_BOT_COMMANDS.some(c => c.command === 'ajak'), 'ajak in bot commands');
  assert(!DEFAULT_BOT_COMMANDS.some(c => c.command === 'tantangan'), 'tantangan removed from bot commands');
  assert(DEFAULT_BOT_COMMANDS.some(c => c.command === 'streak'), 'streak in bot commands');


  // --- Fase 3: Referral system ---
  invalidateUidCache();
  nudgeStore.users['tg_7000'] = { name: 'RefA', isTelegramUser: true };
  nudgeStore.telegram_links['7000'] = { uid: 'tg_7000' };

  // /ajak command
  replies = [];
  await handleTelegramUpdate({ message: { chat: { id: 7000 }, text: '/ajak', from: { first_name: 'RefA' } } }, mdb, 'token');
  assert(replies.some(r => (r.text || '').includes('ref_7000')), '/ajak shows referral link');

  // New user via /start ref_7000
  invalidateUidCache();
  replies = [];
  await handleTelegramUpdate({ message: { chat: { id: 8000 }, text: '/start ref_7000', from: { first_name: 'NewUser' } } }, mdb, 'token');
  assert(replies.some(r => (r.text || '').includes('diajak teman')), 'Referral greeting mentions friend');
  assert.strictEqual(nudgeStore.users['tg_8000']?.referredBy, '7000', 'referredBy set');
  assert(replies.some(r => (r.text || '').includes('Yeay')), 'Referrer notified');
  assert.strictEqual(nudgeStore.users['tg_7000']?.referralCount, 1, 'referralCount=1');

  // Duplicate referral — no double count
  invalidateUidCache();
  replies = [];
  await handleTelegramUpdate({ message: { chat: { id: 8000 }, text: '/start ref_7000', from: { first_name: 'NewUser' } } }, mdb, 'token');
  assert.strictEqual(nudgeStore.users['tg_7000']?.referralCount, 1, 'No double referralCount');

  // Self-referral — ignored
  invalidateUidCache();
  replies = [];
  await handleTelegramUpdate({ message: { chat: { id: 7000 }, text: '/start ref_7000', from: { first_name: 'RefA' } } }, mdb, 'token');
  assert(replies.some(r => (r.text || '').includes('Pocky')), 'Self-ref gets greeting');

  // /start ref_ngawur → normal greeting
  invalidateUidCache();
  replies = [];
  await handleTelegramUpdate({ message: { chat: { id: 9000 }, text: '/start ref_ngawur', from: { first_name: 'Stranger' } } }, mdb, 'token');
  assert(replies.some(r => (r.text || '').includes('Pocky')), 'Invalid ref_ gets greeting');

  // --- Fase 5: Streak system ---
  const { updateStreak } = await import('./streak.js');
  nudgeStore.users['tg_streak1'] = { name: 'StreakUser' };
  nudgeStore.users['tg_streak1']._sub = { transactions: {} };
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
  // Generate 7 consecutive dates ending at today (WIB). Use date arithmetic in WIB.
  for (let i = 0; i < 7; i++) {
    // Compute WIB date i days ago
    const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
    d.setDate(d.getDate() - i);
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    nudgeStore.users['tg_streak1']._sub.transactions[`tx${i}`] = { date: ds, type: 'Income', amount: 1000 };
  }
  const sr1 = await updateStreak('tg_streak1', mdb);
  assert.strictEqual(sr1.currentStreak, 7, 'Streak=7 for 7 days');
  assert.strictEqual(sr1.milestone, 7, 'Milestone 7');

  const sr2 = await updateStreak('tg_streak1', mdb);
  assert.strictEqual(sr2.milestone, null, 'Milestone 7 not repeated');

  // Dup tx same day
  nudgeStore.users['tg_streak1']._sub.transactions['txdup'] = { date: today, type: 'Expense', amount: 500 };
  const sr3 = await updateStreak('tg_streak1', mdb);
  assert.strictEqual(sr3.currentStreak, 7, 'Dup tx same day still 7');

  // Gap detection
  const threeDaysAgo = (() => {
    const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
    d.setDate(d.getDate() - 3);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  nudgeStore.users['tg_streak2'] = { name: 'S2', currentStreak: 5, lastStreakDate: threeDaysAgo };
  nudgeStore.users['tg_streak2']._sub = { transactions: {} };
  nudgeStore.users['tg_streak2']._sub.transactions['tx0'] = { date: today, type: 'Income', amount: 1000 };
  const sr4 = await updateStreak('tg_streak2', mdb);
  assert.strictEqual(sr4.currentStreak, 1, 'Gap: streak=1');
  assert.strictEqual(sr4.broken, true, 'Gap: broken=true');

  // Morning reminder streak — generateMorningReminder already imported above
  const ms1 = generateMorningReminder('Budi', 500000, [], 12);
  assert(ms1.includes('Streak'), 'Morning includes streak');
  assert(ms1.includes('12'), 'Morning includes 12');
  const ms2 = generateMorningReminder('Budi', 500000, [], 1);
  assert(!ms2.includes('Streak'), 'No streak if <2');

  // --- Verify challenge system removed & /help updated ---
  invalidateUidCache();
  replies = [];
  await handleTelegramUpdate({ message: { chat: { id: 5000 }, text: '/tantangan', from: { first_name: 'NudgeUser' } } }, mdb, 'token');
  assert(replies.some(r => (r.text || '').includes('Perintah tidak dikenali')), '/tantangan returns unrecognized command');

  // Test /help does not contain tantangan, contains referral
  replies = [];
  await handleTelegramUpdate({ message: { chat: { id: 5000 }, text: '/help', from: { first_name: 'NudgeUser' } } }, mdb, 'token');
  const helpText = replies[0]?.text || '';
  assert(!helpText.includes('TANTANGAN DISIPLIN'), '/help does not contain tantangan disiplin');
  assert(helpText.includes('/ajak'), '/help contains referral /ajak explanation');

  // Test /budget custom label: /budget beli laptop 10jt -> /budget beli hp 10jt -> separate budgets
  invalidateUidCache();
  replies = [];
  await handleTelegramUpdate({ message: { chat: { id: 9000 }, text: '/masuk bonus 20jt', from: { first_name: 'LaptopUser' } } }, mdb, 'token');
  assert(replies.some(r => (r.text || '').includes('Pemasukan Dicatat')), 'Income 20jt recorded for LaptopUser');

  replies = [];
  await handleTelegramUpdate({ message: { chat: { id: 9000 }, text: '/budget beli laptop 10jt', from: { first_name: 'LaptopUser' } } }, mdb, 'token');
  assert(replies.some(r => (r.text || '').includes('Budget') && (r.text || '').includes('beli laptop') && (r.text || '').includes('diatur')), '/budget creates custom label budget');

  // Create second separate budget
  replies = [];
  await handleTelegramUpdate({ message: { chat: { id: 9000 }, text: '/budget beli hp 10jt', from: { first_name: 'LaptopUser' } } }, mdb, 'token');
  assert(replies.some(r => (r.text || '').includes('beli hp') && (r.text || '').includes('diatur')), '/budget beli hp is separate');

  // Expense matching by keyword
  replies = [];
  await handleTelegramUpdate({ message: { chat: { id: 9000 }, text: '/catat beli laptop asus 9,5jt', from: { first_name: 'LaptopUser' } } }, mdb, 'token');
  assert(replies.some(r => (r.text || '').includes('Masuk budget *beli laptop*') && (r.text || '').includes('95%')), 'Expense matches custom budget by keyword');
  assert(replies.some(r => (r.text || '').includes('hampir habis') && (r.text || '').includes('⚠️')), '9.5jt on 10jt budget triggers warning 80%');

  // Second expense exceeds 100%
  replies = [];
  await handleTelegramUpdate({ message: { chat: { id: 9000 }, text: '/catat aksesoris laptop 1jt', from: { first_name: 'LaptopUser' } } }, mdb, 'token');
  assert(replies.some(r => (r.text || '').includes('habis') && (r.text || '').includes('🚨')), 'Over limit triggers warning 100%');

  // Budget list shows both separate budgets and period
  replies = [];
  await handleTelegramUpdate({ message: { chat: { id: 9000 }, text: '/budget', from: { first_name: 'LaptopUser' } } }, mdb, 'token');
  assert(replies.some(r => (r.text || '').includes('beli laptop') && (r.text || '').includes('beli hp')), '/budget list shows both custom budgets separately');
  assert(replies.some(r => (r.text || '').includes('Berlaku:')), '/budget list shows validity period');
  const listButtons = replies[0]?.reply_markup?.inline_keyboard || [];
  assert(listButtons.some(row => row.some(b => b.text.includes('Hapus Budget'))), '/budget list includes [Hapus Budget] button per budget');

  // Find beli laptop budget ID
  const laptopBudgetEntry = Object.entries(nudgeStore.users['tg_9000']._sub.budgets).find(([, b]) => b.customLabel === 'beli laptop');
  assert(laptopBudgetEntry, 'beli laptop budget exists in store');
  const laptopBudgetId = laptopBudgetEntry[0];

  // Test BAGIAN A: Budget detail (bdg:detail)
  replies = [];
  await handleTelegramUpdate({ callback_query: { id: 'bdg_det', data: `bdg:detail:${laptopBudgetId}`, message: { chat: { id: 9000 }, message_id: 200 }, from: { first_name: 'LaptopUser' } } }, mdb, 'token');
  const detailMsg = replies.find(r => r.chat_id);
  const detailText = detailMsg?.text || '';
  assert(detailText.includes('BUDGET: beli laptop'), 'detail shows header with budget label');
  assert(detailText.includes('Budget khusus untuk beli laptop.'), 'detail shows keterangan');
  assert(detailText.includes('Dibuat:'), 'detail shows creation date');
  assert(detailText.includes('Berlaku:'), 'detail shows validity period');
  assert(detailText.includes('Terpakai:'), 'detail shows spent vs limit');
  assert(detailText.includes('Sisa:'), 'detail shows remaining balance');
  assert(detailText.includes('Keyword:'), 'detail shows keywords');
  const detailButtons = detailMsg?.reply_markup?.inline_keyboard || [];
  assert(detailButtons.some(row => row.some(b => b.text.includes('Ubah Limit'))), 'detail has [Ubah Limit] button');
  assert(detailButtons.some(row => row.some(b => b.text.includes('Hapus Budget'))), 'detail has [Hapus Budget] button');
  assert(detailButtons.some(row => row.some(b => b.text.includes('Kembali'))), 'detail has [Kembali] button');

  // Test BAGIAN B: Confirmation on delete prompt (bdg:hapus_prompt)
  replies = [];
  await handleTelegramUpdate({ callback_query: { id: 'bdg_del_prompt', data: `bdg:hapus_prompt:${laptopBudgetId}`, message: { chat: { id: 9000 }, message_id: 200 }, from: { first_name: 'LaptopUser' } } }, mdb, 'token');
  const confirmMsg = replies.find(r => r.chat_id);
  const confirmPromptText = confirmMsg?.text || '';
  assert(confirmPromptText.includes('Konfirmasi Hapus Budget'), 'shows confirmation title');
  assert(confirmPromptText.includes("Yakin hapus budget *'beli laptop'*?"), 'shows confirmation message with budget name');
  assert(confirmPromptText.includes('Transaksi yang sudah tercatat TIDAK ikut terhapus.'), 'reassures transactions are kept');
  const confirmButtons = confirmMsg?.reply_markup?.inline_keyboard || [];
  assert(confirmButtons.some(row => row.some(b => b.text.includes('Ya, hapus'))), 'has [Ya, hapus] button');
  assert(confirmButtons.some(row => row.some(b => b.text.includes('Batal'))), 'has [Batal] button');

  // Test BAGIAN B: Confirmed delete (bdg:hapus_confirm)
  replies = [];
  await handleTelegramUpdate({ callback_query: { id: 'bdg_del_confirm', data: `bdg:hapus_confirm:${laptopBudgetId}`, message: { chat: { id: 9000 }, message_id: 200 }, from: { first_name: 'LaptopUser' } } }, mdb, 'token');
  const afterDeleteMsg = replies.find(r => r.chat_id);
  const afterDeleteText = afterDeleteMsg?.text || '';
  assert(afterDeleteText.includes('Budget *beli laptop* berhasil dihapus.'), 'shows deletion confirmation note');
  assert(!nudgeStore.users['tg_9000']._sub.budgets[laptopBudgetId], 'budget document was deleted from store');

  // Test BAGIAN C: Transaction backdate filter (only transactions >= createdAt are counted)
  invalidateUidCache();
  nudgeStore.users['tg_9100'] = { name: 'DateUser', isTelegramUser: true };
  nudgeStore.telegram_links['9100'] = { uid: 'tg_9100' };
  replies = [];
  // Budget created with createdAt: 2026-10-17
  const bRef = await mdb.collection('users').doc('tg_9100').collection('budgets').add({
    customLabel: 'beli monitor',
    keywords: ['monitor'],
    monthlyLimit: 5000000,
    amount: 5000000,
    category: 'Shopping',
    createdAt: '2026-10-17T08:00:00.000Z'
  });
  // Backdated transaction: 2026-10-16 (yesterday) -> should NOT be counted
  await mdb.collection('users').doc('tg_9100').collection('transactions').add({
    type: 'Expense',
    amount: 2000000,
    category: 'Shopping',
    description: 'beli monitor kemarin',
    date: '2026-10-16'
  });
  // Current transaction: 2026-10-17 (today) -> SHOULD be counted
  await mdb.collection('users').doc('tg_9100').collection('transactions').add({
    type: 'Expense',
    amount: 1500000,
    category: 'Shopping',
    description: 'beli monitor hari ini',
    date: '2026-10-17'
  });

  // Check detail of this budget: spent must be 1.500.000 (30%), NOT 3.500.000 (70%)
  replies = [];
  await handleTelegramUpdate({ callback_query: { id: 'bdg_date_test', data: `bdg:detail:${bRef.id}`, message: { chat: { id: 9100 }, message_id: 200 }, from: { first_name: 'DateUser' } } }, mdb, 'token');
  const dateDetailMsg = replies.find(r => r.chat_id);
  const dateDetailText = dateDetailMsg?.text || '';
  assert(dateDetailText.includes('1.500.000 / Rp'), 'only today expense is counted in Terpakai (1.5jt)');
  assert(!dateDetailText.includes('3.500.000 / Rp'), 'yesterday backdated expense (2jt) is not in Terpakai');
  assert(dateDetailText.includes('30%'), 'spent percentage is 30% not 70%');

  // Budget inline callbacks
  replies = [];
  await handleTelegramUpdate({ callback_query: { id: 'bdg1', data: 'bdg:buat', message: { chat: { id: 9000 }, message_id: 200 }, from: { first_name: 'LaptopUser' } } }, mdb, 'token');
  assert(replies.some(r => (r.text || '').includes('Buat Budget Baru')), 'bdg:buat shows create prompt');

  // Cancel pending budget so it doesn't interfere with search test
  replies = [];
  await handleTelegramUpdate({ callback_query: { id: 'bdg2', data: 'bdg:list', message: { chat: { id: 9000 }, message_id: 200 }, from: { first_name: 'LaptopUser' } } }, mdb, 'token');

  // Riwayat search test — mock orderBy returns empty, check 'Belum ada' or search button
  replies = [];
  await handleTelegramUpdate({ message: { chat: { id: 9000 }, text: '/riwayat', from: { first_name: 'LaptopUser' } } }, mdb, 'token');
  // Mock orderBy always returns empty; still confirm command handled
  assert(replies.some(r => (r.text || '').includes('Belum ada') || r.reply_markup?.inline_keyboard), '/riwayat responds');

  // cr:cari callback
  replies = [];
  await handleTelegramUpdate({ callback_query: { id: 'cr1', data: 'cr:cari', message: { chat: { id: 9000 }, message_id: 201 }, from: { first_name: 'LaptopUser' } } }, mdb, 'token');
  assert(replies.some(r => (r.text || '').includes('Cari Transaksi')), 'cr:cari prompts for search keyword');

  // Search with keyword (uses .get() not orderBy, so it works)
  replies = [];
  await handleTelegramUpdate({ message: { chat: { id: 9000 }, text: 'laptop', from: { first_name: 'LaptopUser' } } }, mdb, 'token');
  assert(replies.some(r => (r.text || '').includes('Hasil pencarian') && (r.text || '').includes('laptop')), 'Search finds laptop transactions');

  // Search with no results
  replies = [];
  await handleTelegramUpdate({ callback_query: { id: 'cr2', data: 'cr:cari', message: { chat: { id: 9000 }, message_id: 202 }, from: { first_name: 'LaptopUser' } } }, mdb, 'token');
  replies = [];
  await handleTelegramUpdate({ message: { chat: { id: 9000 }, text: 'xyznonexistent', from: { first_name: 'LaptopUser' } } }, mdb, 'token');
  assert(replies.some(r => (r.text || '').includes('Tidak ketemu')), 'Search with no results shows message');

  // Test ephemeral messages (queueTempMessage & cleanExpiredTempMessages)
  await queueTempMessage(mdb, 5000, 9991, -1); // expired 1s ago
  await queueTempMessage(mdb, 5000, 9992, 100); // active
  assert(Object.keys(nudgeStore.temp_messages || {}).length >= 2, 'temp_messages queued');
  const cleanedCount = await cleanExpiredTempMessages(mdb, 'token');
  assert(cleanedCount >= 1, 'expired temp messages cleaned');

  // Test riwayat search auto-deletion and navigation
  replies = [];
  await handleTelegramUpdate({ callback_query: { id: 'cr_clean', data: 'cr:cari', message: { chat: { id: 9000 }, message_id: 301 }, from: { first_name: 'LaptopUser' } } }, mdb, 'token');
  assert(replies.some(r => (r.text || '').includes('Cari Transaksi')), 'cr:cari prompts for search');

  replies = [];
  await handleTelegramUpdate({ message: { chat: { id: 9000 }, text: 'laptop', from: { first_name: 'LaptopUser' } } }, mdb, 'token');
  assert(replies.length > 0, 'Search performed');

  // Trigger cr:kembali to verify cleanup
  replies = [];
  await handleTelegramUpdate({ callback_query: { id: 'cr_back', data: 'cr:kembali', message: { chat: { id: 9000 }, message_id: 302 }, from: { first_name: 'LaptopUser' } } }, mdb, 'token');
  assert(replies.some(r => (r.text || '').includes('Transaksi Terakhir') || (r.text || '').includes('Belum ada')), 'cr:kembali returns to riwayat');

  // /start random_code → invalid code greeting
  invalidateUidCache();
  replies = [];
  await handleTelegramUpdate({ message: { chat: { id: 8000 }, text: '/start invalidcode', from: { first_name: 'NewUser' } } }, mdb, 'token');
  assert(replies.length > 0, 'Invalid start payload handled');
  // --- Dev teststreak ---

  // /teststreak command handling (dev gate test)
  process.env.DEV_TELEGRAM_IDS = '88888888';

  // Unauthorized user calling /teststreak -> ignored silently
  replies = [];
  await handleTelegramUpdate({ message: { chat: { id: 999999999 }, text: '/teststreak 7', from: { first_name: 'RegularUser' } } }, mdb, 'token');
  assert.strictEqual(replies.length, 0, 'Unauthorized /teststreak ignored silently');

  // Authorized dev user calling /teststreak -> works
  replies = [];
  await handleTelegramUpdate({ message: { chat: { id: 88888888 }, text: '/teststreak 7', from: { first_name: 'Dev' } } }, mdb, 'token');
  assert(replies.some(r => (r.text || '').includes('Streak Milestone')), '/teststreak sends milestone notification');

  // /streak command handling
  replies = [];
  await handleTelegramUpdate({ message: { chat: { id: 88888888 }, text: '/streak', from: { first_name: 'Dev' } } }, mdb, 'token');
  assert(replies.some(r => (r.text || '').includes('Streak Keuangan Kamu')), '/streak returns user streak info');




  console.log('All Telegram integration tests passed!');
}

testBot();
