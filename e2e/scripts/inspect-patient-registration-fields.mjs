import { chromium, request } from '@playwright/test';

const spaBase = (process.env.E2E_BASE_URL ?? 'http://localhost:8090/openmrs/spa').replace(/\/$/, '');
const openmrsBase = spaBase.replace(/\/spa$/, '');
const username = process.env.E2E_USERNAME ?? 'admin';
const password = process.env.E2E_PASSWORD ?? 'Admin123';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, locale: 'es-PE' });

const authorization = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const api = await request.newContext({ extraHTTPHeaders: { Authorization: authorization } });
const locations = await api.get(`${openmrsBase}/ws/rest/v1/location?v=default&limit=1`);
const firstLocation = locations.ok() ? (await locations.json()).results?.[0]?.uuid : undefined;
await api.post(`${openmrsBase}/ws/rest/v1/session`, {
  data: { ...(firstLocation ? { sessionLocation: firstLocation } : {}), locale: 'es' },
  headers: { Authorization: authorization, 'Content-Type': 'application/json' },
});
await context.addCookies((await api.storageState()).cookies);
await api.dispose();

const page = await context.newPage();
await page.goto(`${spaBase}/patient-registration`, { waitUntil: 'domcontentloaded' });
await page.waitForLoadState('networkidle', { timeout: 45_000 }).catch(() => null);
await page.waitForTimeout(2000);

const fields = await page.evaluate(() => {
  function labelFor(el) {
    const id = el.getAttribute('id');
    const explicit = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent?.trim() : '';
    const wrapped = el.closest('label')?.textContent?.trim();
    const parentLabel = el.closest('.cds--form-item')?.querySelector('label')?.textContent?.trim();
    return explicit || wrapped || parentLabel || '';
  }
  return [...document.querySelectorAll('input, textarea, button[aria-haspopup], [role="combobox"], select')].map(
    (el) => ({
      tag: el.tagName.toLowerCase(),
      type: el.getAttribute('type'),
      id: el.getAttribute('id'),
      name: el.getAttribute('name'),
      role: el.getAttribute('role'),
      text: el.textContent?.trim().slice(0, 80),
      label: labelFor(el),
      placeholder: el.getAttribute('placeholder'),
      value: el.getAttribute('value'),
      ariaLabel: el.getAttribute('aria-label'),
    }),
  );
});

console.log(JSON.stringify(fields, null, 2));
await browser.close();
