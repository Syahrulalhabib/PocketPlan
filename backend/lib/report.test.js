import assert from 'assert';
import { getPrevMonth, getDaysInMonth, buildMonthlyReport, getTxMonth } from './reportHelper.js';

console.log('Running Monthly Report unit tests...');

// 1. Date math helpers
assert.strictEqual(getPrevMonth('2026-10'), '2026-09');
assert.strictEqual(getPrevMonth('2026-01'), '2025-12');
assert.strictEqual(getDaysInMonth('2026-10'), 31);
assert.strictEqual(getDaysInMonth('2026-02'), 28);
console.log('  ✔ Date math helpers passed');

// 2. Empty data fallback
const emptyRep = buildMonthlyReport({ month: '2026-10', transactions: [] });
assert.strictEqual(emptyRep.summary.totalPemasukan, 0);
assert.strictEqual(emptyRep.summary.totalPengeluaran, 0);
assert.strictEqual(emptyRep.summary.rasioMenabung, 0);
assert.strictEqual(emptyRep.summary.jumlahTransaksi, 0);
assert.ok(emptyRep.insight.length > 0);
assert.ok(Array.isArray(emptyRep.byCategory));
assert.ok(Array.isArray(emptyRep.weeklyTrend));
console.log('  ✔ Empty data fallback passed');

// 3. Calculation with real transactions
const sampleTx = [
  { type: 'Income', amount: 8500000, date: '2026-10-01', category: 'Gaji' },
  { type: 'Expense', amount: 1850000, date: '2026-10-05', category: 'Makanan', description: 'Makan' },
  { type: 'Expense', amount: 1250000, date: '2026-10-12', category: 'Transport', description: 'Bensin & Service' },
  { type: 'Expense', amount: 940000, date: '2026-10-18', category: 'Belanja', description: 'Supermarket' },
  // Previous month expense
  { type: 'Expense', amount: 1520000, date: '2026-09-10', category: 'Makanan' },
  { type: 'Expense', amount: 1310000, date: '2026-09-20', category: 'Transport' }
];

const goals = [
  { name: 'Motor', amount: 7500000, target: 15000000 },
  { name: 'Liburan', amount: 6000000, target: 6000000 },
  { name: 'Rumah', target: 10000000 } // T8 verification: goal funded by balance
];

const budgets = [
  { category: 'Makanan', amount: 2000000 },
  { category: 'Transport', amount: 1000000 }
];

const rep = buildMonthlyReport({
  month: '2026-10',
  transactions: sampleTx,
  goals,
  budgets,
  userDocData: { currentStreak: 7 }
});

assert.strictEqual(rep.summary.totalPemasukan, 8500000);
assert.strictEqual(rep.summary.totalPengeluaran, 4040000);
assert.strictEqual(rep.summary.surplus, 4460000);
assert.strictEqual(rep.summary.rasioMenabung, 52);
assert.strictEqual(rep.summary.jumlahTransaksi, 4);
assert.strictEqual(rep.byCategory.length, 3);
assert.strictEqual(rep.byCategory[0].nama, 'Makanan');
assert.strictEqual(rep.streak, 7);
assert.strictEqual(rep.budgets.total, 2);
assert.strictEqual(rep.budgets.terjaga, 1); // Makanan is 1.85m <= 2m (terjaga); Transport is 1.25m > 1m (not terjaga)
assert.strictEqual(rep.goals.find(g => g.nama === 'Liburan').persen, 100);
const rumahGoal = rep.goals.find(g => g.nama === 'Rumah');
assert.ok(rumahGoal, 'T8: Savings goal present in report');
assert.strictEqual(rumahGoal.terkumpul, 1630000, 'T8: Savings goal amount equals balance');
assert.strictEqual(rumahGoal.persen, 16, 'T8: Savings goal percent matches Goals page formula');

// T8 & T9-B: getTxMonth date formats
assert.strictEqual(getTxMonth({ date: '2026-10-14' }), '2026-10');
assert.strictEqual(getTxMonth({ date: '14/10/2026' }), '2026-10');
assert.strictEqual(getTxMonth({ createdAt: '2026-10-14T08:30:00.000Z' }), '2026-10');

console.log('  ✔ Calculations & comparison passed');

console.log('All Monthly Report unit tests passed! ✅');
