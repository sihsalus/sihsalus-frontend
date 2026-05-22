import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config();

const configuredBaseUrl = process.env.E2E_BASE_URL ?? 'http://localhost:8080/openmrs/spa';
const BASE_URL = configuredBaseUrl.endsWith('/') ? configuredBaseUrl : `${configuredBaseUrl}/`;
const storageState = process.env.E2E_SKIP_AUTH === 'true' ? undefined : 'e2e/storage-state.json';
const webServerCommand = process.env.E2E_WEB_SERVER_COMMAND ?? 'yarn start:qlty';

export default defineConfig({
  testDir: './e2e/tests',
  timeout: 60_000,
  retries: 2,
  workers: 2,
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: BASE_URL,
    storageState,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'tablet', use: { viewport: { width: 1024, height: 768 } } },
    { name: 'mobile', use: { viewport: { width: 375, height: 812 } } },
  ],
  webServer: {
    command: webServerCommand,
    url: `${BASE_URL}login`,
    timeout: 120_000,
    reuseExistingServer: !!process.env.CI,
  },
});
