import { openmrsFetch } from '@openmrs/esm-framework';

import type { ConfigObject } from '../config-schema';

import { saveRelationship } from './relationship.resources';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  openmrsFetch: vi.fn(),
  restBaseUrl: '/ws/rest/v1',
  showModal: vi.fn(),
  showSnackbar: vi.fn(),
}));

vi.mock('swr', () => ({
  mutate: vi.fn(),
}));

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

const patientUuid = '11111111-1111-4111-8111-111111111111';
const relativeUuid = '22222222-2222-4222-8222-222222222222';
const relationshipTypeUuid = '33333333-3333-4333-8333-333333333333';

const config = {
  defaultIdentifierSourceUuid: '44444444-4444-4444-8444-444444444444',
  defaultIDUuid: '55555555-5555-4555-8555-555555555555',
  maritalStatusUuid: '66666666-6666-4666-8666-666666666666',
  registrationEncounterUuid: '77777777-7777-4777-8777-777777777777',
  registrationObs: {
    encounterTypeUuid: null,
    encounterProviderRoleUuid: '88888888-8888-4888-8888-888888888888',
    registrationFormUuid: null,
  },
  contactPersonAttributesUuid: {
    telephone: '99999999-9999-4999-8999-999999999999',
    baselineHIVStatus: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    contactCreated: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    preferedPnsAproach: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    livingWithContact: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    contactipvOutcome: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    dataConsent: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
  },
} as ConfigObject;

const session = {
  sessionLocation: { uuid: 'location-uuid' },
  currentProvider: { uuid: 'provider-uuid' },
};

function expectLastRelationshipPayload(payload: Record<string, unknown>) {
  const [url, options] = mockOpenmrsFetch.mock.lastCall;

  expect(url).toBe('/ws/rest/v1/relationship');
  expect(options).toMatchObject({
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  expect(JSON.parse(options.body as string)).toEqual(payload);
}

describe('saveRelationship backend calls', () => {
  beforeEach(() => {
    mockOpenmrsFetch.mockReset();
    mockOpenmrsFetch.mockResolvedValue({ data: {} } as Awaited<ReturnType<typeof openmrsFetch>>);
  });

  it('posts person attributes at the backend resource root for an existing relative', async () => {
    await saveRelationship(
      {
        mode: 'search',
        personA: patientUuid,
        personB: relativeUuid,
        relationshipType: relationshipTypeUuid,
        relationshipDirection: 'bIsToA',
      },
      config,
      session as never,
      [
        {
          attributeType: config.contactPersonAttributesUuid.dataConsent,
          value: 'true',
        },
      ],
    );

    expect(mockOpenmrsFetch).toHaveBeenCalledWith(`/ws/rest/v1/person/${relativeUuid}/attribute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        attributeType: config.contactPersonAttributesUuid.dataConsent,
        value: 'true',
      }),
    });
  });

  it('keeps the current patient as personA for bIsToA relationships', async () => {
    await saveRelationship(
      {
        mode: 'search',
        personA: patientUuid,
        personB: relativeUuid,
        relationshipType: relationshipTypeUuid,
        relationshipDirection: 'bIsToA',
      },
      config,
      session as never,
    );

    expectLastRelationshipPayload({
      personA: patientUuid,
      personB: relativeUuid,
      relationshipType: relationshipTypeUuid,
    });
  });

  it('swaps personA and personB when the selected relationship direction is aIsToB', async () => {
    await saveRelationship(
      {
        mode: 'search',
        personA: patientUuid,
        personB: relativeUuid,
        relationshipType: relationshipTypeUuid,
        relationshipDirection: 'aIsToB',
      },
      config,
      session as never,
    );

    expectLastRelationshipPayload({
      personA: relativeUuid,
      personB: patientUuid,
      relationshipType: relationshipTypeUuid,
    });
  });
});
