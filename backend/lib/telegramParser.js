/**
 * Telegram Message & Amount Parser for PocketPlan
 */

// Explicit category markers that user prefixes before the description
const EXPLICIT_CATEGORIES = {
  makan: 'Food',
  makanan: 'Food',
  food: 'Food',
  transport: 'Transport',
  transportasi: 'Transport',
  belanja: 'Shopping',
  shopping: 'Shopping',
  tagihan: 'Bills',
  bills: 'Bills',
  amal: 'Charity',
  charity: 'Charity',
  sedekah: 'Charity',
  sehat: 'Health',
  kesehatan: 'Health',
  edukasi: 'Education',
  pendidikan: 'Education',
  hiburan: 'Entertainment',
  entertainment: 'Entertainment',
  gaji: 'Salary',
  salary: 'Salary'
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
  freelance: 'Freelance',
  penjualan: 'Income',
  bisnis: 'Business',
  investasi: 'Investment',
  dividen: 'Investment',
  transfer: 'Transfer'
};

/**
 * Parse string nominal into number
 * Supports: 50000, 50.000, 50,000, 50k, 50rb, 1.5jt, Rp 50.000
 */
export function parseAmount(raw) {
  if (!raw) return 0;
  let clean = String(raw).trim().toLowerCase();
  clean = clean.replace(/^rp\.?\s*/i, '');

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

  if (multiplier > 1 && clean.includes(',')) {
    clean = clean.replace(',', '.');
  } else if (multiplier === 1) {
    clean = clean.replace(/[.,]/g, '');
  }

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

  if (first.startsWith('/masuk') || first.startsWith('/income') || first === 'masuk') {
    type = 'Income';
    if (words.length < 2) return null;
    amountStr = words[1];
    remaining = words.slice(2);
  } else if (first.startsWith('/catat') || first.startsWith('/keluar') || first.startsWith('/expense') || first === 'catat' || first === 'keluar') {
    type = 'Expense';
    if (words.length < 2) return null;
    amountStr = words[1];
    remaining = words.slice(2);
  } else if (first.startsWith('+')) {
    type = 'Income';
    amountStr = first.slice(1) || (words[1] || '');
    remaining = first.slice(1) ? words.slice(1) : words.slice(2);
  } else if (first.startsWith('-')) {
    type = 'Expense';
    amountStr = first.slice(1) || (words[1] || '');
    remaining = first.slice(1) ? words.slice(1) : words.slice(2);
  } else {
    // Check if the very first word is an amount (e.g. "50k kopi", "25000 bensin")
    const testAmt = parseAmount(first);
    if (testAmt > 0 && words.length >= 2) {
      type = 'Expense';
      amountStr = first;
      remaining = words.slice(1);
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
      description = remaining.slice(1).join(' ').trim();
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
      }
    }
  }

  if (!description) {
    description = category !== 'Other' ? category : type === 'Income' ? 'Income' : 'Expense';
  }

  const capitalizedDesc = description
    .split(' ')
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ''))
    .join(' ');

  const today = new Date().toISOString().slice(0, 10);

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
