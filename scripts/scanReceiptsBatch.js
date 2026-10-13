import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import {
  KeyPool,
  scanReceiptWithGemini,
  flattenReceiptForCsv,
  appendCsvRows,
  saveJsonReceipt
} from '../backend/lib/geminiReceiptScanner.js';
import { initFirebaseAdmin, getDb } from '../backend/lib/firebaseAdmin.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Load .env from backend and root
dotenv.config({ path: path.resolve(rootDir, 'backend/.env') });
dotenv.config({ path: path.resolve(rootDir, '.env') });

const SUPPORTED_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic']);

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.heic') return 'image/heic';
  return 'image/jpeg';
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const args = process.argv.slice(2);
  const inputDir = path.resolve(rootDir, 'struk_input');
  const jsonDir = path.resolve(rootDir, 'output_json');
  const csvFile = path.resolve(rootDir, 'output_rekap.csv');
  const syncFirestore = args.includes('--sync-firestore');
  const targetUid = process.env.SYNC_FIRESTORE_UID || 'batch-scanner-user';

  if (!fs.existsSync(inputDir)) {
    fs.mkdirSync(inputDir, { recursive: true });
    console.log(`📁 Folder '${inputDir}' dibuat. Silakan letakkan foto struk belanja di sini.`);
  }
  if (!fs.existsSync(jsonDir)) {
    fs.mkdirSync(jsonDir, { recursive: true });
  }

  const keyPool = KeyPool.fromEnv();
  if (!keyPool.hasKeys()) {
    console.error('❌ Error: GEMINI_API_KEY atau GEMINI_API_KEYS belum disetel di file .env');
    console.error('   Tambahkan contoh: GEMINI_API_KEYS=AIzaSy...,AIzaSy...');
    process.exit(1);
  }

  let db = null;
  if (syncFirestore) {
    try {
      initFirebaseAdmin();
      db = getDb();
      if (db) console.log(`🔥 Firestore Sync Aktif (target UID: ${targetUid})`);
    } catch (e) {
      console.warn('⚠️ Gagal inisialisasi Firestore, melanjutkan tanpa sinkronisasi:', e.message);
    }
  }

  const files = fs.readdirSync(inputDir).filter((file) => {
    const ext = path.extname(file).toLowerCase();
    return SUPPORTED_EXTS.has(ext);
  });

  console.log(`\n======================================================`);
  console.log(`🧾 PocketPlan Pocky Receipt Scanner (Gemini-3.5-flash-lite)`);
  console.log(`======================================================`);
  console.log(`Ditemukan ${files.length} berkas struk di ${inputDir}`);
  console.log(`Delay per request: 4 detik (Google Free Tier 15 RPM Safe Limit)\n`);

  let countProcessed = 0;
  let countSkipped = 0;
  let countFailed = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const filePath = path.join(inputDir, file);
    const baseName = path.parse(file).name;
    const jsonOutPath = path.join(jsonDir, `${baseName}.json`);

    // Idempotency: skip if already processed
    if (fs.existsSync(jsonOutPath)) {
      console.log(`[${i + 1}/${files.length}] ⏩ Lewati: '${file}' (sudah pernah diproses)`);
      countSkipped++;
      continue;
    }

    console.log(`[${i + 1}/${files.length}] 🔍 Memproses: '${file}'...`);

    try {
      const fileBuffer = fs.readFileSync(filePath);
      const imageBase64 = fileBuffer.toString('base64');
      const mimeType = getMimeType(filePath);

      const scanResult = await scanReceiptWithGemini({
        imageBase64,
        mimeType,
        keyPool
      });

      const receipt = scanResult.data;

      // 1. Export JSON
      saveJsonReceipt(jsonOutPath, receipt);

      // 2. Export CSV
      const rows = flattenReceiptForCsv(receipt, file);
      appendCsvRows(csvFile, rows);

      // 3. Sync to Firestore (optional)
      if (db) {
        await db.collection('users').doc(targetUid).collection('transactions').add({
          category: receipt.category,
          type: 'Expense',
          amount: receipt.total_amount,
          description: receipt.merchant_name,
          date: receipt.date,
          createdAt: new Date().toISOString(),
          paymentMethod: receipt.payment_method,
          receiptFile: file,
          receiptItems: receipt.items
        });
      }

      console.log(`   ✅ Selesai: ${receipt.merchant_name} | Rp ${receipt.total_amount.toLocaleString('id-ID')} | ${receipt.category}`);
      countProcessed++;

      // Free tier rate pacing (4 seconds)
      if (i < files.length - 1) {
        await sleep(4000);
      }
    } catch (err) {
      console.error(`   ❌ Gagal memproses '${file}':`, err.message);
      countFailed++;
    }
  }

  console.log(`\n======================================================`);
  console.log(`📊 Rekapitulasi Pemrosesan:`);
  console.log(`   Total berkas  : ${files.length}`);
  console.log(`   Berhasil      : ${countProcessed}`);
  console.log(`   Dilewati      : ${countSkipped}`);
  console.log(`   Gagal         : ${countFailed}`);
  console.log(`   Hasil JSON    : ${jsonDir}`);
  console.log(`   Hasil CSV     : ${csvFile}`);
  console.log(`======================================================\n`);
}

main().catch((err) => {
  console.error('Fatal batch scanner error:', err);
  process.exit(1);
});
