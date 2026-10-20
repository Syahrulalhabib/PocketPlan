/**
 * Start backend Express server in demo mode for E2E testing.
 * No Firebase, no external deps — in-memory data only.
 */
process.env.SKIP_FIREBASE_INIT = '1';
process.env.VERCEL = '1';
process.env.NODE_ENV = 'test';
process.env.FRONTEND_ORIGIN = 'http://localhost:4173';
process.env.CRON_SECRET = 'test-cron-secret';
process.env.ADMIN_SECRET = 'test-admin-secret';
process.env.TELEGRAM_WEBHOOK_SECRET = 'test-webhook-secret';

const { default: app } = await import('../../backend/index.js');

const server = app.listen(4000, () => {
  console.log('[E2E] Backend demo server on port 4000');
});

process.on('SIGTERM', () => server.close());
process.on('SIGINT', () => server.close());
