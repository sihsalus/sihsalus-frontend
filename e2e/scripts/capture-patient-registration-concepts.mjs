import fs from 'node:fs';
import path from 'node:path';
import { chromium, request } from '@playwright/test';
import { getOpenmrsBaseUrl, getSpaBaseUrl } from './e2e-urls.mjs';

const spaBase = getSpaBaseUrl('http://localhost:8090/openmrs/spa');
const username = process.env.E2E_USERNAME ?? 'admin';
const password = process.env.E2E_PASSWORD ?? 'Admin123';
const openmrsBase = getOpenmrsBaseUrl('http://localhost:8090/openmrs/spa');
const outputDir = path.resolve('e2e/screenshots');
const screenshotPath = path.join(outputDir, 'patient-registration-concepts-after-import.png');

fs.mkdirSync(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, locale: 'es-PE' });
const page = await context.newPage();
const conceptResponses = [];

page.on('response', async (response) => {
  const url = response.url();
  if (url.includes('/ws/rest/v1/concept/')) {
    conceptResponses.push({ status: response.status(), url });
  }
});

async function loginWithApiSession() {
  const authorization = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
  const api = await request.newContext({ extraHTTPHeaders: { Authorization: authorization } });
  const locations = await api.get(`${openmrsBase}/ws/rest/v1/location?v=default&limit=1`);
  const firstLocation = locations.ok() ? (await locations.json()).results?.[0]?.uuid : undefined;

  const session = await api.post(`${openmrsBase}/ws/rest/v1/session`, {
    data: { ...(firstLocation ? { sessionLocation: firstLocation } : {}), locale: 'es' },
    headers: { Authorization: authorization, 'Content-Type': 'application/json' },
  });
  if (!session.ok()) {
    throw new Error(`API login failed (${session.status()}): ${await session.text()}`);
  }

  const storageState = await api.storageState();
  await context.addCookies(storageState.cookies);
  await api.dispose();
}

await loginWithApiSession();
await page.goto(`${spaBase}/patient-registration`, { waitUntil: 'domcontentloaded' });
await page.waitForLoadState('networkidle', { timeout: 45_000 }).catch(() => null);
if (page.url().includes('/login')) {
  throw new Error('Authentication did not establish a browser session; still on login route');
}

for (const label of ['Datos de filiación', 'Historia clínica', 'Seguro']) {
  const button = page.getByRole('button', { name: new RegExp(label, 'i') }).first();
  if (await button.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await button.click().catch(() => null);
  }
}

await page.waitForTimeout(2500);
await page.screenshot({ path: screenshotPath, fullPage: true });

const failedConceptResponses = conceptResponses.filter((entry) => entry.status >= 400);
const bodyText = await page
  .locator('body')
  .innerText()
  .catch(() => '');
const visibleWarnings = bodyText
  .split('\n')
  .filter((line) =>
    /invalid answer concept set|does not have any concept answers|answer concept set UUID|concept answers/i.test(line),
  );

console.log(JSON.stringify({ screenshotPath, failedConceptResponses, visibleWarnings }, null, 2));

await browser.close();
