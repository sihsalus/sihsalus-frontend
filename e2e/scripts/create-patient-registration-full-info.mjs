import { chromium, request } from '@playwright/test';
import { getOpenmrsBaseUrl, getSpaBaseUrl } from './e2e-urls.mjs';

const spaBase = getSpaBaseUrl('http://localhost:8090/openmrs/spa');
const openmrsBase = getOpenmrsBaseUrl(spaBase);
const username = process.env.E2E_USERNAME;
const password = process.env.E2E_PASSWORD;
const ignoreHTTPSErrors = process.env.E2E_IGNORE_HTTPS_ERRORS === 'true';
const runId = new Date().toISOString().replace(/\D/g, '').slice(4, 14);
const givenName = `Test${runId.replace(/\d/g, (digit) => String.fromCharCode(65 + Number(digit)))}`;
const familyName = 'Registro';
const familyName2 = 'Conceptos';
const dni = `98${runId.slice(-6)}`;

if (!username || !password) {
  throw new Error('E2E_USERNAME and E2E_PASSWORD are required to create a patient through the UI.');
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
  locale: 'es-PE',
  ignoreHTTPSErrors,
});

const authorization = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const api = await request.newContext({ ignoreHTTPSErrors, extraHTTPHeaders: { Authorization: authorization } });
const locations = await api.get(`${openmrsBase}/ws/rest/v1/location?v=default&limit=1`);
const firstLocation = locations.ok() ? (await locations.json()).results?.[0]?.uuid : undefined;
const sessionResponse = await api.post(`${openmrsBase}/ws/rest/v1/session`, {
  data: { ...(firstLocation ? { sessionLocation: firstLocation } : {}), locale: 'es' },
  headers: { Authorization: authorization, 'Content-Type': 'application/json' },
});
if (!sessionResponse.ok()) {
  throw new Error(`Could not establish the OpenMRS session (${sessionResponse.status()}).`);
}
await context.addCookies((await api.storageState()).cookies);
await api.dispose();

const page = await context.newPage();
const failedResponses = [];
const consoleErrors = [];
const patientPosts = [];
page.on('response', async (response) => {
  const url = response.url();
  if (response.status() >= 400 && (url.includes('/ws/rest/v1/') || url.includes('/ws/fhir2/'))) {
    failedResponses.push({ status: response.status(), url, body: await response.text().catch(() => '') });
  }
  if (url.includes('/ws/rest/v1/patient') && response.request().method() === 'POST') {
    patientPosts.push({ status: response.status(), url, body: await response.text().catch(() => '') });
  }
});
page.on('console', (message) => {
  if (message.type() === 'error') {
    consoleErrors.push(message.text());
  }
});

function byName(name) {
  return page.locator(`[name="${name}"]`).first();
}

async function fill(name, value) {
  const locator = byName(name);
  if (await locator.isVisible().catch(() => false)) {
    await locator.scrollIntoViewIfNeeded();
    await locator.fill(value);
    return;
  }

  await page.evaluate(
    ({ name, value }) => {
      const input = document.querySelector(`[name="${CSS.escape(name)}"]`);
      if (!input) {
        throw new Error(`Field not found: ${name}`);
      }
      const prototype = Object.getPrototypeOf(input);
      const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
      setter?.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.dispatchEvent(new Event('blur', { bubbles: true }));
    },
    { name, value },
  );
}

async function choose(id, label) {
  const locator = page.locator(`select#${id}`);
  await locator.scrollIntoViewIfNeeded();
  await locator.selectOption({ label });
}

await page.goto(`${spaBase}/patient-registration`, { waitUntil: 'domcontentloaded' });
await page.waitForLoadState('networkidle', { timeout: 45_000 }).catch(() => null);
if (page.url().includes('/login')) {
  throw new Error('Authentication did not establish a browser session; still on login route');
}
await page
  .getByRole('button', { name: /close notification/i })
  .click()
  .catch(() => null);

await fill('givenName', givenName);
await fill('middleName', 'QA');
await fill('familyName', familyName);
await fill('familyName2', familyName2);
await page.locator('label[for="gender-option-male"]').click({ force: true });
await page.getByRole('spinbutton', { name: /día, Fecha de nacimiento/i }).fill('1');
await page.getByRole('spinbutton', { name: /mes, Fecha de nacimiento/i }).fill('2');
await page.getByRole('spinbutton', { name: /año, Fecha de nacimiento/i }).fill('1990');
await fill('identifiers.dni.identifierValue', dni);

await fill('address.countyDistrict', 'IQUITOS');
await fill('address.cityVillage', 'NUEVO TEST');
await fill('address.address3', 'BARRIO QA');
await fill('address.address4', 'Jr Test 123');
await fill('attributes.14d4f066-15f5-102d-96e4-000c29c2a5d7', '065123456');

await choose('civilStatus', 'Soltero(a)');
await choose('educationLevel', 'Secundaria completa');
await choose('religion', 'Católico');
await page.getByRole('radio', { name: /^O$/ }).check({ force: true });
await page.getByRole('radio', { name: /^Rh positivo$/i }).check({ force: true });

await choose('insuranceType', 'Plan de atención SIS');
await fill('attributes.374b130f-7457-476f-87b1-f182aa77c434', `SIS-${runId}`);
await choose('insuranceAccreditationStatus', 'Vigente');

await page.getByRole('button', { name: /Registrar paciente|Register patient/i }).click();
await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => null);
await page.waitForTimeout(5000);

const searchApi = await request.newContext({
  ignoreHTTPSErrors,
  extraHTTPHeaders: { Authorization: authorization },
});
const search = await searchApi.get(`${openmrsBase}/ws/rest/v1/patient?q=${encodeURIComponent(givenName)}&v=full`);
const searchPayload = search.ok() ? await search.json() : { error: await search.text() };
await searchApi.dispose();
const validationMessages = await page
  .locator('[role="alert"]:visible, .cds--form-requirement:visible')
  .allTextContents()
  .then((messages) => messages.map((message) => message.trim()).filter(Boolean));
const invalidFields = await page.locator('input:invalid, select:invalid, textarea:invalid').evaluateAll((elements) =>
  elements.map((element) => ({
    id: element.id,
    name: element.getAttribute('name'),
    validationMessage: element.validationMessage,
  })),
);

console.log(
  JSON.stringify(
    {
      input: { givenName, familyName, familyName2, dni },
      currentUrl: page.url(),
      patientPosts,
      failedResponses,
      consoleErrors,
      validationMessages,
      invalidFields,
      foundPatients: searchPayload.results?.map((patient) => ({
        uuid: patient.uuid,
        display: patient.display,
        identifiers: patient.identifiers?.map((identifier) => identifier.display),
        attributes: patient.person?.attributes?.length,
      })),
    },
    null,
    2,
  ),
);

await browser.close();

if (!searchPayload.results?.length) {
  throw new Error('Patient registration did not persist a patient.');
}
