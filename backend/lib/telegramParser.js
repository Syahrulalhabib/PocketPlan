/**
 * Telegram Message & Amount Parser for PocketPlan
 */

// Explicit category markers that user prefixes before the description
const EXPLICIT_CATEGORIES = {
  makan: 'Food',
  makanan: 'Food',
  food: 'Food',
  kuliner: 'Food',
  dining: 'Food',
  transport: 'Transport',
  transportasi: 'Transport',
  transportation: 'Transport',
  bensin: 'Transport',
  kendaraan: 'Transport',
  belanja: 'Shopping',
  shopping: 'Shopping',
  shop: 'Shopping',
  tagihan: 'Bills',
  bills: 'Bills',
  bill: 'Bills',
  utilities: 'Bills',
  amal: 'Charity',
  charity: 'Charity',
  sedekah: 'Charity',
  donasi: 'Charity',
  infaq: 'Charity',
  zakat: 'Charity',
  sehat: 'Health',
  kesehatan: 'Health',
  health: 'Health',
  medis: 'Health',
  medical: 'Health',
  edukasi: 'Education',
  pendidikan: 'Education',
  education: 'Education',
  hiburan: 'Entertainment',
  entertainment: 'Entertainment',
  hobi: 'Entertainment',
  game: 'Entertainment',
  gaji: 'Salary',
  salary: 'Salary',
  income: 'Salary',
  pemasukan: 'Salary',
  other: 'Other',
  lainnya: 'Other',
  umum: 'Other'
};

// Item keywords to infer category when user doesn't specify an explicit category prefix
const INFERRED_KEYWORDS = {
  // Food
  kopi: 'Food',
  kafe: 'Food',
  cafe: 'Food',
  resto: 'Food',
  jajan: 'Food',
  sarapan: 'Food',
  lunch: 'Food',
  dinner: 'Food',
  snack: 'Food',
  bakso: 'Food',
  mie: 'Food',
  ayam: 'Food',
  nasi: 'Food',
  minum: 'Food',

  // Transport
  bensin: 'Transport',
  bbm: 'Transport',
  pertalite: 'Transport',
  pertamax: 'Transport',
  ojol: 'Transport',
  grab: 'Transport',
  gojek: 'Transport',
  maxim: 'Transport',
  parkir: 'Transport',
  tol: 'Transport',
  kereta: 'Transport',
  bus: 'Transport',
  angkot: 'Transport',

  // Shopping
  pasar: 'Shopping',
  supermarket: 'Shopping',
  indomaret: 'Shopping',
  alfamart: 'Shopping',
  baju: 'Shopping',
  celana: 'Shopping',
  sepatu: 'Shopping',
  mall: 'Shopping',
  skincare: 'Shopping',

  // Bills
  listrik: 'Bills',
  pln: 'Bills',
  air: 'Bills',
  pdam: 'Bills',
  wifi: 'Bills',
  indihome: 'Bills',
  internet: 'Bills',
  pulsa: 'Bills',
  kuota: 'Bills',
  kos: 'Bills',
  kost: 'Bills',
  sewa: 'Bills',
  bpjs: 'Bills',

  // Charity
  donasi: 'Charity',
  infaq: 'Charity',
  zakat: 'Charity',

  // Health
  obat: 'Health',
  apotek: 'Health',
  dokter: 'Health',
  rs: 'Health',
  klinik: 'Health',

  // Education
  buku: 'Education',
  kursus: 'Education',
  kuliah: 'Education',
  spp: 'Education',
  sekolah: 'Education',

  // Entertainment
  nonton: 'Entertainment',
  bioskop: 'Entertainment',
  cinema: 'Entertainment',
  game: 'Entertainment',
  netflix: 'Entertainment',
  spotify: 'Entertainment',
  liburan: 'Entertainment',

  // Income
  bonus: 'Salary',
  thr: 'Salary',
  freelance: 'Salary',
  penjualan: 'Salary',
  bisnis: 'Salary',
  investasi: 'Salary',
  dividen: 'Salary',
  transfer: 'Salary',

  // Emoji shortcuts
  '🍔': 'Food',
  '☕': 'Food',
  '🍜': 'Food',
  '🍕': 'Food',
  '🍗': 'Food',
  '🍚': 'Food',
  '🍱': 'Food',
  '🍰': 'Food',
  '🍦': 'Food',
  '🍞': 'Food',
  '🧋': 'Food',
  '🍳': 'Food',
  '🥗': 'Food',
  '🍣': 'Food',
  '🍲': 'Food',
  '🥟': 'Food',
  '🥤': 'Food',
  '🥪': 'Food',
  '⛽': 'Transport',
  '🛵': 'Transport',
  '🚗': 'Transport',
  '🚕': 'Transport',
  '🚌': 'Transport',
  '🚆': 'Transport',
  '✈️': 'Transport',
  '🚲': 'Transport',
  '🏍️': 'Transport',
  '🛒': 'Shopping',
  '🛍️': 'Shopping',
  '🛍': 'Shopping',
  '👕': 'Shopping',
  '👗': 'Shopping',
  '👟': 'Shopping',
  '👠': 'Shopping',
  '📱': 'Bills',
  '💡': 'Bills',
  '⚡': 'Bills',
  '💧': 'Bills',
  '📶': 'Bills',
  '🧾': 'Bills',
  '🏠': 'Bills',
  '💊': 'Health',
  '🏥': 'Health',
  '🩺': 'Health',
  '🩹': 'Health',
  '📚': 'Education',
  '🎓': 'Education',
  '✏️': 'Education',
  '📝': 'Education',
  '🎬': 'Entertainment',
  '🎮': 'Entertainment',
  '🎟️': 'Entertainment',
  '🍿': 'Entertainment',
  '🎧': 'Entertainment',
  '🎤': 'Entertainment',
  '🕌': 'Charity',
  '🤲': 'Charity',
  '🎁': 'Charity',
  '🤍': 'Charity',
  '❤️': 'Charity',
  '💰': 'Salary',
  '💵': 'Salary',
  '💸': 'Salary',
  '🤑': 'Salary',
  '📈': 'Salary'
};

/**
 * Parse string nominal into number
 * Supports: 50000, 50.000, 50,000, 50k, 50rb, 1.5jt, Rp 50.000, 25k,-, ☕25k, 50k🍔
 */
export function parseAmount(raw) {
  if (!raw) return 0;
  let clean = String(raw).trim().toLowerCase();
  // Strip outer punctuation/symbols
  clean = clean.replace(/^[([{\s'"`~!\$@%^&*\-_+=|:;<>?/]+|[)\]}\s'"`~!\$@%^&*\-_+=|:;<>?,/]+$/g, '');
  // Strip outer emojis without touching numbers
  clean = clean.replace(/^[\p{Extended_Pictographic}\s]+/gu, '');
  clean = clean.replace(/[\p{Extended_Pictographic}\s]+$/gu, '');
  clean = clean.replace(/^(rp\.?|idr|\$)\s*/i, '');
  clean = clean.replace(/^[.,]+|[.,\-_/]+$/g, '').trim();

  let multiplier = 1;
  if (/([0-9.,]+)\s*(jt|juta|m)\b/.test(clean)) {
    const match = clean.match(/([0-9.,]+)\s*(jt|juta|m)\b/);
    multiplier = 1000000;
    clean = match[1];
  } else if (/([0-9.,]+)\s*(k|rb|ribu)\b/.test(clean)) {
    const match = clean.match(/([0-9.,]+)\s*(k|rb|ribu)\b/);
    multiplier = 1000;
    clean = match[1];
  }

  clean = clean.replace(/^[.,]+|[.,]+$/g, '');

  if (multiplier > 1 && clean.includes(',')) {
    clean = clean.replace(',', '.');
  } else if (multiplier === 1) {
    clean = clean.replace(/[.,]/g, '');
  }

  clean = clean.replace(/[^0-9.]/g, '');
  const num = parseFloat(clean) * multiplier;
  return isNaN(num) || num <= 0 ? 0 : Math.round(num);
}

/**
 * Parse transaction input command
 * Supports:
 * - /catat 50000 makan nasi padang
 * - /masuk 2.5jt gaji bulanan
 * - 50k kopi kenangan (direct expense shorthand!)
 * - +500k reward freelance (direct income shorthand!)
 * - -35k bensin (direct expense shorthand!)
 */
export function parseTransactionCommand(text, defaultType = 'Expense') {
  if (!text) return null;
  const trimmed = text.trim();

  const words = trimmed.split(/\s+/);
  if (words.length < 1) return null;

  const first = words[0].toLowerCase();
  let type = defaultType;
  let amountStr = '';
  let remaining = [];

  const isCommand = (cmd, ...matches) => matches.some((m) => cmd.startsWith(m) || cmd === m.replace('/', ''));
  const isIncome = isCommand(first, '/masuk', '/income');
  const isExpense = isCommand(first, '/catat', '/keluar', '/expense');

  if (isIncome || isExpense) {
    type = isIncome ? 'Income' : 'Expense';
    if (words.length < 2) return null;
    
    // Check if amount is immediately after the command (e.g., /catat 50k kopi)
    if (parseAmount(words[1]) > 0) {
      amountStr = words[1];
      remaining = words.slice(2);
    } 
    // Check if amount is at the end (e.g., /catat kopi 50k)
    else if (parseAmount(words[words.length - 1]) > 0) {
      amountStr = words[words.length - 1];
      remaining = words.slice(1, -1);
    } 
    else {
      // Look for amount anywhere in words[1..n]
      const amtIdx = words.findIndex((w, i) => i > 0 && parseAmount(w) > 0);
      if (amtIdx > 0) {
        amountStr = words[amtIdx];
        remaining = [...words.slice(1, amtIdx), ...words.slice(amtIdx + 1)];
      } else {
        return null;
      }
    }
  } else if (first.startsWith('+') || first.startsWith('-')) {
    type = first.startsWith('+') ? 'Income' : 'Expense';
    const restOfFirst = first.slice(1);
    const subWords = restOfFirst ? [restOfFirst, ...words.slice(1)] : words.slice(1);
    
    if (subWords.length < 1) return null;
    if (parseAmount(subWords[0]) > 0) {
      amountStr = subWords[0];
      remaining = subWords.slice(1);
    } else if (parseAmount(subWords[subWords.length - 1]) > 0) {
      amountStr = subWords[subWords.length - 1];
      remaining = subWords.slice(0, -1);
    } else {
      return null;
    }
  } else {
    // Direct shorthand without command
    // Check if first word is amount (e.g., "50k kopi")
    if (parseAmount(first) > 0 && words.length >= 2) {
      type = 'Expense';
      amountStr = first;
      remaining = words.slice(1);
    } 
    // Check if last word is amount (e.g., "kopi 50k")
    else if (parseAmount(words[words.length - 1]) > 0 && words.length >= 2) {
      type = 'Expense';
      amountStr = words[words.length - 1];
      remaining = words.slice(0, -1);
    } else {
      return null;
    }
  }

  const amount = parseAmount(amountStr);
  if (amount <= 0) return null;

  let category = type === 'Income' ? 'Salary' : 'Other';
  let description = '';

  if (remaining.length > 0) {
    const firstRemainingKey = remaining[0].toLowerCase();
    
    // Check if user specified explicit category first (e.g. /catat 50000 makan nasi padang)
    if (EXPLICIT_CATEGORIES[firstRemainingKey]) {
      category = EXPLICIT_CATEGORIES[firstRemainingKey];
      description = remaining.slice(1).join(' ').trim() || remaining[0];
    } else {
      // User didn't give category prefix (e.g. /catat 15000 kopi kenangan)
      description = remaining.join(' ').trim();
      for (const w of remaining) {
        const k = w.toLowerCase();
        if (EXPLICIT_CATEGORIES[k]) {
          category = EXPLICIT_CATEGORIES[k];
          break;
        }
        if (INFERRED_KEYWORDS[k]) {
          category = INFERRED_KEYWORDS[k];
          break;
        }
        // Substring or emoji match
        for (const [key, cat] of Object.entries(INFERRED_KEYWORDS)) {
          if (k.includes(key)) {
            category = cat;
            break;
          }
        }
        if (category !== (type === 'Income' ? 'Salary' : 'Other')) break;
      }
    }
  }

  if (!description) {
    description = category !== 'Other' ? category : type === 'Income' ? 'Income' : 'Expense';
  }

  const capitalizedDesc = description
    .split(' ')
    .map((w) => {
      if (!w) return '';
      const chars = Array.from(w);
      return chars[0].toUpperCase() + chars.slice(1).join('');
    })
    .join(' ');

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());

  return {
    type,
    amount,
    category,
    description: capitalizedDesc,
    date: today,
    createdAt: new Date().toISOString()
  };
}

export function formatRupiah(num) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(num || 0);
}

export const CATEGORY_LABELS = {
  Food: 'Makanan (Food)',
  Shopping: 'Belanja (Shopping)',
  Transport: 'Transportasi',
  Bills: 'Tagihan (Bills)',
  Health: 'Kesehatan (Health)',
  Education: 'Pendidikan (Education)',
  Entertainment: 'Hiburan (Entertainment)',
  Charity: 'Amal & Sedekah',
  Salary: 'Gaji / Pendapatan',
  Other: 'Lain-lain'
};

export const CATEGORY_ICONS = {
  Food: '🍔',
  Shopping: '🛍️',
  Transport: '🚗',
  Bills: '📄',
  Health: '💊',
  Education: '📚',
  Entertainment: '🎮',
  Charity: '🤝',
  Salary: '💵',
  Other: '📦'
};

export function normalizeBudgetCategory(raw) {
  if (!raw) return 'Other';
  const clean = String(raw).trim().toLowerCase();

  // 1. Canonical direct match
  const canonical = ['Food', 'Shopping', 'Transport', 'Bills', 'Health', 'Education', 'Entertainment', 'Charity', 'Salary', 'Other'];
  const directCanon = canonical.find(c => c.toLowerCase() === clean);
  if (directCanon) return directCanon;

  // 2. Direct dictionary match
  if (EXPLICIT_CATEGORIES[clean]) return EXPLICIT_CATEGORIES[clean];
  if (INFERRED_KEYWORDS[clean]) return INFERRED_KEYWORDS[clean];

  // 3. Substring & alias matching (handling "Food & Dining", "Makanan (Food)", "Belanja (Shopping)", "Bills & Utilities", "Transportasi (Transport)", etc.)
  if (clean.includes('food') || clean.includes('makan') || clean.includes('kuliner') || clean.includes('dining')) return 'Food';
  if (clean.includes('transport') || clean.includes('kendaraan') || clean.includes('bensin') || clean.includes('ojol')) return 'Transport';
  if (clean.includes('shop') || clean.includes('belanja') || clean.includes('mall') || clean.includes('pasar')) return 'Shopping';
  if (clean.includes('bill') || clean.includes('tagih') || clean.includes('utilit') || clean.includes('listrik') || clean.includes('pulsa')) return 'Bills';
  if (clean.includes('health') || clean.includes('sehat') || clean.includes('medis') || clean.includes('obat')) return 'Health';
  if (clean.includes('edu') || clean.includes('didik') || clean.includes('sekolah') || clean.includes('kursus') || clean.includes('buku')) return 'Education';
  if (clean.includes('ent') || clean.includes('hibur') || clean.includes('game') || clean.includes('rekreasi') || clean.includes('hobi')) return 'Entertainment';
  if (clean.includes('char') || clean.includes('amal') || clean.includes('donasi') || clean.includes('sedekah') || clean.includes('zakat') || clean.includes('infaq')) return 'Charity';
  if (clean.includes('sal') || clean.includes('gaji') || clean.includes('income') || clean.includes('masuk')) return 'Salary';
  if (clean.includes('other') || clean.includes('lain') || clean.includes('umum')) return 'Other';

  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

