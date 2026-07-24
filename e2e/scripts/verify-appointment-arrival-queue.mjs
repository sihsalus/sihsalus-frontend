import { chromium, request } from '@playwright/test';
import { getOpenmrsBaseUrl, getSpaBaseUrl } from './e2e-urls.mjs';

const spaBase = getSpaBaseUrl();
const openmrsBase = getOpenmrsBaseUrl(spaBase);
const username = process.env.E2E_USERNAME;
const password = process.env.E2E_PASSWORD;
const patientUuid = process.env.E2E_PATIENT_UUID;
const patientName = process.env.E2E_PATIENT_NAME;
const appointmentUuid = process.env.E2E_APPOINTMENT_UUID;
const expectedQueueUuid = process.env.E2E_QUEUE_UUID;
const expectedLocationUuid = process.env.E2E_LOCATION_UUID;
const expectedVisitTypeUuid = process.env.E2E_VISIT_TYPE_UUID;
const appointmentVisitAttributeTypeUuid =
  process.env.E2E_APPOINTMENT_VISIT_ATTRIBUTE_TYPE_UUID ?? '193508ab-20c6-5291-9f23-0257335eaabd';
const ignoreHTTPSErrors = process.env.E2E_IGNORE_HTTPS_ERRORS === 'true';

const requiredValues = {
  E2E_USERNAME: username,
  E2E_PASSWORD: password,
  E2E_PATIENT_UUID: patientUuid,
  E2E_PATIENT_NAME: patientName,
  E2E_APPOINTMENT_UUID: appointmentUuid,
  E2E_QUEUE_UUID: expectedQueueUuid,
  E2E_LOCATION_UUID: expectedLocationUuid,
  E2E_VISIT_TYPE_UUID: expectedVisitTypeUuid,
};
const missingValues = Object.entries(requiredValues)
  .filter(([, value]) => !value)
  .map(([name]) => name);

if (missingValues.length) {
  throw new Error(`Missing required environment variables: ${missingValues.join(', ')}`);
}

const authorization = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const api = await request.newContext({
  ignoreHTTPSErrors,
  extraHTTPHeaders: { Authorization: authorization },
});
const sessionResponse = await api.post(`${openmrsBase}/ws/rest/v1/session`, {
  data: { sessionLocation: expectedLocationUuid, locale: 'es' },
  headers: { Authorization: authorization, 'Content-Type': 'application/json' },
});
if (!sessionResponse.ok()) {
  throw new Error(`Could not establish the OpenMRS session (${sessionResponse.status()}).`);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
  locale: 'es-PE',
  ignoreHTTPSErrors,
});
await context.addCookies((await api.storageState()).cookies);

const page = await context.newPage();
const failedResponses = [];
let consoleErrorCount = 0;
page.on('response', async (response) => {
  const url = response.url();
  if (response.status() >= 400 && (url.includes('/ws/rest/v1/') || url.includes('/ws/fhir2/'))) {
    failedResponses.push({
      status: response.status(),
      method: response.request().method(),
    });
  }
});
page.on('console', (message) => {
  if (message.type() === 'error' && !/ServiceWorker|SSL certificate/i.test(message.text())) {
    consoleErrorCount += 1;
  }
});

async function fetchJson(path) {
  const response = await api.get(`${openmrsBase}${path}`);
  if (!response.ok()) {
    throw new Error(`A verification request failed (${response.status()}).`);
  }
  return response.json();
}

async function waitForPersistedFlow(timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let lastState;

  while (Date.now() < deadline) {
    const [appointment, visits, queueEntries] = await Promise.all([
      fetchJson(`/ws/rest/v1/appointments/${appointmentUuid}`),
      fetchJson(
        `/ws/rest/v1/visit?patient=${patientUuid}&includeInactive=false&v=custom:(uuid,patient:(uuid),visitType:(uuid,display),location:(uuid,display),startDatetime,stopDatetime,attributes:(uuid,value,attributeType:(uuid,display),voided))`,
      ),
      fetchJson(
        `/ws/rest/v1/queue-entry?patient=${patientUuid}&v=custom:(uuid,patient:(uuid),queue:(uuid,name,location:(uuid)),visit:(uuid),startedAt,endedAt,voided)`,
      ),
    ]);

    const visit = visits.results?.find(
      (candidate) =>
        !candidate.stopDatetime &&
        candidate.location?.uuid === expectedLocationUuid &&
        candidate.visitType?.uuid === expectedVisitTypeUuid,
    );
    const queueEntry = queueEntries.results?.find(
      (candidate) =>
        !candidate.voided &&
        !candidate.endedAt &&
        candidate.queue?.uuid === expectedQueueUuid &&
        candidate.visit?.uuid === visit?.uuid,
    );
    const hasAppointmentLink = visit?.attributes?.some(
      (attribute) =>
        !attribute.voided &&
        attribute.attributeType?.uuid === appointmentVisitAttributeTypeUuid &&
        attribute.value === appointmentUuid,
    );

    lastState = {
      appointmentCheckedIn: appointment.status === 'CheckedIn',
      compatibleVisitFound: Boolean(visit),
      appointmentLinked: Boolean(hasAppointmentLink),
      configuredQueueEntryFound: Boolean(queueEntry),
    };

    if (appointment.status === 'CheckedIn' && visit && queueEntry && hasAppointmentLink) {
      return lastState;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`Arrival flow was not fully persisted: ${JSON.stringify(lastState)}`);
}

try {
  await page.goto(`${spaBase}/home/appointments`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => null);
  if (page.url().includes('/login')) {
    throw new Error('Authentication did not establish a browser session; still on login route.');
  }
  await page
    .getByRole('button', { name: /close notification/i })
    .click()
    .catch(() => null);

  const appointmentRow = page.getByRole('row').filter({ hasText: patientName }).first();
  await appointmentRow.waitFor({ state: 'visible', timeout: 30_000 });
  await appointmentRow.getByRole('button', { name: /Registrar llegada/i }).click();

  const sendToQueueButton = page.getByRole('button', { name: /Enviar a cola de espera/i });
  await sendToQueueButton.waitFor({ state: 'visible', timeout: 15_000 });
  await sendToQueueButton.click();

  await page.getByText(/Iniciar una consulta/i).waitFor({ state: 'visible', timeout: 20_000 });
  await page.locator('#queueLocation').waitFor({ state: 'visible', timeout: 20_000 });
  await page.locator('#service').waitFor({ state: 'visible', timeout: 20_000 });
  await page
    .getByRole('radio', { name: /Normal|No urgente|Urgente/i })
    .first()
    .waitFor({
      state: 'visible',
      timeout: 20_000,
    });
  const visitPostPromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && /\/ws\/rest\/v1\/visit\/?$/.test(new URL(response.url()).pathname),
    { timeout: 20_000 },
  );
  await page.getByRole('button', { name: /Iniciar consulta|Agregar paciente a la cola/i }).click();
  const visitPost = await visitPostPromise;
  if (!visitPost.ok()) {
    throw new Error(`Visit creation failed (${visitPost.status()}): ${await visitPost.text()}`);
  }

  const persisted = await waitForPersistedFlow();
  console.log(
    JSON.stringify(
      {
        persisted,
        failedResponses,
        consoleErrorCount,
      },
      null,
      2,
    ),
  );
} catch (error) {
  const visibleAlertCount = await page
    .locator('[role="alert"]:visible, .cds--inline-notification:visible')
    .count()
    .catch(() => 0);
  const visibleButtonCount = await page
    .getByRole('button')
    .count()
    .catch(() => 0);
  console.error(
    JSON.stringify(
      {
        errorType: error instanceof Error ? error.name : 'UnknownError',
        visibleAlertCount,
        visibleButtonCount,
        failedResponses,
        consoleErrorCount,
      },
      null,
      2,
    ),
  );
  throw error;
} finally {
  await browser.close();
  await api.dispose();
}
