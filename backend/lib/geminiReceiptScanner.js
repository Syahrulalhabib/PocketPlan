import fs from 'fs';
import path from 'path';

export const POCKETPLAN_CATEGORIES = [
  'Food',
  'Shopping',
  'Transport',
  'Bills',
  'Health',
  'Education',
  'Entertainment',
  'Charity',
  'Salary',
  'Other'
];

export class KeyPool {
  constructor(keys = []) {
    if (typeof keys === 'string') {
      keys = keys.split(',').map(k => k.trim()).filter(Boolean);
    }
    this.keys = Array.isArray(keys) ? keys : [];
    this.currentIndex = 0;
    this.cooldowns = new Map();
  }

  static fromEnv() {
    const raw = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
    const keys = raw.split(',').map(k => k.trim()).filter(Boolean);
    return new KeyPool(keys);
  }

  hasKeys() {
    return this.keys.length > 0;
  }

  markCooldown(key, durationMs = 60000) {
    this.cooldowns.set(key, Date.now() + durationMs);
  }

  getKey() {
    if (this.keys.length === 0) {
      const fromEnv = KeyPool.fromEnv();
      if (fromEnv.keys.length > 0) {
        this.keys = fromEnv.keys;
      } else {
        throw new Error('GEMINI_API_KEY atau GEMINI_API_KEYS belum dikonfigurasi di file environment.');
      }
    }

    const now = Date.now();
    for (let i = 0; i < this.keys.length; i++) {
      const idx = (this.currentIndex + i) % this.keys.length;
      const key = this.keys[idx];
      const expiry = this.cooldowns.get(key) || 0;
      if (expiry <= now) {
        this.currentIndex = (idx + 1) % this.keys.length;
        return key;
      }
    }

    let soonestKey = this.keys[0];
    let soonestExpiry = this.cooldowns.get(soonestKey) || 0;
    for (const key of this.keys) {
      const exp = this.cooldowns.get(key) || 0;
      if (exp < soonestExpiry) {
        soonestExpiry = exp;
        soonestKey = key;
      }
    }
    return soonestKey;
  }
}

export const defaultKeyPool = KeyPool.fromEnv();

export function normalizeCategory(categoryStr) {
  if (!categoryStr) return 'Other';
  const clean = String(categoryStr).trim().toLowerCase();
  for (const cat of POCKETPLAN_CATEGORIES) {
    if (cat.toLowerCase() === clean) return cat;
  }
  if (/makan|resto|food|cafe|kopi|coffee|warung|kuliner/i.test(clean)) return 'Food';
  if (/belanja|mart|supermarket|mall|toko|shop/i.test(clean)) return 'Shopping';
  if (/bensin|spbu|parkir|toll|transport|ojek|grab|gojek/i.test(clean)) return 'Transport';
  if (/listrik|pln|pdam|wifi|pulsa|paket|tagihan|bill/i.test(clean)) return 'Bills';
  if (/obat|apotek|dokter|klinik|health|sehat/i.test(clean)) return 'Health';
  if (/buku|kursus|kuliah|sekolah|edu/i.test(clean)) return 'Education';
  if (/bioskop|cinema|game|hiburan|wisata/i.test(clean)) return 'Entertainment';
  if (/infaq|sedekah|donasi|charity|amal/i.test(clean)) return 'Charity';
  return 'Other';
}

export function normalizePaymentMethod(methodStr) {
  if (!methodStr) return 'UNKNOWN';
  const clean = String(methodStr).toUpperCase().trim();
  if (clean.includes('QRIS')) return 'QRIS';
  if (clean.includes('TUNAI') || clean.includes('CASH')) return 'CASH';
  if (clean.includes('DEBIT')) return 'DEBIT';
  if (clean.includes('CREDIT') || clean.includes('KREDIT')) return 'CREDIT';
  if (clean.includes('TRANSFER') || clean.includes('TF') || clean.includes('BANK') || clean.includes('BI-FAST')) return 'TRANSFER';
  if (['CASH', 'QRIS', 'DEBIT', 'CREDIT', 'TRANSFER'].includes(clean)) return clean;
  return 'UNKNOWN';
}

export function normalizeReceipt(raw = {}) {
  let doc_type = String(raw.doc_type || '').toLowerCase().trim();
  if (!['receipt', 'transfer_out', 'transfer_in', 'bill', 'other'].includes(doc_type)) {
    if (/transfer.*masuk|dana.*masuk|uang.*masuk|received|incoming|topup.*masuk/i.test(doc_type)) {
      doc_type = 'transfer_in';
    } else if (/transfer|tf|qris|kirim.*uang|send.*money/i.test(doc_type)) {
      doc_type = 'transfer_out';
    } else if (/tagihan|bill|pln|pdam|indihome|bpjs|listrik/i.test(doc_type)) {
      doc_type = 'bill';
    } else {
      doc_type = 'receipt';
    }
  }

  // Deteksi tipe transaksi: Income atau Expense
  let type = String(raw.type || '').trim();
  if (type.toLowerCase() === 'income' || doc_type === 'transfer_in') {
    type = 'Income';
  } else {
    type = 'Expense';
  }

  let merchant_name = String(raw.merchant_name || raw.merchant || raw.store_name || '').trim();
  if (!merchant_name) {
    if (doc_type === 'transfer_in') merchant_name = 'Transfer Masuk';
    else if (doc_type === 'transfer_out') merchant_name = 'Transfer Keluar';
    else if (doc_type === 'bill') merchant_name = 'Pembayaran Tagihan';
    else merchant_name = 'Struk Belanja';
  }

  let date = raw.date || null;
  if (typeof date === 'string') {
    const match = date.match(/\d{4}-\d{2}-\d{2}/);
    date = match ? match[0] : null;
  }
  if (!date) {
    date = new Date().toISOString().slice(0, 10);
  }

  const items = Array.isArray(raw.items) ? raw.items.map(it => {
    const name = String(it.item_name || it.name || it.description || 'Item').trim();
    const qty = Number(it.quantity || it.qty || 1) || 1;
    const unitPrice = Number(it.unit_price || it.price || 0) || 0;
    const totalPrice = Number(it.total_price || (qty * unitPrice) || 0);
    return {
      item_name: name,
      quantity: qty,
      unit_price: unitPrice,
      total_price: totalPrice
    };
  }) : [];

  const subtotal = Number(raw.subtotal || 0) || 0;
  const tax = Number(raw.tax || raw.ppn || raw.service || 0) || 0;
  let total_amount = Number(raw.total_amount || raw.total || 0) || 0;

  if (total_amount === 0 && items.length > 0) {
    total_amount = items.reduce((acc, it) => acc + it.total_price, 0) + tax;
  }
  if (total_amount === 0 && subtotal > 0) {
    total_amount = subtotal + tax;
  }

  const payment_method = normalizePaymentMethod(raw.payment_method);
  let category = normalizeCategory(raw.category);
  if (type === 'Income' && category === 'Other') {
    if (/gaji|salary|payroll|upah|honor/i.test(merchant_name)) {
      category = 'Salary';
    }
  }

  return {
    doc_type,
    type,
    merchant_name,
    date,
    items,
    subtotal,
    tax,
    total_amount,
    payment_method,
    category
  };
}

export async function scanReceiptWithGemini({
  imageBase64,
  mimeType = 'image/jpeg',
  keyPool = defaultKeyPool,
  maxRetries = 3,
  preferredModel = 'gemini-3.5-flash'
}) {
  if (!imageBase64) throw new Error('Data gambar (base64) wajib disediakan.');

  const promptText = `Anda adalah Pocky, asisten cerdas pembaca dokumen finansial: struk kasir, invoice tagihan, dan bukti transfer perbankan/e-wallet (BCA, Mandiri, BRI, BNI, QRIS, GoPay, OVO, Dana, ShopeePay, dll).
Analisis gambar ini secara teliti:
1. Tentukan jenis dokumen (doc_type):
   - "receipt": struk fisik/nota belanja kasir (minimarket, toko, resto, cafe, SPBU).
   - "transfer_out": bukti transfer keluar / bayar QRIS / kirim uang lewat m-banking atau e-wallet.
   - "transfer_in": bukti transfer masuk / terima dana / top up saldo masuk.
   - "bill": bukti bayar atau tagihan listrik PLN, air PDAM, WiFi internet, BPJS, pulsa.
   - "other": dokumen transaksi lainnya.
2. Tentukan tipe arus uang (type):
   - "Expense" jika uang keluar (struk belanja, transfer keluar, bayar QRIS, tagihan).
   - "Income" jika uang masuk (transfer masuk, terima uang, transfer dana dari orang/perusahaan).
3. Ekstrak data:
   - merchant_name: nama toko/merchant (jika struk), nama tujuan/penerima (jika transfer keluar), nama pengirim/sumber (jika transfer masuk), atau penyedia layanan (jika tagihan).
   - date: format YYYY-MM-DD.
   - items: rincian barang/transaksi jika ada.
   - subtotal, tax, total_amount: angka nominal dalam Rupiah murni (angka saja).
   - payment_method: CASH | QRIS | DEBIT | CREDIT | TRANSFER | UNKNOWN.
   - category: Food | Shopping | Transport | Bills | Health | Education | Entertainment | Charity | Salary | Other.

Ekstrak seluruh informasi ke format JSON valid berikut:
{
  "doc_type": "receipt | transfer_out | transfer_in | bill | other",
  "type": "Expense | Income",
  "merchant_name": "Nama toko / penerima / pengirim / penyedia",
  "date": "YYYY-MM-DD",
  "items": [
    {
      "item_name": "Nama item",
      "quantity": 1,
      "unit_price": 10000,
      "total_price": 10000
    }
  ],
  "subtotal": 10000,
  "tax": 0,
  "total_amount": 10000,
  "payment_method": "CASH | QRIS | DEBIT | CREDIT | TRANSFER | UNKNOWN",
  "category": "Food | Shopping | Transport | Bills | Health | Education | Entertainment | Charity | Salary | Other"
}
Hanya balas dengan JSON murni tanpa markdown fences.`;

  const fallbackList = [
    preferredModel,
    'gemini-3.5-flash',
    'gemini-3.1-flash-lite',
    'gemini-3-flash-preview',
    'gemini-3.6-flash',
    'gemini-flash-latest',
    'gemini-3.5-flash-lite'
  ];
  const modelsToTry = [...new Set(fallbackList)];
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries && attempt < modelsToTry.length; attempt++) {
    const apiKey = keyPool.getKey();
    const model = modelsToTry[attempt];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const payload = {
      contents: [{
        role: 'user',
        parts: [
          { text: promptText },
          { inlineData: { mimeType, data: imageBase64 } }
        ]
      }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json'
      }
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      }).finally(() => clearTimeout(timeoutId));

      if (res.status === 429) {
        keyPool.markCooldown(apiKey, 60000);
        continue;
      }

      // If high demand / unavailable / server error, immediately try next fallback model
      if (res.status === 503 || res.status === 502 || res.status === 504 || res.status === 500) {
        const errText = await res.text().catch(() => '');
        lastError = new Error(`Pocky antrean padat (status ${res.status}): ${errText}`);
        continue;
      }

      if (!res.ok) {
        if (res.status === 404 && attempt < modelsToTry.length - 1) {
          continue;
        }
        const errText = await res.text();
        throw new Error(`Gemini API error (${res.status}): ${errText}`);
      }

      const resJson = await res.json();
      const textPart = resJson.candidates?.[0]?.content?.parts?.find(p => p.text);
      const rawText = textPart?.text;
      if (!rawText) throw new Error('Gemini tidak mengembalikan teks konten');

      const cleanJson = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
      const parsed = JSON.parse(cleanJson);
      const normalized = normalizeReceipt(parsed);

      return {
        ok: true,
        modelUsed: model,
        data: normalized
      };
    } catch (err) {
      lastError = err;
      if (err.name === 'AbortError') {
        lastError = new Error(`Model ${model} timeout (>8s)`);
      }
      if (attempt < maxRetries && attempt < modelsToTry.length - 1) {
        await new Promise(r => setTimeout(r, 500));
      }
    }
  }

  throw lastError || new Error('Gambarnya agak burem atau kurang terbaca');
}

export function flattenReceiptForCsv(receipt, filename = '') {
  const base = {
    timestamp: new Date().toISOString(),
    file_name: filename,
    merchant_name: receipt.merchant_name,
    date: receipt.date,
    category: receipt.category,
    payment_method: receipt.payment_method,
    receipt_subtotal: receipt.subtotal,
    receipt_tax: receipt.tax,
    receipt_total: receipt.total_amount
  };

  if (!receipt.items || receipt.items.length === 0) {
    return [{
      ...base,
      item_name: '-',
      quantity: 1,
      unit_price: receipt.total_amount,
      total_price: receipt.total_amount
    }];
  }

  return receipt.items.map(it => ({
    ...base,
    item_name: it.item_name,
    quantity: it.quantity,
    unit_price: it.unit_price,
    total_price: it.total_price
  }));
}

export const CSV_HEADERS = [
  'timestamp',
  'file_name',
  'merchant_name',
  'date',
  'category',
  'payment_method',
  'item_name',
  'quantity',
  'unit_price',
  'total_price',
  'receipt_subtotal',
  'receipt_tax',
  'receipt_total'
];

function escapeCsvCell(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  return `"${str.replace(/"/g, '""')}"`;
}

export function appendCsvRows(csvFilePath, rows) {
  const dir = path.dirname(csvFilePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const fileExists = fs.existsSync(csvFilePath);
  let content = '';

  if (!fileExists) {
    content += CSV_HEADERS.join(',') + '\n';
  }

  for (const row of rows) {
    const line = CSV_HEADERS.map(h => escapeCsvCell(row[h])).join(',');
    content += line + '\n';
  }

  fs.appendFileSync(csvFilePath, content, 'utf8');
}

export function saveJsonReceipt(jsonFilePath, receiptData) {
  const dir = path.dirname(jsonFilePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(jsonFilePath, JSON.stringify(receiptData, null, 2), 'utf8');
}
