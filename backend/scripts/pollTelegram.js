import dotenv from 'dotenv';
import { initFirebaseAdmin, getDb } from '../lib/firebaseAdmin.js';
import { handleTelegramUpdate } from '../lib/telegramBot.js';

dotenv.config();
initFirebaseAdmin();

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('Error: TELEGRAM_BOT_TOKEN not found in environment');
  process.exit(1);
}

console.log('🤖 PocketPlan Telegram Bot Polling started...');

let offset = 0;
const poll = async () => {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates?offset=${offset}&timeout=30`);
    const data = await res.json();
    if (data.ok && Array.isArray(data.result)) {
      for (const update of data.result) {
        offset = update.update_id + 1;
        await handleTelegramUpdate(update, getDb(), token);
      }
    }
  } catch (err) {
    console.error('Polling error:', err.message);
    await new Promise((r) => setTimeout(r, 3000));
  }
  setImmediate(poll);
};

poll();
