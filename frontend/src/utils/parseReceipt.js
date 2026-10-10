/**
 * Parse OCR text from a receipt/struk to extract transaction fields.
 * Returns { amount, description, category, date } with best-effort guesses.
 */

const CATEGORY_KEYWORDS = {
  Food: ['resto', 'restaurant', 'cafe', 'kopi', 'coffee', 'bakery', 'makan', 'food', 'warung',
    'mcd', 'kfc', 'pizza', 'burger', 'starbucks', 'chatime', 'hokben', 'solaria',
    'padang', 'seafood', 'ayam', 'nasi', 'mie', 'bakso', 'martabak', 'indomie'],
  Shopping: ['supermarket', 'indomaret', 'alfamart', 'alfamidi', 'hypermart', 'giant',
    'carrefour', 'transmart', 'lotte', 'mall', 'toko', 'shop', 'store', 'minimarket'],
  Transport: ['spbu', 'pertamina', 'shell', 'bensin', 'parkir', 'tol', 'grab', 'gojek'],
  Bills: ['listrik', 'pln', 'pdam', 'telkom', 'indihome', 'pulsa', 'token', 'tagihan'],
  Health: ['apotek', 'pharmacy', 'apotik', 'kimia farma', 'klinik', 'rumah sakit', 'rs '],
  Entertainment: ['cinema', 'bioskop', 'cgv', 'xxi', 'game', 'spotify', 'netflix']
};

/**
 * Extract the largest currency amount from OCR text.
 * Looks for patterns like: Rp 50.000, 50000, 50,000, TOTAL 50.000, etc.
 */
function extractAmount(text) {
  const cleaned = text
    .replace(/[oO]/g, (m, offset, str) => {
      const before = str[offset - 1];
      const after = str[offset + 1];
      const isDigitContext = (before && /[\d.]/.test(before)) || (after && /[\d.]/.test(after));
      return isDigitContext ? '0' : m;
    });

  const lines = cleaned.split('\n');
  let candidates = [];

  // Score each line: "total"/"grand total"/"jumlah" = best, "bayar"/"debit"/"kredit" = good, "tunai"/"cash"/"kembalian" = skip
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (/kembalian|change/.test(lower)) continue; // skip change lines

    const isTotalLine = /\b(grand\s*total|total|jumlah)\b/i.test(lower);
    const isPayLine = /\b(bayar|debit|kredit|payment)\b/i.test(lower);
    const isCashLine = /\b(tunai|cash)\b/i.test(lower);

    // Extract numbers from this line
    const numMatches = [...line.matchAll(/(?:rp\.?\s*)?([0-9][0-9.,]*[0-9])/gi)];
    for (const m of numMatches) {
      const raw = m[1] || m[0];
      const num = Number(raw.replace(/[.,]/g, ''));
      if (num >= 100 && num <= 100_000_000) {
        let score = 0;
        if (isTotalLine) score = 3;
        else if (isPayLine) score = 2;
        else if (isCashLine) score = 1;
        candidates.push({ num, score });
      }
    }
  }

  if (candidates.length === 0) return null;

  // Prefer total lines; among same score, pick largest
  candidates.sort((a, b) => b.score - a.score || b.num - a.num);
  return candidates[0].num;
}

/**
 * Extract date from receipt text.
 * Common formats: DD/MM/YYYY, DD-MM-YYYY, DD/MM/YY, YYYY-MM-DD
 */
function extractDate(text) {
  const patterns = [
    // DD/MM/YYYY or DD-MM-YYYY
    /(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/,
    // YYYY-MM-DD (ISO)
    /(\d{4})-(\d{2})-(\d{2})/,
    // DD/MM/YY
    /(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2})\b/,
  ];

  for (const pat of patterns) {
    const m = text.match(pat);
    if (!m) continue;

    let y, mo, d;
    if (/^\d{4}$/.test(m[1])) {
      // ISO format
      [, y, mo, d] = m;
    } else {
      [, d, mo, y] = m;
      if (y.length === 2) y = '20' + y;
    }

    y = Number(y); mo = Number(mo); d = Number(d);
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31 && y >= 2020 && y <= 2030) {
      return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }
  return null;
}

/**
 * Infer category from receipt text based on keyword matching.
 */
function inferCategory(text) {
  const lower = text.toLowerCase();
  let best = null;
  let bestCount = 0;

  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const count = keywords.filter(kw => lower.includes(kw)).length;
    if (count > bestCount) {
      bestCount = count;
      best = cat;
    }
  }
  return best || 'Shopping';
}

/**
 * Extract a short description — usually the store/merchant name.
 * Takes the first non-empty, non-numeric, non-trivial line.
 */
function extractDescription(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    // Skip lines that are mostly numbers/symbols or very short
    const alpha = line.replace(/[^a-zA-Z\s]/g, '').trim();
    if (alpha.length >= 3 && alpha.length <= 60 && !/^(rp|total|subtotal|tax|ppn|diskon|change|kembalian|tunai|debit)/i.test(alpha)) {
      // Capitalize first letter of each word
      return alpha.replace(/\b\w/g, c => c.toUpperCase()).substring(0, 50);
    }
  }
  return 'Struk';
}

/**
 * Main entry: parse OCR text → transaction fields
 */
export function parseReceiptText(ocrText) {
  const amount = extractAmount(ocrText);
  const date = extractDate(ocrText);
  const category = inferCategory(ocrText);
  const description = extractDescription(ocrText);

  return {
    amount: amount || '',
    date: date || new Date().toISOString().slice(0, 10),
    category,
    description,
    type: 'Expense'
  };
}
