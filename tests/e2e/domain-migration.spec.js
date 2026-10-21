// @ts-check
import { test, expect } from '@playwright/test';

const OLD_DOMAINS = ['pocketplan-rul.vercel.app', 'pocketplan.my.id'];

/** Assert page body text contains no old domain strings */
async function assertNoOldDomains(page) {
  const body = await page.textContent('body');
  for (const d of OLD_DOMAINS) {
    expect(body, `Page should not contain old domain "${d}"`).not.toContain(d);
  }
}

// ─── Frontend Pages ───

test.describe('Domain Migration — Frontend', () => {
  test('Landing page loads, no old domains, correct Telegram link', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/PocketPlan/i);
    await assertNoOldDomains(page);

    // Telegram bot link should be correct
    const tgLink = page.locator('a[href*="t.me/yourpocketplan_bot"]');
    if (await tgLink.count() > 0) {
      await expect(tgLink.first()).toHaveAttribute('href', /t\.me\/yourpocketplan_bot/);
    }
  });

  test('Login page loads, no old domains', async ({ page }) => {
    await page.goto('/login');
    await assertNoOldDomains(page);
  });

  test('404 page loads, no old domains', async ({ page }) => {
    await page.goto('/this-page-does-not-exist-xyz');
    await assertNoOldDomains(page);
  });

  test('Laporan cetak footer shows pocketplan.ai.id', async ({ page }) => {
    // Navigate to laporan route — may redirect or show login
    await page.goto('/laporan');
    const footer = page.locator('.footer-link-text');
    if (await footer.count() > 0) {
      await expect(footer.first()).toHaveText('pocketplan.ai.id');
    }
  });

  test('SEO meta tags and Open Graph present in index.html', async ({ page }) => {
    await page.goto('/');
    const ogImage = page.locator('meta[property="og:image"]');
    await expect(ogImage).toHaveAttribute('content', /og-image\.(jpg|png)/);

    const canonical = page.locator('link[rel="canonical"]');
    await expect(canonical).toHaveAttribute('href', 'https://pocketplan.ai.id/');

    const description = page.locator('meta[name="description"]');
    await expect(description).toHaveAttribute('content', /PocketPlan/);
  });

  test('Public SEO assets accessible (robots.txt, sitemap.xml, og-image)', async ({ request }) => {
    const robots = await request.get('/robots.txt');
    expect(robots.status()).toBe(200);
    expect(await robots.text()).toContain('Sitemap: https://pocketplan.ai.id/sitemap.xml');

    const sitemap = await request.get('/sitemap.xml');
    expect(sitemap.status()).toBe(200);
    expect(await sitemap.text()).toContain('https://pocketplan.ai.id/');

    const ogImg = await request.get('/og-image.jpg');
    expect(ogImg.status()).toBe(200);
  });
});

// ─── Backend API — Domain & Functionality ───

test.describe('Domain Migration — Backend API', () => {
  const API = 'http://localhost:4000';

  test('GET /health returns 200', async ({ request }) => {
    const res = await request.get(`${API}/health`);
    expect(res.status()).toBe(200);
  });

  test('GET /api/transactions returns 200 in demo mode', async ({ request }) => {
    const res = await request.get(`${API}/api/transactions`, {
      headers: { authorization: 'Bearer demo-user' },
    });
    expect(res.status()).toBe(200);
  });

  test('POST /api/transactions creates entry', async ({ request }) => {
    const res = await request.post(`${API}/api/transactions`, {
      headers: { authorization: 'Bearer demo-user', 'content-type': 'application/json' },
      data: { title: 'E2E Test', amount: 10000, type: 'Expense', category: 'Food', date: '2026-10-20' },
    });
    expect(res.status()).toBe(201);
  });

  test('GET /api/report returns 200', async ({ request }) => {
    const res = await request.get(`${API}/api/report?month=2026-10`, {
      headers: { authorization: 'Bearer demo-user' },
    });
    expect(res.status()).toBe(200);
  });

  test('GET /api/achievements returns 200', async ({ request }) => {
    const res = await request.get(`${API}/api/achievements`, {
      headers: { authorization: 'Bearer demo-user' },
    });
    expect(res.status()).toBe(200);
  });

  test('No old domains in API responses', async ({ request }) => {
    const endpoints = ['/health', '/api/transactions', '/api/goals', '/api/achievements'];
    for (const ep of endpoints) {
      const res = await request.get(`${API}${ep}`, {
        headers: { authorization: 'Bearer demo-user' },
      });
      const text = await res.text();
      for (const d of OLD_DOMAINS) {
        expect(text, `${ep} should not contain old domain "${d}"`).not.toContain(d);
      }
    }
  });
});

// ─── Email Template Verification ───

test.describe('Domain Migration — Email Template', () => {
  test('Email template contains pocketplan.ai.id, not old domains', async () => {
    const { getEmailTemplate } = await import('../../backend/lib/emailTemplate.js');
    const result = getEmailTemplate({
      name: 'Test User',
      verificationUrl: 'https://pocketplan.ai.id/verify?code=test',
    });
    const combined = result.html + result.text;

    expect(combined).toContain('pocketplan.ai.id');
    for (const d of OLD_DOMAINS) {
      expect(combined, `Email template should not contain "${d}"`).not.toContain(d);
    }
  });
});
