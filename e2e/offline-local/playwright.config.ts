import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './specs',
  testMatch: '**/*.spec.ts',
  workers: 1,
  retries: 0,
  timeout: 45000,
  expect: { timeout: 10000 },
  reporter: [['list']],
  outputDir: '../../test-results/offline-local',
  use: { baseURL: 'http://127.0.0.1:4183', serviceWorkers: 'allow', trace: 'retain-on-failure' },
  webServer: {
    command: 'node e2e/offline-local/server.cjs',
    url: 'http://127.0.0.1:4183/openmrs/spa/',
    stdout: 'pipe',
    cwd: '../..',
    timeout: 180000,
    reuseExistingServer: false,
  },
});
