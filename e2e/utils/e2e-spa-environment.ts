import { type Page } from '@playwright/test';

export async function isDevelopmentSpa(page: Pick<Page, 'evaluate'>): Promise<boolean> {
  const environment = await page.evaluate(() => (globalThis as typeof globalThis & { spaEnv?: unknown }).spaEnv);
  if (environment !== 'development' && environment !== 'production') {
    throw new Error('The effective E2E SPA environment must be development or production.');
  }
  return environment === 'development';
}
