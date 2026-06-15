import { chromium, request } from '@playwright/test';

const spaBase = 'http://localhost:8090/openmrs/spa';
const openmrsBase = spaBase.replace(/\/spa$/, '');
const authorization = `Basic ${Buffer.from('admin:Admin123').toString('base64')}`;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, locale: 'es-PE' });
const api = await request.newContext({ extraHTTPHeaders: { Authorization: authorization }, ignoreHTTPSErrors: true });
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
const info = await page.evaluate(() => {
  const birthdateInputs = [...document.querySelectorAll('input')].filter((input) =>
    [input.name, input.id, input.placeholder, input.getAttribute('data-testid')]
      .filter(Boolean)
      .some((value) => /birth|date|fecha|dd\/mm/i.test(value)),
  );
  const submit = [...document.querySelectorAll('button')].find((button) =>
    /Registrar paciente|Register patient/i.test(button.textContent ?? ''),
  );
  return {
    birthdateInputs: birthdateInputs.map((input) => ({
      outerHTML: input.outerHTML,
      visible: !!(input.offsetWidth || input.offsetHeight || input.getClientRects().length),
      rect: input.getBoundingClientRect().toJSON?.() ?? {},
    })),
    submit: submit
      ? {
          text: submit.textContent,
          disabled: submit.disabled,
          outerHTML: submit.outerHTML,
        }
      : null,
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
