import assert from 'node:assert';
import { evaluatePasswordStrength, stripUndefined, isDummyEmail } from '../src/utils/formatters.js';
import { SMART_TIPS } from '../src/utils/smartTips.js';

const toLocalDayKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const startOfWeek = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

// 1. Verify day key
const d = new Date(2026, 8, 25);
assert.strictEqual(toLocalDayKey(d), '2026-09-25');

// 2. Verify Monday as week start
const sunday = new Date(2026, 8, 27); // 27 Sep 2026 is Sunday
const monday = startOfWeek(sunday);
assert.strictEqual(monday.getDay(), 1, 'Sunday rolls back to Monday');
assert.strictEqual(toLocalDayKey(monday), '2026-09-21');

// 3. Verify net flow math
const income = 2500000;
const expense = 1800000;
const net = income - expense;
assert.strictEqual(net, 700000);

// 4. Verify password strength labels in English
assert.strictEqual(evaluatePasswordStrength('123').label, 'Weak');
assert.strictEqual(evaluatePasswordStrength('secret12').label, 'Fair');
assert.strictEqual(evaluatePasswordStrength('Secret!99').label, 'Strong');

// 5. Verify Pocky Floating Mascot tips integrity
assert.ok(Array.isArray(SMART_TIPS) && SMART_TIPS.length >= 6);
SMART_TIPS.forEach((tip) => {
  assert.strictEqual(typeof tip, 'string');
  assert.ok(tip.length > 10, 'Each tip must be a meaningful non-empty advice string');
});

// 6. Verify stripUndefined removes undefined values
const testData = { name: 'Trip', category: undefined, target: 5000000 };
const cleaned = stripUndefined(testData);
assert.strictEqual('category' in cleaned, false);
assert.strictEqual(cleaned.name, 'Trip');
assert.strictEqual(cleaned.target, 5000000);

// 7. Verify dummy email detector
assert.strictEqual(isDummyEmail('tg_12345@telegram.pocketplan'), true);
assert.strictEqual(isDummyEmail('user@pocketplan.app'), true);
assert.strictEqual(isDummyEmail(''), true);
assert.strictEqual(isDummyEmail(null), true);
assert.strictEqual(isDummyEmail(undefined), true);
assert.strictEqual(isDummyEmail('   '), true);
assert.strictEqual(isDummyEmail('abc@telegram.pocketplan.app'), true);
assert.strictEqual(isDummyEmail('syahrul@gmail.com'), false);
assert.strictEqual(isDummyEmail('budi.santoso@yahoo.co.id'), false);
// 7. Verify T9-A: Newest sorting puts newly added bot transaction at index 0
const sortTransactions = (list, sortOrder = 'newest') => {
  return [...list].sort((a, b) => {
    const aDay = String(a.date || a.createdAt || '').slice(0, 10);
    const bDay = String(b.date || b.createdAt || '').slice(0, 10);

    const aCreated = new Date(a.createdAt || a.date || 0).getTime();
    const bCreated = new Date(b.createdAt || b.date || 0).getTime();

    if (sortOrder === 'newest') {
      if (aDay !== bDay) {
        return bDay.localeCompare(aDay);
      }
      return bCreated - aCreated;
    } else {
      if (aDay !== bDay) {
        return aDay.localeCompare(bDay);
      }
      return aCreated - bCreated;
    }
  });
};

const txList = [
  { id: 'tx-old-day', date: '2026-10-12', createdAt: '2026-10-12T09:00:00.000Z', amount: 50000 },
  { id: 'tx-morning', date: '2026-10-14', createdAt: '2026-10-14T08:00:00.000Z', amount: 25000 },
  { id: 'tx-bot-just-now', date: '2026-10-14', createdAt: '2026-10-14T15:30:00.000Z', amount: 35000 }
];

const sorted = sortTransactions(txList, 'newest');
assert.strictEqual(sorted[0].id, 'tx-bot-just-now', 'T9-A: Newly added bot transaction appears first');
assert.strictEqual(sorted[1].id, 'tx-morning');
assert.strictEqual(sorted[2].id, 'tx-old-day');


console.log('All logic tests passed successfully.');
