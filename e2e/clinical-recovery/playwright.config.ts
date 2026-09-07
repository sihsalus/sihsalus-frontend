import path from 'node:path';
import { defineConfig } from '@playwright/test';

// Inventory only: no server, auth state, retries, artifacts or environment bypass.
export default defineConfig({
  testDir: './specs',
  globalSetup: path.resolve(__dirname, 'global-setup.ts'),
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: { serviceWorkers: 'block', trace: 'off', screenshot: 'off', video: 'off' },
  projects: [{ name: 'desktop' }],
});
