#!/usr/bin/env node
// Test Telegram bot on staging preview deployment
// Usage: node scripts/testStaging.js <preview-url> [command]
// Example: node scripts/testStaging.js https://pocketplan-xyz.vercel.app "/saldo"

import 'dotenv/config';

const [,, previewUrl, rawCommand = '/start'] = process.argv;
if (!previewUrl) {
  console.error('Usage: node scripts/testStaging.js <preview-url> [command]');
  process.exit(1);
}

const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const chatId = parseInt(process.env.DEV_TELEGRAM_IDS?.split(',')[0]?.trim());

if (!secret || !chatId) {
  console.error('Set TELEGRAM_WEBHOOK_SECRET and DEV_TELEGRAM_IDS in .env');
  process.exit(1);
}

const fakeUpdate = {
  update_id: Date.now(),
  message: {
    message_id: Date.now(),
    from: { id: chatId, is_bot: false, first_name: 'Dev' },
    chat: { id: chatId, type: 'private' },
    date: Math.floor(Date.now() / 1000),
    text: rawCommand,
  },
};

const url = `${previewUrl.replace(/\/$/, '')}/api/telegram-webhook`;
console.log(`→ POST ${url}`);
console.log(`  chat_id: ${chatId}`);
console.log(`  command: ${rawCommand}`);

const res = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-telegram-bot-api-secret-token': secret,
  },
  body: JSON.stringify(fakeUpdate),
});

console.log(`← ${res.status} ${res.statusText}`);
console.log(await res.json());
