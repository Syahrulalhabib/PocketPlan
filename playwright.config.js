import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    headless: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  webServer: [
    {
      command: 'node tests/e2e/start-backend.js',
      port: 4000,
      reuseExistingServer: true,
      timeout: 15_000,
    },
    {
      command: 'npx vite preview --port 4173',
      port: 4173,
      cwd: 'frontend',
      reuseExistingServer: true,
      timeout: 15_000,
    },
  ],
});
