import { defineConfig } from '@playwright/test';
import dotenv from 'dotenv';
import { shouldIgnoreHTTPSErrors } from '../utils/e2e-urls';
import { loadOfflineLaptopGateConfig } from './gate-config';

dotenv.config();

const gateConfig = loadOfflineLaptopGateConfig();

export default defineConfig({
  testDir: './specs',
  timeout: 180_000,
  expect: {
    timeout: 30_000,
  },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  globalSetup: require.resolve('../global-setup'),
  reporter: [['list'], ['html', { open: 'never', outputFolder: '../../playwright-report/offline-laptop' }]],
  outputDir: '../../test-results/offline-laptop',
  use: {
    baseURL: `${gateConfig.spaBaseUrl}/`,
    storageState: 'e2e/storage-state.json',
    ignoreHTTPSErrors: shouldIgnoreHTTPSErrors(),
    serviceWorkers: 'allow',
    // Credentialed Playwright traces include raw Cookie/Set-Cookie headers.
    // This clinical gate emits only the explicit, sanitized JSON attachments.
    screenshot: 'off',
    trace: 'off',
    video: 'off',
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    {
      name: 'Google Chrome Stable',
      use: { channel: 'chrome' },
    },
    {
      name: 'Microsoft Edge Stable',
      use: { channel: 'msedge' },
    },
  ],
});
