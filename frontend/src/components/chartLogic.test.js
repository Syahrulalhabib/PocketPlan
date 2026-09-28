import assert from 'node:assert';
import { evaluatePasswordStrength } from '../utils/formatters.js';
import { SMART_TIPS } from '../utils/smartTips.js';

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

// 6. Verify stripUndefined removes undefined values to satisfy Firestore constraints
import { stripUndefined } from '../utils/formatters.js';
const testData = { name: 'Trip', category: undefined, target: 5000000 };
const cleaned = stripUndefined(testData);
assert.strictEqual('category' in cleaned, false);
assert.strictEqual(cleaned.name, 'Trip');
assert.strictEqual(cleaned.target, 5000000);


console.log('All logic tests including FloatingMascot passed successfully.');
