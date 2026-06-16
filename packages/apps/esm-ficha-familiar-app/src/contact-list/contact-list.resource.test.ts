import { openmrsFetch } from '@openmrs/esm-framework';

import type { ConfigObject } from '../config-schema';

import { BOOLEAN_YES, IPV_OUTCOME_NEGATIVE, IPV_OUTCOME_POSITIVE, saveContact } from './contact-list.resource';

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
const contactUuid = '22222222-2222-4222-8222-222222222222';
const relationshipTypeUuid = '33333333-3333-4333-8333-333333333333';
const pnsApproachUuid = '2f3b088e-4cf7-4088-935a-2a353af4b4df';

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
    telephone: '14d4f066-15f5-102d-96e4-000c29c2a5d7',
    baselineHIVStatus: 'b978d331-e162-45b1-b9ca-65d3aa9a851f',
    contactCreated: 'e91775be-cf11-45e3-9b34-3c3f8849d4d6',
    preferedPnsAproach: '98c0a958-515e-4dec-a771-7a4cb9aa5492',
    livingWithContact: '1a951a91-231f-4a3a-9a22-e396fa93455c',
    contactipvOutcome: '81a8b164-befa-4cac-8978-da059082297c',
    dataConsent: '49ff9334-9d9-47d0-a236-72c0c9d4dea9',
  },
} as ConfigObject;

const session = {
  sessionLocation: { uuid: 'location-uuid' },
  currentProvider: { uuid: 'provider-uuid' },
};

function postedBodiesFor(url: string) {
  return mockOpenmrsFetch.mock.calls
    .filter(([callUrl]) => callUrl === url)
    .map(([, options]) => JSON.parse(options.body as string));
}

describe('saveContact', () => {
  beforeEach(() => {
    mockOpenmrsFetch.mockReset();
    mockOpenmrsFetch.mockResolvedValue({ data: {} } as Awaited<ReturnType<typeof openmrsFetch>>);
  });

  it('stores PNS coded attributes with OCL concept UUIDs for existing contacts', async () => {
    await saveContact(
      {
        mode: 'search',
        personA: patientUuid,
        personB: contactUuid,
        relationshipType: relationshipTypeUuid,
        relationshipDirection: 'bIsToA',
        baselineStatus: IPV_OUTCOME_POSITIVE,
        preferedPNSAproach: pnsApproachUuid,
        livingWithClient: BOOLEAN_YES,
        ipvOutcome: IPV_OUTCOME_NEGATIVE,
        dataConsent: true,
      },
      config,
      session as never,
    );

    expect(postedBodiesFor(`/ws/rest/v1/person/${contactUuid}/attribute`)).toEqual(
      expect.arrayContaining([
        {
          attributeType: config.contactPersonAttributesUuid.baselineHIVStatus,
          value: IPV_OUTCOME_POSITIVE,
        },
        {
          attributeType: config.contactPersonAttributesUuid.preferedPnsAproach,
          value: pnsApproachUuid,
        },
        {
          attributeType: config.contactPersonAttributesUuid.livingWithContact,
          value: BOOLEAN_YES,
        },
        {
          attributeType: config.contactPersonAttributesUuid.contactipvOutcome,
          value: IPV_OUTCOME_NEGATIVE,
        },
        {
          attributeType: config.contactPersonAttributesUuid.dataConsent,
          value: BOOLEAN_YES,
        },
      ]),
    );
  });

  it('marks newly created contacts with the OCL yes concept UUID', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce({ data: { identifier: 'AUTO-1' } } as Awaited<ReturnType<typeof openmrsFetch>>)
      .mockResolvedValueOnce({ data: { uuid: contactUuid } } as Awaited<ReturnType<typeof openmrsFetch>>)
      .mockResolvedValue({ data: {} } as Awaited<ReturnType<typeof openmrsFetch>>);

    await saveContact(
      {
        mode: 'create',
        personA: patientUuid,
        relationshipType: relationshipTypeUuid,
        relationshipDirection: 'bIsToA',
        dataConsent: true,
        personBInfo: {
          givenName: 'Ana',
          familyName: 'Perez',
          familyName2: 'Rojas',
          gender: 'F',
          birthdate: new Date('1990-01-01'),
        },
      },
      config,
      session as never,
    );

    const [, createPatientOptions] = mockOpenmrsFetch.mock.calls.find(([url]) => url === '/ws/rest/v1/patient');
    const createPatientPayload = JSON.parse(createPatientOptions.body as string);

    expect(createPatientPayload.person.attributes).toEqual(
      expect.arrayContaining([
        {
          attributeType: config.contactPersonAttributesUuid.contactCreated,
          value: BOOLEAN_YES,
        },
        {
          attributeType: config.contactPersonAttributesUuid.dataConsent,
          value: BOOLEAN_YES,
        },
      ]),
    );
  });
});
