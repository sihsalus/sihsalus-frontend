import { chromium, request } from '@playwright/test';

const spaBase = (process.env.E2E_BASE_URL ?? 'http://localhost:8090/openmrs/spa').replace(/\/$/, '');
const openmrsBase = spaBase.replace(/\/spa$/, '');
const username = process.env.E2E_USERNAME ?? 'admin';
const password = process.env.E2E_PASSWORD ?? 'Admin123';
const runId = new Date().toISOString().replace(/\D/g, '').slice(4, 14);
const givenName = `Test${runId}`;
const familyName = 'Registro';
const familyName2 = 'Conceptos';
const dni = `98${runId.slice(-6)}`;

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

await fill('givenName', givenName);
await fill('middleName', 'QA');
await fill('familyName', familyName);
await fill('familyName2', familyName2);
await page.locator('label[for="gender-option-male"]').click({ force: true });
await fill('birthdate', '01/02/1990');
await fill('identifiers.dni.identifierValue', dni);

await fill('address.countyDistrict', 'IQUITOS');
await fill('address.cityVillage', 'NUEVO TEST');
await fill('address.address3', 'BARRIO QA');
await fill('address.address4', 'Jr Test 123');
await fill('attributes.14d4f066-15f5-102d-96e4-000c29c2a5d7', '999888777');

await fill('attributes.8d8718c2-c2cc-11de-8d13-0010c6dffd0f', 'Iquitos');
await choose('civilStatus', 'Soltero(a)');
await choose('ethnicity', 'Mestizo');
await fill('attributes.8d872150-c2cc-11de-8d13-0010c6dffd0f', 'Español');
await fill('attributes.8d871afc-c2cc-11de-8d13-0010c6dffd0f', 'Tester');
await choose('educationLevel', 'Secundaria completa');
await choose('religion', 'Católico');
await choose('bloodGroup', 'O');
await choose('rhFactor', 'Positivo');

await choose('medicalRecordStatus', 'Activa');
await choose('medicalRecordArchiveType', 'Archivo común');

await choose('insuranceType', 'Plan de atención SIS');
await fill('attributes.374b130f-7457-476f-87b1-f182aa77c434', `SIS-${runId}`);
await choose('insuranceAccreditationStatus', 'Vigente');
await fill('attributes.9b3df0a1-0c58-4f55-9868-9c38f1db1006', '2026-05-12 14:30');

await fill('attributes.4697d0e6-5b24-416b-aee6-708cd9a3a1db', 'Responsable QA');
await fill('attributes.70ce4571-2e2e-44da-a39f-9dae2a658606', '35');
await fill('attributes.a180fa5f-c44e-4490-a981-d7196b70c6ac', 'Padre');

await page.getByRole('button', { name: /Registrar paciente|Register patient/i }).click();
await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => null);
await page.waitForTimeout(5000);

const searchApi = await request.newContext({ extraHTTPHeaders: { Authorization: authorization } });
const search = await searchApi.get(`${openmrsBase}/ws/rest/v1/patient?q=${encodeURIComponent(givenName)}&v=full`);
const searchPayload = search.ok() ? await search.json() : { error: await search.text() };
await searchApi.dispose();

console.log(
  JSON.stringify(
    {
      input: { givenName, familyName, familyName2, dni },
      currentUrl: page.url(),
      patientPosts,
      failedResponses,
      consoleErrors,
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
