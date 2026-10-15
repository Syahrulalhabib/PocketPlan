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

server.listen(5288, async () => {
  console.log('Static preview server running on http://localhost:5288');

  const targets = [
    { url: 'http://localhost:5288/', name: 'landing' },
    { url: 'http://localhost:5288/demo', name: 'dashboard' },
    { url: 'http://localhost:5288/pencapaian', name: 'pencapaian' },
    { url: 'http://localhost:5288/unknown-test-404', name: '404' }
  ];

  const screensDir = path.resolve(__dirname, '../screenshots');
  if (!fs.existsSync(screensDir)) fs.mkdirSync(screensDir, { recursive: true });

  try {
    for (const t of targets) {
      // Desktop (1280x800)
      const deskOut = path.resolve(screensDir, `after_${t.name}_desktop.png`);
      await execFileAsync(chromePath, [
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        '--window-size=1280,800',
        `--screenshot=${deskOut}`,
        t.url
      ]);
      console.log(`Saved: ${deskOut}`);

      // Mobile (375x812)
      const mobOut = path.resolve(screensDir, `after_${t.name}_mobile.png`);
      await execFileAsync(chromePath, [
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        '--window-size=375,812',
        `--screenshot=${mobOut}`,
        t.url
      ]);
      console.log(`Saved: ${mobOut}`);
    }

    // Also update standard after_landing.png and after_dashboard.png for compatibility
    fs.copyFileSync(
      path.join(screensDir, 'after_landing_desktop.png'),
      path.join(screensDir, 'after_landing.png')
    );
    fs.copyFileSync(
      path.join(screensDir, 'after_dashboard_desktop.png'),
      path.join(screensDir, 'after_dashboard.png')
    );

    console.log('All screenshots captured successfully!');
  } catch (err) {
    console.error('Screenshot error:', err);
  } finally {
    server.close();
    process.exit(0);
  }
});

