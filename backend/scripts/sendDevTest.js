import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateAchievementCard, sendTelegramPhoto } from '../lib/telegramBot.js';
import { sendTelegramMessage } from '../lib/telegramBotCore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const args = process.argv.slice(2);

// Default to developer chat ID: 8392548889
let targetChatId = '8392548889';
let type = 'streak';
let days = 7;
let percent = 75;

for (const arg of args) {
  if (/^\d{7,12}$/.test(arg)) {
    targetChatId = arg;
  } else if (arg.toLowerCase() === 'goal') {
    type = 'goal';
  } else if (/^\d+$/.test(arg)) {
    days = parseInt(arg, 10);
    percent = Math.min(100, days);
  }
}

if (!botToken) {
  console.error('❌ Error: TELEGRAM_BOT_TOKEN tidak ditemukan di backend/.env');
  process.exit(1);
}

console.log(`🚀 Mengirim test kartu achievement (${type.toUpperCase()}) ke Telegram ID: ${targetChatId}...`);

async function main() {
  try {
    const opts = type === 'streak'
      ? { type: 'streak', title: `Streak ${days} Hari! 🔥`, subtitle: `${days} hari berturut-turut catat keuangan`, streakDays: days }
      : { type: 'goal', title: 'Target Tabungan (Dana Darurat)', subtitle: 'Target Rp 10.000.000', percent };

    const png = await generateAchievementCard(opts);
    console.log(`✅ Kartu PNG berhasil digenerate (${png.length} bytes).`);

    const photoRes = await sendTelegramPhoto(
      botToken,
      targetChatId,
      png,
      `✨ *KARTU ACHIEVEMENT POCKY (${opts.type.toUpperCase()})*\n\n` +
      (type === 'streak'
        ? `🔥 *Streak ${days} Hari Aktif!*\nKonsistensi finansial kamu luar biasa. Terus pertahankan! 🪙`
        : `🎯 *Target Tabungan: ${percent}% Tercapai!*\nLangkah demi langkah menuju impian finansialmu! 💰`) +
      `\n\n_Mode Uji Developer PocketPlan_`,
      { parse_mode: 'Markdown' }
    );

    if (photoRes && photoRes.ok) {
      console.log('✅ Foto kartu berhasil dikirim ke Telegram!');
    } else {
      console.warn('⚠️ Respons Telegram API photo:', photoRes);
    }

    const msgRes = await sendTelegramMessage(
      botToken,
      targetChatId,
      `🎉 *Halo Developer!*\n\n` +
      `Ini adalah simulasi pesan test milestone & kartu streak yang dikirim khusus ke akun kamu (\`${targetChatId}\`).\n\n` +
      `Tip: Kamu juga bisa ketik langsung di chat bot:\n` +
      `• \`/teststreak\` (default 7 hari)\n` +
      `• \`/teststreak 30\` (simulasi 30 hari)\n` +
      `• \`/testkartu goal\` (simulasi kartu target impian)`
    );

    if (msgRes && msgRes.ok) {
      console.log('✅ Pesan konfirmasi berhasil dikirim ke Telegram!');
    }

    console.log(`\n🎉 SELESAI: Pengujian berhasil dikirim ke ID ${targetChatId}`);
  } catch (err) {
    console.error('❌ Gagal mengirim test ke Telegram:', err);
    process.exit(1);
  }
}

main();
