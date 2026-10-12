import assert from 'assert';
import {
  KeyPool,
  normalizeCategory,
  normalizePaymentMethod,
  normalizeReceipt,
  flattenReceiptForCsv,
  CSV_HEADERS,
  scanReceiptWithGemini
} from './geminiReceiptScanner.js';

console.log('Running Gemini Receipt Scanner unit tests...');

// 1. KeyPool tests
const pool = new KeyPool('keyA, keyB, keyC');
assert.strictEqual(pool.keys.length, 3);
assert.strictEqual(pool.getKey(), 'keyA');
assert.strictEqual(pool.getKey(), 'keyB');
assert.strictEqual(pool.getKey(), 'keyC');
assert.strictEqual(pool.getKey(), 'keyA');

// Test cooldown
pool.markCooldown('keyA', 5000);
assert.strictEqual(pool.getKey(), 'keyB');
pool.markCooldown('keyB', 5000);
assert.strictEqual(pool.getKey(), 'keyC');

// 2. Normalization tests
assert.strictEqual(normalizeCategory('makanan enak'), 'Food');
assert.strictEqual(normalizeCategory('Bensin Pertamax'), 'Transport');
assert.strictEqual(normalizeCategory('Supermarket Indomaret'), 'Shopping');
assert.strictEqual(normalizeCategory('unknown cat'), 'Other');

assert.strictEqual(normalizePaymentMethod('qris gopay'), 'QRIS');
assert.strictEqual(normalizePaymentMethod('TUNAI'), 'CASH');
assert.strictEqual(normalizePaymentMethod('Kartu Debit BCA'), 'DEBIT');
assert.strictEqual(normalizePaymentMethod(''), 'UNKNOWN');

const rawReceipt = {
  merchant_name: 'Indomaret Point',
  date: '2026-10-15',
  items: [
    { item_name: 'Roti Bakar', quantity: 2, unit_price: 15000, total_price: 30000 },
    { item_name: 'Kopi Kenangan', quantity: 1, unit_price: 18000, total_price: 18000 }
  ],
  subtotal: 48000,
  tax: 4800,
  total_amount: 52800,
  payment_method: 'QRIS',
  category: 'Food'
};

const norm = normalizeReceipt(rawReceipt);
assert.strictEqual(norm.merchant_name, 'Indomaret Point');
assert.strictEqual(norm.date, '2026-10-15');
assert.strictEqual(norm.total_amount, 52800);
assert.strictEqual(norm.category, 'Food');
assert.strictEqual(norm.items.length, 2);

// 2.5 Transfer proof and doc_type tests
const rawTransferIn = {
  doc_type: 'transfer_in',
  merchant_name: 'Transfer dari Budi Santoso',
  total_amount: 500000,
  payment_method: 'TRANSFER'
};
const normTransferIn = normalizeReceipt(rawTransferIn);
assert.strictEqual(normTransferIn.type, 'Income');
assert.strictEqual(normTransferIn.doc_type, 'transfer_in');
assert.strictEqual(normTransferIn.payment_method, 'TRANSFER');

const rawTransferOut = {
  doc_type: 'transfer_out',
  merchant_name: 'Transfer ke Toko Maju',
  total_amount: 150000,
  payment_method: 'BI-FAST'
};
const normTransferOut = normalizeReceipt(rawTransferOut);
assert.strictEqual(normTransferOut.type, 'Expense');
assert.strictEqual(normTransferOut.doc_type, 'transfer_out');
assert.strictEqual(normTransferOut.payment_method, 'TRANSFER');

// 3. Fallback calculation if total_amount is missing or 0
const rawZeroTotal = {
  merchant: 'Warung Bu Siti',
  items: [
    { item_name: 'Nasi Rames', quantity: 1, unit_price: 20000, total_price: 20000 }
  ],
  tax: 2000,
  total_amount: 0
};
const normZero = normalizeReceipt(rawZeroTotal);
assert.strictEqual(normZero.total_amount, 22000);
assert.strictEqual(normZero.merchant_name, 'Warung Bu Siti');

// 4. Flatten for CSV
const csvRows = flattenReceiptForCsv(norm, 'struk_01.jpg');
assert.strictEqual(csvRows.length, 2);
assert.strictEqual(csvRows[0].file_name, 'struk_01.jpg');
assert.strictEqual(csvRows[0].merchant_name, 'Indomaret Point');
assert.strictEqual(csvRows[0].item_name, 'Roti Bakar');
assert.strictEqual(csvRows[0].quantity, 2);
assert.strictEqual(csvRows[0].unit_price, 15000);
assert.strictEqual(csvRows[0].receipt_total, 52800);
assert.ok(CSV_HEADERS.includes('merchant_name'));
assert.ok(CSV_HEADERS.includes('item_name'));

// Test CSV & JSON file writing
import fs from 'fs';
import path from 'path';
const tmpJson = path.resolve('test_output_receipt.json');
const tmpCsv = path.resolve('test_output_rekap.csv');

try {
  const { appendCsvRows, saveJsonReceipt } = await import('./geminiReceiptScanner.js');
  saveJsonReceipt(tmpJson, norm);
  assert.ok(fs.existsSync(tmpJson));
  const readJson = JSON.parse(fs.readFileSync(tmpJson, 'utf8'));
  assert.strictEqual(readJson.merchant_name, 'Indomaret Point');

  appendCsvRows(tmpCsv, csvRows);
  assert.ok(fs.existsSync(tmpCsv));
  const csvContent = fs.readFileSync(tmpCsv, 'utf8');
  assert.ok(csvContent.includes('Indomaret Point'));
  assert.ok(csvContent.includes('Roti Bakar'));
} finally {
  if (fs.existsSync(tmpJson)) fs.unlinkSync(tmpJson);
  if (fs.existsSync(tmpCsv)) fs.unlinkSync(tmpCsv);
}

// 5. Test mock Gemini call
const testKeyPool = new KeyPool(['mock_key']);
const originalFetch = global.fetch;

global.fetch = async (url) => {
  assert.ok(url.includes('models/gemini-3.5-flash-lite:generateContent'));
  return {
    ok: true,
    json: async () => ({
      candidates: [{
        content: {
          parts: [{
            text: JSON.stringify(rawReceipt)
          }]
        }
      }]
    })
  };
};

const scanRes = await scanReceiptWithGemini({
  imageBase64: 'fakeBase64String',
  mimeType: 'image/jpeg',
  keyPool: testKeyPool
});

assert.strictEqual(scanRes.ok, true);
assert.strictEqual(scanRes.data.merchant_name, 'Indomaret Point');
assert.strictEqual(scanRes.data.total_amount, 52800);

// Restore fetch
global.fetch = originalFetch;

console.log('All Gemini Receipt Scanner unit tests passed! ✅');
