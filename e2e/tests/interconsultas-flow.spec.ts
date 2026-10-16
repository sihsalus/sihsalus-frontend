import { type APIResponse, expect } from '@playwright/test';
import { test } from '../utils/e2e-native-synthetic-fixtures';
import { FixtureAuthorizationError } from '../utils/e2e-synthetic-fixtures';

/**
 * Flujo completo de interconsultas (esm-interconsultas-app):
 *
 * 1. Doctor A solicita una interconsulta para un paciente (mismo contrato
 *    REST que usa el workspace request-interconsulta-workspace: encounter de
 *    solicitud + order del order type Interconsulta).
 * 2. Doctor B entra a Home > Interconsultas y ve la solicitud en la bandeja
 *    "Solicitadas" (ruteada por servicio destino / location origen).
 * 3. Doctor B la recibe → "Recibida / Pendiente", luego la recoge → "En atención".
 * 4. Doctor B la responde → estado "Respondida", con obs ligada a la orden.
 * 5. El chart del paciente (dashboard Interconsultas) muestra la solicitud y
 *    su respuesta.
 */

const INTERCONSULTA_ORDER_TYPE_UUID = 'f3c2e4b6-8b5a-11e5-8e9b-12345678901b';
const CARE_SETTING_UUID = '6f0c9a92-6f24-11e3-af88-005056821db0';
const ENCOUNTER_ROLE_UUID = '240b26f9-dd88-4172-823d-4a8bfeb7841f';

type OpenmrsResource = { uuid: string; display?: string };

async function readResponse(response: APIResponse) {
  if ([401, 403].includes(response.status())) {
    throw new FixtureAuthorizationError('FIXTURE_AUTHORIZATION_FAILED_RETAIN_JOURNAL');
  }
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function expectOk<T = unknown>(response: APIResponse, message: string): Promise<T> {
  const body = await readResponse(response);
  expect(response.ok(), `${message} (${response.status()}): ${JSON.stringify(body)?.slice(0, 600)}`).toBeTruthy();
  return body as T;
}

test('interconsulta: solicitud, bandeja, pickup, respuesta y chart', async ({ page, api, nativeSyntheticFixture }) => {
  test.setTimeout(180_000);
  const { patientUuid, visitUuid, familyName, locationUuid, providerUuid, serviceConcept, encounterTypeUuid } =
    nativeSyntheticFixture;
  const patient = { uuid: patientUuid };
  const visit = { uuid: visitUuid };
  const location = { uuid: locationUuid };
  const provider = { uuid: providerUuid };

  // Mismo contrato que createInterconsulta() del módulo
  const encounter = await expectOk<OpenmrsResource>(
    await api.post('encounter', {
      maxRedirects: 0,
      maxRetries: 0,
      data: {
        encounterDatetime: new Date().toISOString(),
        patient: patient.uuid,
        visit: visit.uuid,
        encounterType: encounterTypeUuid,
        location: location.uuid,
        encounterProviders: [{ encounterRole: ENCOUNTER_ROLE_UUID, provider: provider.uuid }],
      },
    }),
    'Expected request encounter creation to succeed',
  );

  const order = await expectOk<OpenmrsResource>(
    await api.post('order', {
      maxRedirects: 0,
      maxRetries: 0,
      data: {
        action: 'NEW',
        type: 'order',
        patient: patient.uuid,
        careSetting: CARE_SETTING_UUID,
        orderer: provider.uuid,
        encounter: encounter.uuid,
        concept: serviceConcept.uuid,
        orderType: INTERCONSULTA_ORDER_TYPE_UUID,
        urgency: 'ROUTINE',
        instructions: 'E2E: evaluación por especialidad solicitada por Doctor A',
      },
    }),
    'Expected interconsulta order creation to succeed',
  );

  // ---------- Doctor B: Home > Interconsultas ----------
  await page.goto('home/interconsultas');
  await page.waitForLoadState('networkidle').catch(() => null);

  // Bandeja "Solicitadas" activa por defecto: buscar al paciente.
  // getByRole solo matchea el tabpanel visible (los demás están ocultos).
  const activePanel = () => page.getByRole('tabpanel');
  const traySearch = () =>
    activePanel().getByRole('searchbox', {
      name: /^(Paciente, orden, solicitante o motivo|Patient, order, requester or reason)$/i,
    });
  const searchBox = traySearch();
  await expect(searchBox).toBeVisible({ timeout: 30_000 });
  await searchBox.fill(familyName);

  const requestedRow = activePanel().getByRole('row', { name: new RegExp(familyName, 'i') });
  await expect(requestedRow).toBeVisible({ timeout: 15_000 });

  // ---------- Doctor B recibe la solicitud ----------
  // Acciones es la última columna de la tabla desplazable; click() la lleva a la vista.
  await requestedRow.getByRole('button', { name: /^(Acciones para|Actions for) /i }).click({ timeout: 15_000 });
  await page.getByRole('menuitem', { name: /^(Recibir|Receive)$/i }).click({ timeout: 15_000 });
  const receiveDialog = page.getByRole('dialog');
  await receiveDialog.getByRole('button', { name: /^(Recibir|Receive)$/i }).click({ timeout: 15_000 });

  await expect
    .poll(
      async () => {
        const orderResponse = await api.get(`order/${order.uuid}?v=custom:(fulfillerStatus)`);
        const payload = (await readResponse(orderResponse)) as { fulfillerStatus?: string };
        return payload?.fulfillerStatus;
      },
      { timeout: 15_000 },
    )
    .toBe('RECEIVED');
  await expect(receiveDialog).not.toBeVisible({ timeout: 15_000 });

  await page.getByRole('tab', { name: /^(Recibidas \/ Pendientes|Received \/ Pending)$/i }).click({ timeout: 15_000 });
  await expect(traySearch()).toBeVisible({ timeout: 15_000 });
  await traySearch().fill(familyName);
  const receivedRow = activePanel().getByRole('row', { name: new RegExp(familyName, 'i') });
  await expect(receivedRow).toBeVisible({ timeout: 15_000 });

  // ---------- Doctor B la recoge (Atender) ----------
  await receivedRow.getByRole('button', { name: /^(Acciones para|Actions for) /i }).click({ timeout: 15_000 });
  await page.getByRole('menuitem', { name: /^(Atender \(recoger\)|Attend \(pick up\))$/i }).click({ timeout: 15_000 });
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /Atender \(recoger\)|Attend \(pick up\)/i })
    .click({ timeout: 15_000 });

  // Estado pasa a En atención (verificación de contrato + UI)
  await expect
    .poll(
      async () => {
        const orderResponse = await api.get(`order/${order.uuid}?v=custom:(fulfillerStatus)`);
        const payload = (await readResponse(orderResponse)) as { fulfillerStatus?: string };
        return payload?.fulfillerStatus;
      },
      { timeout: 15_000 },
    )
    .toBe('IN_PROGRESS');

  await page.getByRole('tab', { name: /En atención|In progress/i }).click({ timeout: 15_000 });
  const inProgressSearch = traySearch();
  await expect(inProgressSearch).toBeVisible({ timeout: 15_000 });
  await inProgressSearch.fill(familyName);
  const inProgressRow = activePanel().getByRole('row', { name: new RegExp(familyName, 'i') });
  await expect(inProgressRow).toBeVisible({ timeout: 15_000 });

  // ---------- Doctor B responde / completa ----------
  await inProgressRow.getByRole('button', { name: /^(Acciones para|Actions for) /i }).click({ timeout: 15_000 });
  await page.getByRole('menuitem', { name: /Responder|Respond/i }).click({ timeout: 15_000 });
  const respondDialog = page.getByRole('dialog');
  await respondDialog
    .locator('#respond-respuesta')
    .fill('E2E: paciente evaluado por el servicio destino, sin hallazgos agudos.', { timeout: 15_000 });
  await respondDialog.locator('#respond-recomendaciones').fill('E2E: control ambulatorio en 30 días.');
  await respondDialog
    .getByRole('button', { name: /Responder y completar|Respond and complete/i })
    .click({ timeout: 15_000 });

  await expect
    .poll(
      async () => {
        const orderResponse = await api.get(`order/${order.uuid}?v=custom:(fulfillerStatus)`);
        const payload = (await readResponse(orderResponse)) as { fulfillerStatus?: string };
        return payload?.fulfillerStatus;
      },
      { timeout: 15_000 },
    )
    .toBe('COMPLETED');

  // La respuesta quedó ligada a la orden como obs del encounter de solicitud
  const encounterDetail = await expectOk<{
    obs?: Array<{ value?: unknown; order?: { uuid?: string } }>;
  }>(
    await api.get(`encounter/${encounter.uuid}?v=custom:(obs:(uuid,value,order:(uuid)))`),
    'Expected request encounter with response obs',
  );
  const responseObs = encounterDetail.obs?.filter((obs) => obs.order?.uuid === order.uuid) ?? [];
  expect(responseObs.length, 'Expected at least one response obs linked to the order').toBeGreaterThan(0);
  expect(JSON.stringify(responseObs)).toContain('paciente evaluado');

  // ---------- El chart del paciente muestra la interconsulta y su respuesta ----------
  await page.goto(`patient/${patient.uuid}/chart/interconsultas`);
  await page.waitForLoadState('networkidle').catch(() => null);

  // Si otro microfrontend falla al cargar, su notificación atrapa el foco; descartarla.
  await page
    .getByRole('button', { name: /close notification/i })
    .click({ timeout: 3_000 })
    .catch(() => null);

  const chartWidget = page.getByText(/Interconsultas|Interconsultations/i).first();
  await expect(chartWidget).toBeVisible({ timeout: 30_000 });

  // La solicitud aparece como item del acordeón con su estado
  const requestEntry = page.getByRole('button', { name: new RegExp(serviceConcept.display, 'i') }).first();
  await expect(requestEntry).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/Respondida|Responded/i).first()).toBeVisible({ timeout: 15_000 });

  // Al expandir se ve la respuesta registrada
  await requestEntry.click({ timeout: 15_000 });
  await expect(page.getByText(/paciente evaluado por el servicio destino/i).first()).toBeVisible({
    timeout: 15_000,
  });
});
