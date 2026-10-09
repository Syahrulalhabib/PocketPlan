import fs from 'fs';
import path from 'path';

const svgPath = path.resolve('frontend/public/pocket-logo.svg');
const svg = fs.readFileSync(svgPath, 'utf8');
const needle = 'data:image/png;base64,';
const start = svg.indexOf(needle);
if (start === -1) {
  console.log('No base64 found in svg');
  process.exit(1);
}
const end = svg.indexOf('"', start);
const b64 = svg.slice(start + needle.length, end);
const buf = Buffer.from(b64, 'base64');

fs.mkdirSync('frontend/src/assets', { recursive: true });
fs.writeFileSync('frontend/src/assets/pocky-bot.png', buf);
fs.writeFileSync('frontend/public/pocky-bot.png', buf);
console.log('Saved pocky-bot.png, size:', buf.length);
