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
  if (['CASH', 'QRIS', 'DEBIT', 'CREDIT'].includes(clean)) return clean;
  return 'UNKNOWN';
}

export function normalizeReceipt(raw = {}) {
  const merchant_name = String(raw.merchant_name || raw.merchant || raw.store_name || 'Struk Belanja').trim();
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
  const category = normalizeCategory(raw.category);

  return {
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
  preferredModel = 'gemini-1.5-flash-8b'
}) {
  if (!imageBase64) throw new Error('Data gambar (base64) wajib disediakan.');

  const promptText = `Anda adalah asisten pembaca struk dan bukti pembayaran akuntansi.
Ekstrak seluruh informasi dari struk ini ke format JSON valid:
{
  "merchant_name": "Nama toko / merchant",
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
  "tax": 1000,
  "total_amount": 11000,
  "payment_method": "CASH | QRIS | DEBIT | CREDIT | UNKNOWN",
  "category": "Food | Shopping | Transport | Bills | Health | Education | Entertainment | Charity | Other"
}
Hanya balas dengan JSON murni tanpa markdown fences.`;

  const modelsToTry = [preferredModel, 'gemini-1.5-flash'];
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const apiKey = keyPool.getKey();
    const model = modelsToTry[Math.min(attempt, modelsToTry.length - 1)];
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
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.status === 429) {
        keyPool.markCooldown(apiKey, 60000);
        const backoffDelay = Math.min(10000, 1000 * Math.pow(2, attempt));
        await new Promise(r => setTimeout(r, backoffDelay));
        continue;
      }

      if (!res.ok) {
        if (res.status === 404 && model !== 'gemini-1.5-flash') {
          continue;
        }
        const errText = await res.text();
        throw new Error(`Gemini API error (${res.status}): ${errText}`);
      }

      const resJson = await res.json();
      const rawText = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
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
      if (attempt < maxRetries) {
        const backoffDelay = 1000 * Math.pow(2, attempt);
        await new Promise(r => setTimeout(r, backoffDelay));
      }
    }
  }

  throw lastError || new Error('Gagal memindai struk setelah beberapa percobaan');
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
