import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '../frontend/dist');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const MIME_TYPES = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  let filePath = path.join(distDir, reqPath);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) filePath = path.join(filePath, 'index.html');
  if (!fs.existsSync(filePath)) filePath = path.join(distDir, 'index.html');
  const mime = MIME_TYPES[path.extname(filePath)] || 'application/octet-stream';
  try {
    const data = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  } catch (err) {
    if (!res.headersSent) {
      res.writeHead(500);
      res.end('Error: ' + err.message);
    }
  }
});

const tempProfileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-audit-'));

server.listen(5310, async () => {
  console.log('Server up 5310');
  const chromeProcess = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    `--user-data-dir=${tempProfileDir}`,
    '--disable-gpu',
    '--no-sandbox',
    'about:blank'
  ]);

  let listRes, tabs;
  for (let attempt = 0; attempt < 15; attempt++) {
    try {
      listRes = await fetch('http://127.0.0.1:9222/json/list');
      tabs = await listRes.json();
      if (tabs && tabs.length > 0) break;
    } catch {
      await new Promise(r => setTimeout(r, 400));
    }
  }

  try {
    const pageTab = tabs.find(t => t.type === 'page') || tabs[0];
    const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
    await new Promise(r => { ws.onopen = r; });

    let id = 1;
    const send = (method, params = {}) => new Promise(resolve => {
      const msgId = id++;
      const handler = (event) => {
        const data = JSON.parse(event.data);
        if (data.id === msgId) {
          ws.removeEventListener('message', handler);
          resolve(data.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });

    await send('Page.enable');
    await send('Runtime.enable');

    const screensDir = path.resolve(__dirname, '../screenshots/audit');
    if (!fs.existsSync(screensDir)) fs.mkdirSync(screensDir, { recursive: true });

    const capture = async (url, outName, width, height, isDark = false, isDemo = false, scrollToBottom = false) => {
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });

      // Set storage before navigating to protected routes
      await send('Runtime.evaluate', {
        expression: `
          ${isDemo ? 'sessionStorage.setItem("pocketplan_demo_mode", "1");' : 'sessionStorage.removeItem("pocketplan_demo_mode");'}
          ${isDark ? 'localStorage.setItem("pp-theme", "dark"); document.documentElement.classList.add("theme-dark"); document.body?.classList.add("theme-dark");' : 'localStorage.removeItem("pp-theme"); document.documentElement.classList.remove("theme-dark"); document.body?.classList.remove("theme-dark");'}
        `
      });

      // Navigate
      await send('Page.navigate', { url });
      await new Promise(r => setTimeout(r, 600));

      // Wait until loading-screen is completely gone and form / view is rendered
      let waited = 0;
      while (waited < 8000) {
        await new Promise(r => setTimeout(r, 200));
        waited += 200;
        const check = await send('Runtime.evaluate', {
          expression: 'document.querySelector(".loading-screen") === null && (document.querySelector(".auth-panel") !== null || document.querySelector(".report-view") !== null || document.querySelector(".report-print-container") !== null || document.querySelector(".landing-page") !== null || document.querySelector(".goals-page") !== null || document.querySelector(".profile-identity-card") !== null || document.querySelector(".app-shell") !== null || document.querySelector(".landing-hero") !== null || document.querySelector(".landing-footer") !== null)'
        });
        if (check?.result?.value === true) break;
      }
      await new Promise(r => setTimeout(r, 600));

      if (scrollToBottom) {
        await send('Runtime.evaluate', { expression: 'window.scrollTo(0, 999999);' });
        await new Promise(r => setTimeout(r, 500));
        await send('Runtime.evaluate', { expression: 'document.querySelector(".landing-footer-bottom")?.scrollIntoView(false) || window.scrollTo(0, 999999);' });
        await new Promise(r => setTimeout(r, 800));
      }

      const res = await send('Page.captureScreenshot', { format: 'png' });
      const outPath = path.resolve(screensDir, `${outName}.png`);
      fs.writeFileSync(outPath, Buffer.from(res.data, 'base64'));
      console.log(`Saved: ${outName}.png`);
    };

    await capture('http://localhost:5310/login', 'after_login_desktop_light', 1280, 800, false);
    await capture('http://localhost:5310/login', 'after_login_desktop_dark', 1280, 800, true);
    await capture('http://localhost:5310/login', 'after_login_mobile_light', 375, 812, false);
    await capture('http://localhost:5310/login', 'after_login_mobile_dark', 375, 812, true);

    await capture('http://localhost:5310/registration', 'after_register_desktop_light', 1280, 800, false);
    await capture('http://localhost:5310/registration', 'after_register_desktop_dark', 1280, 800, true);
    await capture('http://localhost:5310/registration', 'after_register_mobile_light', 375, 812, false);
    await capture('http://localhost:5310/registration', 'after_register_mobile_dark', 375, 812, true);

    await capture('http://localhost:5310/reports', 'after_report_mobile_360', 360, 800, false, true);
    await capture('http://localhost:5310/reports/print', 'after_report_print_mobile_360', 360, 800, false, true);

    // Audit V2 captures
    await capture('http://localhost:5310/', 'audit_landing_desktop', 1280, 800, false);
    await capture('http://localhost:5310/', 'audit_landing_mobile_360', 360, 800, false);
    await capture('http://localhost:5310/', 'audit_footer_mobile_360', 360, 800, false, false, true);
    await capture('http://localhost:5310/goals', 'audit_goals_mobile_360', 360, 800, false, true);
    await capture('http://localhost:5310/profile', 'audit_profile_desktop', 1280, 800, false, true);
    await capture('http://localhost:5310/profile', 'audit_profile_mobile_360', 360, 800, false, true);

    // Test Backward Compatibility Redirects:
    console.log('--- Testing Backward Compatibility Redirects ---');
    await send('Page.navigate', { url: 'http://localhost:5310/laporan' });
    await new Promise(r => setTimeout(r, 800));
    let curUrl = await send('Runtime.evaluate', { expression: 'window.location.pathname' });
    console.log('/laporan redirects to:', curUrl?.result?.value);

    await send('Page.navigate', { url: 'http://localhost:5310/laporan/cetak?month=2026-10' });
    await new Promise(r => setTimeout(r, 800));
    curUrl = await send('Runtime.evaluate', { expression: 'window.location.pathname + window.location.search' });
    console.log('/laporan/cetak?month=2026-10 redirects to:', curUrl?.result?.value);

    await send('Page.navigate', { url: 'http://localhost:5310/pencapaian' });
    await new Promise(r => setTimeout(r, 800));
    curUrl = await send('Runtime.evaluate', { expression: 'window.location.pathname' });
    console.log('/pencapaian redirects to:', curUrl?.result?.value);

    ws.close();
  } catch (err) {
    console.error('Capture error:', err);
  } finally {
    chromeProcess.kill();
    server.close();
    try { fs.rmSync(tempProfileDir, { recursive: true, force: true }); } catch {}
    process.exit(0);
  }
});

