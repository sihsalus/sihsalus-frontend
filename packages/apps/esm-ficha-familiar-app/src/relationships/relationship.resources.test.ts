import { openmrsFetch, showSnackbar } from '@openmrs/esm-framework';

import type { ConfigObject } from '../config-schema';

import {
  fetchPerson,
  getRelationshipRetryPersonUuid,
  RelationshipSaveError,
  saveRelationship,
} from './relationship.resources';

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
const mockShowSnackbar = vi.mocked(showSnackbar);

const patientUuid = '11111111-1111-4111-8111-111111111111';
const relativeUuid = '22222222-2222-4222-8222-222222222222';
const relationshipTypeUuid = '33333333-3333-4333-8333-333333333333';

const config = {
  maritalStatusPersonAttributeTypeUuid: '66666666-6666-4666-8666-666666666666',
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
    mockShowSnackbar.mockReset();
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
    );

    expectLastRelationshipPayload({
      personA: relativeUuid,
      personB: patientUuid,
      relationshipType: relationshipTypeUuid,
    });
  });

  it('creates a plain Person with person attributes and never creates a patient record', async () => {
    mockOpenmrsFetch.mockImplementation(async (url) => {
      if (url === '/ws/rest/v1/person') {
        return { data: { uuid: relativeUuid } } as Awaited<ReturnType<typeof openmrsFetch>>;
      }
      return { data: {} } as Awaited<ReturnType<typeof openmrsFetch>>;
    });

    await expect(
      saveRelationship(
        {
          mode: 'create',
          personA: patientUuid,
          relationshipType: relationshipTypeUuid,
          relationshipDirection: 'bIsToA',
          personBInfo: {
            givenName: 'Persona',
            middleName: 'Sintética',
            familyName: 'Prueba',
            familyName2: 'Segura',
            gender: 'F',
            birthdate: new Date('1990-01-01'),
            maritalStatus: '77777777-7777-4777-8777-777777777777',
            address: 'Dirección sintética',
            phoneNumber: '900000000',
          },
        },
        config,
        [
          {
            attributeType: config.contactPersonAttributesUuid.dataConsent,
            value: 'true',
          },
        ],
      ),
    ).resolves.toEqual({ personUuid: relativeUuid, personCreated: true });

    const [, createPersonOptions] = mockOpenmrsFetch.mock.calls.find(([url]) => url === '/ws/rest/v1/person');
    expect(JSON.parse(createPersonOptions.body as string)).toEqual({
      names: [
        {
          givenName: 'Persona',
          middleName: 'Sintética',
          familyName: 'Prueba',
          familyName2: 'Segura',
          preferred: true,
        },
      ],
      gender: 'F',
      birthdate: '1990-01-01T00:00:00.000Z',
      birthdateEstimated: false,
      addresses: [{ preferred: true, address1: 'Dirección sintética' }],
      dead: false,
      attributes: [
        {
          attributeType: config.contactPersonAttributesUuid.telephone,
          value: '900000000',
        },
        {
          attributeType: config.maritalStatusPersonAttributeTypeUuid,
          value: '77777777-7777-4777-8777-777777777777',
        },
        {
          attributeType: config.contactPersonAttributesUuid.dataConsent,
          value: 'true',
        },
      ],
    });
    expect(mockOpenmrsFetch.mock.calls.map(([url]) => url)).not.toEqual(
      expect.arrayContaining([
        expect.stringContaining('/patient'),
        expect.stringContaining('/idgen/'),
        expect.stringContaining('/encounter'),
      ]),
    );
    expectLastRelationshipPayload({
      personA: patientUuid,
      personB: relativeUuid,
      relationshipType: relationshipTypeUuid,
    });
  });

  it('preserves the created Person UUID when relationship creation fails', async () => {
    mockOpenmrsFetch.mockImplementation(async (url) => {
      if (url === '/ws/rest/v1/person') {
        return { data: { uuid: relativeUuid } } as Awaited<ReturnType<typeof openmrsFetch>>;
      }
      if (url === '/ws/rest/v1/relationship') {
        throw new Error('synthetic relationship failure');
      }
      return { data: {} } as Awaited<ReturnType<typeof openmrsFetch>>;
    });

    const error = await saveRelationship(
      {
        mode: 'create',
        personA: patientUuid,
        relationshipType: relationshipTypeUuid,
        relationshipDirection: 'bIsToA',
        personBInfo: {
          givenName: 'Persona',
          familyName: 'Prueba',
          familyName2: 'Segura',
          gender: 'F',
          birthdate: new Date('1990-01-01'),
        },
      },
      config,
    ).catch((error) => error);

    expect(error).toBeInstanceOf(RelationshipSaveError);
    expect(error).toMatchObject({
      operation: 'create-relationship',
      personUuid: relativeUuid,
    });
    expect(getRelationshipRetryPersonUuid(error)).toBe(relativeUuid);
    expect(mockOpenmrsFetch.mock.calls.some(([, options]) => options?.method === 'DELETE')).toBe(false);
    expect(JSON.stringify(mockShowSnackbar.mock.calls)).not.toContain('synthetic relationship failure');
  });

  it('marks a birthdate calculated from age as estimated', async () => {
    mockOpenmrsFetch.mockImplementation(async (url) => {
      if (url === '/ws/rest/v1/person') {
        return { data: { uuid: relativeUuid } } as Awaited<ReturnType<typeof openmrsFetch>>;
      }
      return { data: {} } as Awaited<ReturnType<typeof openmrsFetch>>;
    });

    await saveRelationship(
      {
        mode: 'create',
        personA: patientUuid,
        relationshipType: relationshipTypeUuid,
        relationshipDirection: 'bIsToA',
        personBInfo: {
          givenName: 'Persona',
          familyName: 'Prueba',
          familyName2: 'Segura',
          gender: 'F',
          birthdate: new Date('1990-01-01'),
          birthdateEstimated: true,
        },
      },
      config,
    );

    const [, createPersonOptions] = mockOpenmrsFetch.mock.calls.find(([url]) => url === '/ws/rest/v1/person');
    expect(JSON.parse(createPersonOptions.body as string)).toMatchObject({ birthdateEstimated: true });
  });

  it('reuses a previously created Person when the relationship is retried', async () => {
    await saveRelationship(
      {
        mode: 'create',
        personA: patientUuid,
        personB: relativeUuid,
        relationshipType: relationshipTypeUuid,
        relationshipDirection: 'bIsToA',
        personBInfo: {
          givenName: 'Persona',
          familyName: 'Prueba',
          familyName2: 'Segura',
          gender: 'F',
          birthdate: new Date('1990-01-01'),
        },
      },
      config,
    );

    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(1);
    expectLastRelationshipPayload({
      personA: patientUuid,
      personB: relativeUuid,
      relationshipType: relationshipTypeUuid,
    });
  });
});

describe('fetchPerson', () => {
  beforeEach(() => {
    mockOpenmrsFetch.mockReset();
  });

  it('combines patients and plain people without duplicating the same Person', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce({
        data: {
          results: [
            {
              uuid: patientUuid,
              identifiers: [
                {
                  identifier: 'HCE-TEST',
                  preferred: true,
                  identifierType: { display: 'HCE' },
                },
              ],
              person: {
                uuid: patientUuid,
                display: 'Paciente Sintético',
                gender: 'M',
                birthdate: '1985-02-03',
              },
            },
          ],
        },
      } as Awaited<ReturnType<typeof openmrsFetch>>)
      .mockResolvedValueOnce({
        data: {
          results: [
            { uuid: patientUuid, display: 'Paciente Sintético' },
            {
              uuid: relativeUuid,
              display: 'Persona Sintética',
              gender: 'F',
              birthdate: '1990-01-01',
            },
          ],
        },
      } as Awaited<ReturnType<typeof openmrsFetch>>);

    const abortController = new AbortController();
    await expect(fetchPerson('Persona Sintética', abortController)).resolves.toEqual([
      {
        uuid: patientUuid,
        display: 'Paciente Sintético',
        gender: 'M',
        age: undefined,
        birthdate: '1985-02-03',
        isPatient: true,
        identifiers: [
          {
            identifier: 'HCE-TEST',
            preferred: true,
            identifierType: { display: 'HCE' },
          },
        ],
      },
      {
        uuid: relativeUuid,
        display: 'Persona Sintética',
        gender: 'F',
        birthdate: '1990-01-01',
        isPatient: false,
        identifiers: [],
      },
    ]);
    expect(mockOpenmrsFetch).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('/patient?q=Persona%20Sint%C3%A9tica&'),
      { signal: abortController.signal },
    );
    expect(mockOpenmrsFetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/person?q=Persona%20Sint%C3%A9tica&'),
      { signal: abortController.signal },
    );
  });
});
