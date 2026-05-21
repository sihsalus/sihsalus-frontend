import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './specs',
  timeout: 60_000,
  expect: {
    timeout: 20_000,
  },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['junit', { outputFile: 'results.xml' }], ['html']] : [['list']],
  use: {
    trace: 'retain-on-failure',
  },
});
