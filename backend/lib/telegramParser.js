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
  infak: 'Charity',
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

// Multi-word phrases checked before individual token inference
const MULTI_WORD_KEYWORDS = {
  'token listrik': 'Bills',
  'paket data': 'Bills',
  'tagihan listrik': 'Bills',
  'tagihan air': 'Bills',
  'tagihan wifi': 'Bills',
  'first media': 'Bills',
  'rumah sakit': 'Health',
  'tes lab': 'Health',
  'cek darah': 'Health',
  'tiket nonton': 'Entertainment',
  'tiket bioskop': 'Entertainment',
  'tiket film': 'Entertainment',
  'tiket konser': 'Entertainment',
  'top up game': 'Entertainment',
  'topup game': 'Entertainment',
  'buku tulis': 'Education',
  'alat tulis': 'Education',
  'cuci motor': 'Transport',
  'cuci mobil': 'Transport',
  'tambal ban': 'Transport',
  'servis motor': 'Transport',
  'servis mobil': 'Transport',
  'service motor': 'Transport',
  'service mobil': 'Transport',
  'sedekah subuh': 'Charity',
  'kotak amal': 'Charity',
  'anak yatim': 'Charity',
  'panti asuhan': 'Charity'
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
  solar: 'Transport',
  dexlite: 'Transport',
  shell: 'Transport',
  spbu: 'Transport',
  ojol: 'Transport',
  grab: 'Transport',
  gojek: 'Transport',
  maxim: 'Transport',
  indrive: 'Transport',
  goride: 'Transport',
  gocar: 'Transport',
  parkir: 'Transport',
  tol: 'Transport',
  etoll: 'Transport',
  kereta: 'Transport',
  krl: 'Transport',
  mrt: 'Transport',
  lrt: 'Transport',
  bus: 'Transport',
  busway: 'Transport',
  transjakarta: 'Transport',
  angkot: 'Transport',
  taksi: 'Transport',
  taxi: 'Transport',
  ongkos: 'Transport',
  tambal: 'Transport',
  ban: 'Transport',
  servis: 'Transport',
  service: 'Transport',
  oli: 'Transport',
  helm: 'Transport',

  // Shopping
  belanja: 'Shopping',
  pasar: 'Shopping',
  supermarket: 'Shopping',
  minimarket: 'Shopping',
  indomaret: 'Shopping',
  alfamart: 'Shopping',
  alfamidi: 'Shopping',
  superindo: 'Shopping',
  hypermart: 'Shopping',
  transmart: 'Shopping',
  shopee: 'Shopping',
  tokopedia: 'Shopping',
  lazada: 'Shopping',
  blibli: 'Shopping',
  baju: 'Shopping',
  kaos: 'Shopping',
  kemeja: 'Shopping',
  celana: 'Shopping',
  rok: 'Shopping',
  sepatu: 'Shopping',
  sandal: 'Shopping',
  tas: 'Shopping',
  jaket: 'Shopping',
  mall: 'Shopping',
  skincare: 'Shopping',
  makeup: 'Shopping',
  parfum: 'Shopping',
  sabun: 'Shopping',
  shampo: 'Shopping',
  tisu: 'Shopping',

  // Bills
  tagihan: 'Bills',
  listrik: 'Bills',
  token: 'Bills',
  pln: 'Bills',
  air: 'Bills',
  pdam: 'Bills',
  wifi: 'Bills',
  indihome: 'Bills',
  biznet: 'Bills',
  internet: 'Bills',
  pulsa: 'Bills',
  kuota: 'Bills',
  paket: 'Bills',
  kos: 'Bills',
  kost: 'Bills',
  kontrakan: 'Bills',
  sewa: 'Bills',
  bpjs: 'Bills',
  asuransi: 'Bills',
  ipl: 'Bills',
  pajak: 'Bills',

  // Charity
  donasi: 'Charity',
  amal: 'Charity',
  sedekah: 'Charity',
  infaq: 'Charity',
  infak: 'Charity',
  zakat: 'Charity',
  kitabisa: 'Charity',
  masjid: 'Charity',
  mushola: 'Charity',
  gereja: 'Charity',
  wakaf: 'Charity',

  // Health
  obat: 'Health',
  apotek: 'Health',
  apotik: 'Health',
  dokter: 'Health',
  rs: 'Health',
  rumahsakit: 'Health',
  klinik: 'Health',
  puskesmas: 'Health',
  vitamin: 'Health',
  suplemen: 'Health',
  paracetamol: 'Health',
  panadol: 'Health',
  masker: 'Health',
  lab: 'Health',
  laboratorium: 'Health',

  // Education
  buku: 'Education',
  novel: 'Education',
  gramedia: 'Education',
  kursus: 'Education',
  les: 'Education',
  bimbel: 'Education',
  kuliah: 'Education',
  spp: 'Education',
  sekolah: 'Education',
  semester: 'Education',
  skripsi: 'Education',
  atk: 'Education',
  pulpen: 'Education',
  pensil: 'Education',
  seminar: 'Education',
  workshop: 'Education',
  pelatihan: 'Education',

  // Entertainment
  nonton: 'Entertainment',
  bioskop: 'Entertainment',
  cinema: 'Entertainment',
  xxi: 'Entertainment',
  cgv: 'Entertainment',
  cinepolis: 'Entertainment',
  film: 'Entertainment',
  tiket: 'Entertainment',
  game: 'Entertainment',
  steam: 'Entertainment',
  playstation: 'Entertainment',
  topup: 'Entertainment',
  karaoke: 'Entertainment',
  netflix: 'Entertainment',
  spotify: 'Entertainment',
  youtube: 'Entertainment',
  disney: 'Entertainment',
  liburan: 'Entertainment',
  wisata: 'Entertainment',
  hotel: 'Entertainment',
  staycation: 'Entertainment',

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
    const fullRemaining = remaining.join(' ').toLowerCase();
    const firstRemainingKey = remaining[0].toLowerCase();
    
    // 1. Check multi-word natural phrases first (e.g. token listrik, tiket bioskop, cuci motor)
    for (const [key, cat] of Object.entries(MULTI_WORD_KEYWORDS)) {
      if (fullRemaining.includes(key)) {
        category = cat;
        description = remaining.join(' ').trim();
        break;
      }
    }

    // 2. Check if user specified explicit category first (e.g. /catat 50000 makan nasi padang)
    if (category === (type === 'Income' ? 'Salary' : 'Other')) {
      if (EXPLICIT_CATEGORIES[firstRemainingKey]) {
        category = EXPLICIT_CATEGORIES[firstRemainingKey];
        description = remaining.slice(1).join(' ').trim() || remaining[0];
      } else {
        description = remaining.join(' ').trim();
        
        // 3. Exact word match against EXPLICIT_CATEGORIES or INFERRED_KEYWORDS
        for (const w of remaining) {
          const k = w.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
          if (!k) continue;
          if (EXPLICIT_CATEGORIES[k]) {
            category = EXPLICIT_CATEGORIES[k];
            break;
          }
          if (INFERRED_KEYWORDS[k]) {
            category = INFERRED_KEYWORDS[k];
            break;
          }
        }

        // 4. Substring or emoji match for longer tokens (> 3 chars) or emojis
        if (category === (type === 'Income' ? 'Salary' : 'Other')) {
          for (const w of remaining) {
            const k = w.toLowerCase();
            for (const [key, cat] of Object.entries(INFERRED_KEYWORDS)) {
              if (/[\p{Extended_Pictographic}]/u.test(key) && k.includes(key)) {
                category = cat;
                break;
              }
              // Only match substring if key is longer than 3 chars and matches word boundary or affix
              if (key.length > 3 && (k.startsWith(key) || k.endsWith(key))) {
                category = cat;
                break;
              }
            }
            if (category !== (type === 'Income' ? 'Salary' : 'Other')) break;
          }
        }
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

