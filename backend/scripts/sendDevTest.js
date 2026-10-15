import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { sendTelegramMessage } from '../lib/telegramBotCore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const args = process.argv.slice(2);

let targetChatId = process.env.DEV_TELEGRAM_IDS?.split(',')[0]?.trim() || '';

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

console.log(`🚀 Mengirim test milestone (${type.toUpperCase()}) ke Telegram ID: ${targetChatId}...`);

async function main() {
  try {
    const msgRes = await sendTelegramMessage(
      botToken,
      targetChatId,
      `🎉 *Halo Developer!*\n\n` +
      `Ini adalah simulasi pesan test milestone yang dikirim khusus ke akun kamu (\`${targetChatId}\`).\n\n` +
      `Tip: Kamu juga bisa ketik langsung di chat bot:\n` +
      `• \`/teststreak\` (default 7 hari)\n` +
      `• \`/teststreak 30\` (simulasi 30 hari)`
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
