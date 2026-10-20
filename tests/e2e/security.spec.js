// @ts-check
import { test, expect } from '@playwright/test';

const API = 'http://localhost:4000';
const ADMIN_SECRET = 'test-admin-secret';
const WEBHOOK_SECRET = 'test-webhook-secret';

// ─── Security Headers (Helmet) ───

test.describe('Security — Helmet Headers', () => {
  test('Response includes security headers', async ({ request }) => {
    const res = await request.get(`${API}/health`);
    const headers = res.headers();

    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBeTruthy();
    expect(headers['x-xss-protection']).toBeTruthy();
  });
});

// ─── CORS ───

test.describe('Security — CORS', () => {
  test('CORS allows configured origin', async ({ request }) => {
    const res = await request.get(`${API}/health`, {
      headers: { origin: 'http://localhost:4173' },
    });
    expect(res.status()).toBe(200);
    const acao = res.headers()['access-control-allow-origin'];
    expect(acao).toBe('http://localhost:4173');
  });
});

// ─── Admin Endpoint Auth ───

test.describe('Security — Admin Auth', () => {
  const adminEndpoints = [
    { method: 'GET', path: '/api/cron/reminders?type=morning' },
    { method: 'POST', path: '/api/admin/test-reminder' },
    { method: 'POST', path: '/api/admin/sync-commands' },
    { method: 'POST', path: '/api/admin/fix-stale-links' },
    { method: 'POST', path: '/api/admin/cleanup-stale-telegram' },
    { method: 'GET', path: '/api/admin/cron-status' },
  ];

  for (const ep of adminEndpoints) {
    test(`${ep.method} ${ep.path} returns 403 without auth`, async ({ request }) => {
      const res = ep.method === 'GET'
        ? await request.get(`${API}${ep.path}`)
        : await request.post(`${API}${ep.path}`);
      expect(res.status()).toBe(403);
    });
  }

  test('Admin endpoint rejects wrong header name', async ({ request }) => {
    const res = await request.get(`${API}/api/admin/cron-status`, {
      headers: { 'x-custom-header': ADMIN_SECRET },
    });
    expect(res.status()).toBe(403);
  });

  test('Admin endpoint accepts correct auth', async ({ request }) => {
    const res = await request.get(`${API}/api/admin/cron-status`, {
      headers: { authorization: `Bearer ${ADMIN_SECRET}` },
    });
    expect(res.status()).toBe(200);
  });

  test('Cron-status response does not leak secret hints', async ({ request }) => {
    const res = await request.get(`${API}/api/admin/cron-status`, {
      headers: { authorization: `Bearer ${ADMIN_SECRET}` },
    });
    const body = await res.json();
    expect(body.cronSecretHint).toBeUndefined();
    expect(body.adminSecretHint).toBeUndefined();
    expect(body.webhookSecretConfigured).toBeUndefined();
  });
});

// ─── Webhook Auth ───

test.describe('Security — Webhook', () => {
  test('Webhook rejects missing secret header', async ({ request }) => {
    const res = await request.post(`${API}/api/telegram-webhook`, {
      data: { update_id: 1 },
    });
    expect(res.status()).toBe(403);
  });

  test('Webhook rejects wrong secret', async ({ request }) => {
    const res = await request.post(`${API}/api/telegram-webhook`, {
      headers: { 'x-telegram-bot-api-secret-token': 'wrong-secret' },
      data: { update_id: 1 },
    });
    expect(res.status()).toBe(403);
  });
});

// ─── Input Validation ───

test.describe('Security — Input Validation', () => {
  const authHeader = { authorization: 'Bearer demo-user', 'content-type': 'application/json' };

  test('Transaction rejects invalid type', async ({ request }) => {
    const res = await request.post(`${API}/api/transactions`, {
      headers: authHeader,
      data: { title: 'Bad', amount: 100, type: 'Transfer', category: 'Food', date: '2026-10-20' },
    });
    expect(res.status()).toBe(400);
  });

  test('Transaction rejects negative amount', async ({ request }) => {
    const res = await request.post(`${API}/api/transactions`, {
      headers: authHeader,
      data: { title: 'Bad', amount: -100, type: 'Expense', category: 'Food', date: '2026-10-20' },
    });
    expect(res.status()).toBe(400);
  });

  test('Transaction rejects bad date format', async ({ request }) => {
    const res = await request.post(`${API}/api/transactions`, {
      headers: authHeader,
      data: { title: 'Bad', amount: 100, type: 'Expense', category: 'Food', date: 'not-a-date' },
    });
    expect(res.status()).toBe(400);
  });

  test('Goal rejects empty name', async ({ request }) => {
    const res = await request.post(`${API}/api/goals`, {
      headers: authHeader,
      data: { name: '', target: 1000 },
    });
    expect(res.status()).toBe(400);
  });

  test('Goal rejects negative target', async ({ request }) => {
    const res = await request.post(`${API}/api/goals`, {
      headers: authHeader,
      data: { name: 'Bad Goal', target: -1 },
    });
    expect(res.status()).toBe(400);
  });

  test('Web-login rejects missing code', async ({ request }) => {
    const res = await request.post(`${API}/api/telegram/web-login`, {
      headers: { 'content-type': 'application/json' },
      data: {},
    });
    expect(res.status()).toBe(400);
  });

  test('Web-login rejects invalid code', async ({ request }) => {
    const res = await request.post(`${API}/api/telegram/web-login`, {
      headers: { 'content-type': 'application/json' },
      data: { code: 'XXXXXX' },
    });
    expect(res.status()).toBe(404);
  });

  test('Report rejects bad month format', async ({ request }) => {
    const res = await request.get(`${API}/api/report?month=invalid-date`, {
      headers: { authorization: 'Bearer demo-user' },
    });
    expect(res.status()).toBe(400);
  });
});

// ─── Error Sanitization ───

test.describe('Security — Error Sanitization', () => {
  test('Error responses do not leak stack traces', async ({ request }) => {
    // Hit a non-existent transaction to trigger error path
    const res = await request.delete(`${API}/api/transactions/nonexistent-id`, {
      headers: { authorization: 'Bearer demo-user' },
    });
    const text = await res.text();
    expect(text).not.toContain('node_modules');
    expect(text).not.toContain('at Object.');
    expect(text).not.toContain('at Module.');
  });
});

// ─── Rate Limiting ───

test.describe('Security — Rate Limiting', () => {
  test('Web-login endpoint rate-limits after 5 requests', async ({ request }) => {
    const results = [];
    for (let i = 0; i < 7; i++) {
      const res = await request.post(`${API}/api/telegram/web-login`, {
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '192.168.99.99',
        },
        data: { code: 'AAAAAA' },
      });
      results.push(res.status());
    }
    // At least one should be 429 (rate limited)
    expect(results.filter(s => s === 429).length).toBeGreaterThan(0);
  });
});
