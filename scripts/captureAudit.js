import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '../frontend/dist');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  let filePath = path.join(distDir, reqPath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  // SPA fallback
  if (!fs.existsSync(filePath)) {
    filePath = path.join(distDir, 'index.html');
  }

  const ext = path.extname(filePath);
  const mime = MIME_TYPES[ext] || 'application/octet-stream';

  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': mime });
    res.end(content);
  } catch (err) {
    res.writeHead(500);
    res.end('Error: ' + err.message);
  }
});

server.listen(5299, async () => {
  console.log('Preview server running on http://localhost:5299');

  const screensDir = path.resolve(__dirname, '../screenshots/audit');
  if (!fs.existsSync(screensDir)) fs.mkdirSync(screensDir, { recursive: true });

  const tasks = [
    { url: 'http://localhost:5299/login', name: 'before_login_desktop', width: 1280, height: 800 },
    { url: 'http://localhost:5299/login', name: 'before_login_mobile', width: 375, height: 812 },
    { url: 'http://localhost:5299/registration', name: 'before_register_desktop', width: 1280, height: 800 },
    { url: 'http://localhost:5299/registration', name: 'before_register_mobile', width: 375, height: 812 },
    { url: 'http://localhost:5299/reports', name: 'before_laporan_mobile_360', width: 360, height: 800 },
    { url: 'http://localhost:5299/reports/print', name: 'before_laporan_cetak_mobile_360', width: 360, height: 800 },
  ];

  try {
    for (const t of tasks) {
      const outPath = path.resolve(screensDir, `${t.name}.png`);
      await execFileAsync(chromePath, [
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        `--window-size=${t.width},${t.height}`,
        '--virtual-time-budget=3000',
        `--screenshot=${outPath}`,
        t.url
      ]);
      console.log(`Captured: ${outPath}`);
    }
  } catch (err) {
    console.error('Capture error:', err);
  } finally {
    server.close();
    process.exit(0);
  }
});
