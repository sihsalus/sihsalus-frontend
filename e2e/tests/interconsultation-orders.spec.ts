import { type APIResponse, expect } from '@playwright/test';
import { test } from '../utils/e2e-native-synthetic-fixtures';
import { FixtureAuthorizationError } from '../utils/e2e-synthetic-fixtures';

const INTERCONSULTATION_ORDER_TYPE_UUID = 'f3c2e4b6-8b5a-11e5-8e9b-12345678901b';
const CARE_SETTING_UUID = '6f0c9a92-6f24-11e3-af88-005056821db0';
const ENCOUNTER_ROLE_UUID = '240b26f9-dd88-4172-823d-4a8bfeb7841f';

type OpenmrsResource = {
  uuid: string;
  display?: string;
};

type OpenmrsSearchResponse<T> = {
  results?: Array<T>;
};

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

test('creates an interconsultation order and picks it up through fulfiller status', async ({
  api,
  nativeSyntheticFixture,
}) => {
  const {
    patientUuid,
    visitUuid,
    locationUuid,
    providerUuid,
    serviceConcept: concept,
    encounterTypeUuid,
  } = nativeSyntheticFixture;
  const patient = { uuid: patientUuid };
  const visit = { uuid: visitUuid };
  const location = { uuid: locationUuid };
  const provider = { uuid: providerUuid };

  const encounterResponse = await api.post('encounter', {
    maxRedirects: 0,
    maxRetries: 0,
    data: {
      encounterDatetime: new Date().toISOString(),
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
  const encounter = await expectOk<OpenmrsResource>(encounterResponse, 'Expected order encounter creation to succeed');

  const orderResponse = await api.post('order', {
    maxRedirects: 0,
    maxRetries: 0,
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
  const order = await expectOk<OpenmrsResource>(orderResponse, 'Expected interconsultation order creation to succeed');

  await expectOk(
    await api.post(`order/${order.uuid}/fulfillerdetails/`, {
      maxRedirects: 0,
      maxRetries: 0,
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
});
