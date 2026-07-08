import { type APIRequestContext, type APIResponse, expect, type PlaywrightWorkerArgs, test } from '@playwright/test';
import { getE2ECredentials } from '../utils/e2e-api';
import { getOpenmrsRestBaseUrl, shouldIgnoreHTTPSErrors } from '../utils/e2e-urls';

/**
 * Flujo completo de interconsultas (esm-interconsultas-app):
 *
 * 1. Doctor A solicita una interconsulta para un paciente (mismo contrato
 *    REST que usa el workspace request-interconsulta-workspace: encounter de
 *    solicitud + order del order type Interconsulta).
 * 2. Doctor B entra a Home > Interconsultas y ve la solicitud en la bandeja
 *    "Solicitadas" (ruteada por servicio destino / location origen).
 * 3. Doctor B la recoge (Atender) → estado "En atención".
 * 4. Doctor B la responde → estado "Respondida", con obs ligada a la orden.
 * 5. El chart del paciente (dashboard Interconsultas) muestra la solicitud y
 *    su respuesta.
 */

const INTERCONSULTA_ORDER_TYPE_UUID = 'f3c2e4b6-8b5a-11e5-8e9b-12345678901b';
const CARE_SETTING_UUID = '6f0c9a92-6f24-11e3-af88-005056821db0';
const REQUEST_ENCOUNTER_TYPE_UUID = 'e4834799-7f43-4552-a6f3-2656880ca52f';
const FALLBACK_ENCOUNTER_TYPE_UUID = '39da3525-afe4-45ff-8977-c53b7b359158';
const ENCOUNTER_ROLE_UUID = '240b26f9-dd88-4172-823d-4a8bfeb7841f';
const DESTINATION_SERVICE_CONCEPT_SET_UUID = '4bf3f465-ac91-44fa-9b1f-173daf0c89a0';
const IDENTIFIER_SOURCE_UUID = '8549f706-7e85-4c1d-9424-217d50a2988b';
const IDENTIFIER_TYPE_UUID = '05a29f94-c0ed-11e2-94be-8c13b969e334';

type OpenmrsResource = { uuid: string; display?: string };
type OpenmrsSearchResponse<T> = { results?: Array<T> };

type CreatedState = {
  patientUuid?: string;
  visitUuid?: string;
  encounterUuid?: string;
  orderUuid?: string;
};

async function readResponse(response: APIResponse) {
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

async function createApiContext(playwright: PlaywrightWorkerArgs['playwright']) {
  const { username, password } = getE2ECredentials();
  return playwright.request.newContext({
    baseURL: getOpenmrsRestBaseUrl(),
    ignoreHTTPSErrors: shouldIgnoreHTTPSErrors(),
    httpCredentials: { username, password },
  });
}

async function getDefaultLocation(api: APIRequestContext) {
  const response = await api.get('location?v=default&limit=20');
  const payload = await expectOk<OpenmrsSearchResponse<OpenmrsResource>>(response, 'Expected locations');
  const configuredLocation = process.env.E2E_LOGIN_DEFAULT_LOCATION_UUID;
  const location =
    payload.results?.find((candidate) => candidate.uuid === configuredLocation) ??
    payload.results?.find((candidate) => candidate.uuid);
  expect(location?.uuid, 'Expected at least one location').toBeTruthy();
  return location!;
}

async function getDefaultVisitType(api: APIRequestContext) {
  const response = await api.get('visittype?v=default&limit=50');
  const payload = await expectOk<OpenmrsSearchResponse<OpenmrsResource>>(response, 'Expected visit types');
  const visitType =
    payload.results?.find((candidate) => candidate.display === 'Consulta Ambulatoria') ??
    payload.results?.find((candidate) => candidate.uuid);
  expect(visitType?.uuid, 'Expected at least one visit type').toBeTruthy();
  return visitType!;
}

async function getProvider(api: APIRequestContext) {
  const sessionResponse = await api.get('session?v=custom:(currentProvider:(uuid,display))');
  if (sessionResponse.ok()) {
    const session = (await sessionResponse.json()) as { currentProvider?: OpenmrsResource | null };
    if (session.currentProvider?.uuid) {
      return session.currentProvider;
    }
  }

  const response = await api.get('provider?v=custom:(uuid,display,retired)&limit=25');
  const payload = await expectOk<OpenmrsSearchResponse<OpenmrsResource & { retired?: boolean }>>(
    response,
    'Expected provider',
  );
  const provider =
    payload.results?.find((candidate) => !candidate.retired && !/^UNKNOWN\b/i.test(candidate.display ?? '')) ??
    payload.results?.find((candidate) => candidate.uuid);
  expect(provider?.uuid, 'Expected provider').toBeTruthy();
  return provider!;
}

async function getDestinationServiceConcept(api: APIRequestContext) {
  const setResponse = await api.get(
    `concept/${DESTINATION_SERVICE_CONCEPT_SET_UUID}?v=custom:(uuid,display,setMembers:(uuid,display))`,
  );
  if (setResponse.ok()) {
    const set = (await setResponse.json()) as { setMembers?: Array<OpenmrsResource> };
    const configuredService =
      set.setMembers?.find((candidate) => candidate.display === 'Consulta Ambulatoria') ??
      set.setMembers?.find((candidate) => candidate.uuid);
    if (configuredService?.uuid) {
      return configuredService;
    }
  }

  const response = await api.get('concept?q=interconsulta&v=custom:(uuid,display)&limit=20');
  const payload = await expectOk<OpenmrsSearchResponse<OpenmrsResource>>(response, 'Expected service concepts');
  const concept =
    payload.results?.find((candidate) => /interconsulta/i.test(candidate.display ?? '')) ?? payload.results?.[0];
  expect(concept?.uuid, 'Expected a destination service concept').toBeTruthy();
  return concept!;
}

async function getRequestEncounterType(api: APIRequestContext) {
  const response = await api.get(`encountertype/${REQUEST_ENCOUNTER_TYPE_UUID}`);
  return response.ok() ? REQUEST_ENCOUNTER_TYPE_UUID : FALLBACK_ENCOUNTER_TYPE_UUID;
}

async function createPatient(api: APIRequestContext, locationUuid: string, familyName: string) {
  const identifierResponse = await api.post(`idgen/identifiersource/${IDENTIFIER_SOURCE_UUID}/identifier`, {
    data: {},
  });
  const { identifier } = await expectOk<{ identifier: string }>(identifierResponse, 'Expected generated identifier');

  const patientResponse = await api.post('patient', {
    data: {
      identifiers: [{ identifier, identifierType: IDENTIFIER_TYPE_UUID, location: locationUuid, preferred: true }],
      person: {
        addresses: [{ address1: 'E2E', cityVillage: 'Lima', country: 'Peru', stateProvince: 'Lima' }],
        attributes: [],
        birthdate: '1985-05-05',
        birthdateEstimated: false,
        dead: false,
        gender: 'F',
        names: [{ familyName, givenName: 'E2E', preferred: true }],
      },
    },
  });
  return expectOk<OpenmrsResource>(patientResponse, 'Expected patient creation to succeed');
}

async function cleanup(api: APIRequestContext, created: CreatedState) {
  if (created.orderUuid) {
    await api.delete(`order/${created.orderUuid}`, { data: {} }).catch(() => null);
  }
  if (created.encounterUuid) {
    await api.delete(`encounter/${created.encounterUuid}`, { data: {} }).catch(() => null);
  }
  if (created.visitUuid) {
    await api.delete(`visit/${created.visitUuid}`, { data: {} }).catch(() => null);
  }
  if (created.patientUuid) {
    await api.delete(`patient/${created.patientUuid}`, { data: {} }).catch(() => null);
  }
}

test('interconsulta: solicitud, bandeja, pickup, respuesta y chart', async ({ page, playwright }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Full-flow E2E only needs one project run');
  test.setTimeout(180_000);

  const api = await createApiContext(playwright);
  const created: CreatedState = {};
  const familyName = `Interconsulta${Math.floor(Math.random() * 100000)}`;

  try {
    // ---------- Doctor A: solicita la interconsulta ----------
    const [location, visitType, provider, serviceConcept, encounterTypeUuid] = await Promise.all([
      getDefaultLocation(api),
      getDefaultVisitType(api),
      getProvider(api),
      getDestinationServiceConcept(api),
      getRequestEncounterType(api),
    ]);

    const patient = await createPatient(api, location.uuid, familyName);
    created.patientUuid = patient.uuid;

    const visit = await expectOk<OpenmrsResource>(
      await api.post('visit', {
        data: {
          startDatetime: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
          patient: patient.uuid,
          location: location.uuid,
          visitType: visitType.uuid,
          attributes: [],
        },
      }),
      'Expected visit creation to succeed',
    );
    created.visitUuid = visit.uuid;

    // Mismo contrato que createInterconsulta() del módulo
    const encounter = await expectOk<OpenmrsResource>(
      await api.post('encounter', {
        data: {
          encounterDatetime: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          patient: patient.uuid,
          visit: visit.uuid,
          encounterType: encounterTypeUuid,
          location: location.uuid,
          encounterProviders: [{ encounterRole: ENCOUNTER_ROLE_UUID, provider: provider.uuid }],
        },
      }),
      'Expected request encounter creation to succeed',
    );
    created.encounterUuid = encounter.uuid;

    const order = await expectOk<OpenmrsResource>(
      await api.post('order', {
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
    created.orderUuid = order.uuid;

    // ---------- Doctor B: Home > Interconsultas ----------
    await page.goto('home/interconsultas');
    await page.waitForLoadState('networkidle').catch(() => null);

    // Bandeja "Solicitadas" activa por defecto: buscar al paciente.
    // getByRole solo matchea el tabpanel visible (los demás están ocultos).
    const activePanel = () => page.getByRole('tabpanel');
    const searchBox = activePanel().getByPlaceholder(/Buscar en esta lista|Search this list/i);
    await expect(searchBox).toBeVisible({ timeout: 30_000 });
    await searchBox.fill(familyName);

    const requestedRow = activePanel().getByRole('row', { name: new RegExp(familyName, 'i') });
    await expect(requestedRow).toBeVisible({ timeout: 15_000 });

    // ---------- Doctor B la recoge (Atender) ----------
    await requestedRow.getByRole('button', { name: /Acciones|Actions|Options/i }).click({ timeout: 15_000 });
    await page.getByRole('menuitem', { name: /Atender|Attend/i }).click({ timeout: 15_000 });
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
    const inProgressSearch = activePanel().getByPlaceholder(/Buscar en esta lista|Search this list/i);
    await expect(inProgressSearch).toBeVisible({ timeout: 15_000 });
    await inProgressSearch.fill(familyName);
    const inProgressRow = activePanel().getByRole('row', { name: new RegExp(familyName, 'i') });
    await expect(inProgressRow).toBeVisible({ timeout: 15_000 });

    // ---------- Doctor B responde / completa ----------
    await inProgressRow.getByRole('button', { name: /Acciones|Actions|Options/i }).click({ timeout: 15_000 });
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
    const requestEntry = page
      .getByRole('button', { name: new RegExp(serviceConcept.display ?? 'interconsulta', 'i') })
      .first();
    await expect(requestEntry).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Respondida|Responded/i).first()).toBeVisible({ timeout: 15_000 });

    // Al expandir se ve la respuesta registrada
    await requestEntry.click({ timeout: 15_000 });
    await expect(page.getByText(/paciente evaluado por el servicio destino/i).first()).toBeVisible({
      timeout: 15_000,
    });
  } finally {
    await cleanup(api, created);
    await api.dispose();
  }
});
