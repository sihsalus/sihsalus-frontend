import { type APIRequestContext, type APIResponse, expect, type PlaywrightWorkerArgs, test } from '@playwright/test';
import { getE2ECredentials } from '../utils/e2e-api';
import { getOpenmrsRestBaseUrl, shouldIgnoreHTTPSErrors } from '../utils/e2e-urls';

const INTERCONSULTATION_ORDER_TYPE_UUID = 'f3c2e4b6-8b5a-11e5-8e9b-12345678901b';
const CARE_SETTING_UUID = '6f0c9a92-6f24-11e3-af88-005056821db0';
const REQUEST_ENCOUNTER_TYPE_UUID = 'e4834799-7f43-4552-a6f3-2656880ca52f';
const FALLBACK_ENCOUNTER_TYPE_UUID = '39da3525-afe4-45ff-8977-c53b7b359158';
const ENCOUNTER_ROLE_UUID = '240b26f9-dd88-4172-823d-4a8bfeb7841f';
const DESTINATION_SERVICE_CONCEPT_SET_UUID = '4bf3f465-ac91-44fa-9b1f-173daf0c89a0';
const IDENTIFIER_SOURCE_UUID = '8549f706-7e85-4c1d-9424-217d50a2988b';
const IDENTIFIER_TYPE_UUID = '05a29f94-c0ed-11e2-94be-8c13b969e334';

type CreatedState = {
  encounterUuid?: string;
  orderUuid?: string;
  patientUuid?: string;
  visit?: {
    uuid: string;
    location?: { uuid: string };
    startDatetime?: string;
    visitType?: { uuid: string };
  };
};

type OpenmrsResource = {
  uuid: string;
  display?: string;
};

type OpenmrsSearchResponse<T> = {
  results?: Array<T>;
};

type VisitResponse = {
  uuid: string;
  location?: { uuid: string };
  startDatetime?: string;
  visitType?: { uuid: string };
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
  const payload = await expectOk<OpenmrsSearchResponse<OpenmrsResource>>(
    response,
    'Expected locations to be available',
  );
  const configuredLocation = process.env.E2E_LOGIN_DEFAULT_LOCATION_UUID;
  const location =
    payload.results?.find((candidate) => candidate.uuid === configuredLocation) ??
    payload.results?.find((candidate) => candidate.uuid);

  expect(location?.uuid, 'Expected at least one location').toBeTruthy();
  return location!;
}

async function getDefaultVisitType(api: APIRequestContext) {
  const response = await api.get('visittype?v=default&limit=50');
  const payload = await expectOk<OpenmrsSearchResponse<OpenmrsResource>>(
    response,
    'Expected visit types to be available',
  );
  const visitType =
    payload.results?.find((candidate) => candidate.display === 'Consulta Ambulatoria') ??
    payload.results?.find((candidate) => candidate.uuid);

  expect(visitType?.uuid, 'Expected at least one visit type').toBeTruthy();
  return visitType!;
}

async function getAdminProvider(api: APIRequestContext) {
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
    'Expected provider to be available',
  );
  const provider =
    payload.results?.find((candidate) => !candidate.retired && !/^UNKNOWN\b/i.test(candidate.display ?? '')) ??
    payload.results?.find((candidate) => candidate.uuid);

  expect(provider?.uuid, 'Expected provider').toBeTruthy();
  return provider!;
}

async function getInterconsultationConcept(api: APIRequestContext) {
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

  const response = await api.get(
    'concept?q=interconsulta&v=custom:(uuid,display,datatype:(uuid,display),conceptClass:(uuid,display))&limit=20',
  );
  const payload = await expectOk<OpenmrsSearchResponse<OpenmrsResource>>(
    response,
    'Expected interconsultation concepts to be available',
  );
  const concept =
    payload.results?.find((candidate) => /interconsulta/i.test(candidate.display ?? '')) ??
    payload.results?.find((candidate) => candidate.uuid);

  expect(concept?.uuid, 'Expected at least one interconsultation concept').toBeTruthy();
  return concept!;
}

async function getRequestEncounterType(api: APIRequestContext) {
  const response = await api.get(`encountertype/${REQUEST_ENCOUNTER_TYPE_UUID}`);
  return response.ok() ? REQUEST_ENCOUNTER_TYPE_UUID : FALLBACK_ENCOUNTER_TYPE_UUID;
}

async function createPatient(api: APIRequestContext, locationUuid: string) {
  const identifierResponse = await api.post(`idgen/identifiersource/${IDENTIFIER_SOURCE_UUID}/identifier`, {
    data: {},
  });
  const { identifier } = await expectOk<{ identifier: string }>(
    identifierResponse,
    'Expected generated patient identifier',
  );
  const suffix = Math.floor(Math.random() * 100000);

  const patientResponse = await api.post('patient', {
    data: {
      identifiers: [
        {
          identifier,
          identifierType: IDENTIFIER_TYPE_UUID,
          location: locationUuid,
          preferred: true,
        },
      ],
      person: {
        addresses: [
          {
            address1: 'E2E',
            cityVillage: 'Lima',
            country: 'Peru',
            stateProvince: 'Lima',
          },
        ],
        attributes: [],
        birthdate: '1990-01-01',
        birthdateEstimated: false,
        dead: false,
        gender: 'M',
        names: [
          {
            familyName: `Interconsulta${suffix}`,
            givenName: 'E2E',
            preferred: true,
          },
        ],
      },
    },
  });

  return expectOk<OpenmrsResource>(patientResponse, 'Expected patient creation to succeed');
}

async function voidOrder(api: APIRequestContext, orderUuid: string) {
  const deleteResponse = await api.delete(`order/${orderUuid}`, { data: {} });
  if (deleteResponse.ok()) {
    return;
  }

  const orderResponse = await api.get(`order/${orderUuid}?v=custom:(uuid,voided)`);
  if (orderResponse.ok()) {
    const order = await orderResponse.json();
    if (order.voided) {
      return;
    }
  }

  const errorPayload = await readResponse(deleteResponse);
  throw new Error(`Could not void order ${orderUuid}: ${JSON.stringify(errorPayload)?.slice(0, 600)}`);
}

async function cleanup(api: APIRequestContext, created: CreatedState) {
  if (created.orderUuid) {
    await voidOrder(api, created.orderUuid);
  }

  if (created.encounterUuid) {
    await api.delete(`encounter/${created.encounterUuid}`, { data: {} });
  }

  if (created.visit?.uuid) {
    await api.post(`visit/${created.visit.uuid}`, {
      data: {
        location: created.visit.location?.uuid,
        startDatetime: created.visit.startDatetime,
        visitType: created.visit.visitType?.uuid,
        stopDatetime: new Date().toISOString(),
      },
    });
  }

  if (created.patientUuid) {
    await api.delete(`patient/${created.patientUuid}`, { data: {} });
  }
}

test('creates an interconsultation order and picks it up through fulfiller status', async ({
  playwright,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'API E2E only needs one project run');

  const api = await createApiContext(playwright);
  const created: CreatedState = {};

  try {
    const [location, visitType, provider, concept, encounterTypeUuid] = await Promise.all([
      getDefaultLocation(api),
      getDefaultVisitType(api),
      getAdminProvider(api),
      getInterconsultationConcept(api),
      getRequestEncounterType(api),
    ]);

    const patient = await createPatient(api, location.uuid);
    created.patientUuid = patient.uuid;

    const visitResponse = await api.post('visit', {
      data: {
        startDatetime: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        patient: patient.uuid,
        location: location.uuid,
        visitType: visitType.uuid,
        attributes: [],
      },
    });
    const visit = await expectOk<VisitResponse>(visitResponse, 'Expected visit creation to succeed');
    created.visit = visit;

    const encounterResponse = await api.post('encounter', {
      data: {
        encounterDatetime: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        patient: patient.uuid,
        visit: visit.uuid,
        encounterProviders: [
          {
            encounterRole: ENCOUNTER_ROLE_UUID,
            provider: provider.uuid,
          },
        ],
        location: location.uuid,
        encounterType: encounterTypeUuid,
      },
    });
    const encounter = await expectOk<OpenmrsResource>(
      encounterResponse,
      'Expected order encounter creation to succeed',
    );
    created.encounterUuid = encounter.uuid;

    const orderResponse = await api.post('order', {
      data: {
        action: 'NEW',
        type: 'order',
        patient: patient.uuid,
        careSetting: CARE_SETTING_UUID,
        orderer: provider.uuid,
        encounter: encounter.uuid,
        concept: concept.uuid,
        orderType: INTERCONSULTATION_ORDER_TYPE_UUID,
        instructions: 'E2E interconsulta pickup smoke',
        accessionNumber: null,
        urgency: 'ROUTINE',
        scheduledDate: null,
      },
    });
    const order = await expectOk<OpenmrsResource>(
      orderResponse,
      'Expected interconsultation order creation to succeed',
    );
    created.orderUuid = order.uuid;

    await expectOk(
      await api.post(`order/${order.uuid}/fulfillerdetails/`, {
        data: { fulfillerStatus: 'IN_PROGRESS' },
      }),
      'Expected interconsultation pickup to succeed',
    );

    const worklistResponse = await api.get(
      `order?orderTypes=${INTERCONSULTATION_ORDER_TYPE_UUID}&fulfillerStatus=IN_PROGRESS` +
        '&v=custom:(uuid,display,orderType:(uuid,display),patient:(uuid,display),encounter:(uuid,location:(uuid,display)),fulfillerStatus)',
    );
    const worklist = await expectOk<
      OpenmrsSearchResponse<{
        uuid: string;
        orderType?: OpenmrsResource;
        fulfillerStatus?: string;
        encounter?: { location?: OpenmrsResource };
      }>
    >(worklistResponse, 'Expected picked-up interconsultations query to succeed');
    const pickedOrder = worklist.results?.find((candidate) => candidate.uuid === order.uuid);

    expect(pickedOrder).toMatchObject({
      uuid: order.uuid,
      orderType: { uuid: INTERCONSULTATION_ORDER_TYPE_UUID },
      fulfillerStatus: 'IN_PROGRESS',
      encounter: { location: { uuid: location.uuid } },
    });
  } finally {
    await cleanup(api, created);
    await api.dispose();
  }
});
