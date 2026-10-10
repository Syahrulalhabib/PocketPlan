import assert from 'assert';
import { parseReceiptText } from '../src/utils/parseReceipt.js';

// Test 1: typical Indonesian receipt
const receipt1 = `
INDOMARET
JL. MERDEKA NO 10
12/05/2026

INDOMIE GORENG     3.500
AQUA 600ML         3.000
TEH PUCUK          4.500

SUBTOTAL          11.000
PPN               1.100
TOTAL            12.100
TUNAI            15.000
KEMBALIAN         2.900
`;

const r1 = parseReceiptText(receipt1);
assert.strictEqual(r1.amount, 12100, 'Should extract TOTAL amount');
assert.strictEqual(r1.date, '2026-05-12', 'Should parse DD/MM/YYYY');
assert.strictEqual(r1.category, 'Food', 'Receipt with food items = Food');
assert.strictEqual(r1.type, 'Expense');

// Test 2: Rp prefix
const receipt2 = `WARUNG BAKSO PAK MIN
Rp 25.000
01-03-2025`;
const r2 = parseReceiptText(receipt2);
assert.strictEqual(r2.amount, 25000);
assert.strictEqual(r2.date, '2025-03-01');
assert.strictEqual(r2.category, 'Food');

// Test 3: no date
const r3 = parseReceiptText('Beli kopi Rp 18.000');
assert.strictEqual(r3.amount, 18000);
assert.strictEqual(r3.category, 'Food');
assert.strictEqual(r3.date, new Date().toISOString().slice(0, 10), 'Fallback to today');

// Test 4: no amount
const r4 = parseReceiptText('random text no numbers');
assert.strictEqual(r4.amount, '', 'No amount = empty');

console.log('All parseReceipt tests passed! ✅');
