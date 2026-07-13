import { getConfig } from '@openmrs/esm-framework';

import { getPatientUrlsToBeCached } from './offline';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  fhirBaseUrl: '/ws/fhir2/R4',
  getConfig: vi.fn(),
  makeUrl: vi.fn((url: string) => `/openmrs${url}`),
  omrsOfflineCachingStrategyHttpHeaderName: 'x-omrs-offline-caching-strategy',
  restBaseUrl: '/ws/rest/v1',
}));

const mockGetConfig = vi.mocked(getConfig);

describe('patient registration offline cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('caches every REST resource required to hydrate an existing patient', async () => {
    mockGetConfig.mockResolvedValue({
      registrationObs: { encounterTypeUuid: 'registration-encounter-type-uuid' },
    } as never);

    const urls = await getPatientUrlsToBeCached('patient-uuid');
    const baseUrl = `${globalThis.location.origin}/openmrs`;

    expect(urls).toEqual(
      expect.arrayContaining([
        `${baseUrl}/ws/fhir2/R4/Patient/patient-uuid`,
        `${baseUrl}/ws/rest/v1/person/patient-uuid?v=custom:(uuid,display,causeOfDeath,dead,deathDate,causeOfDeathNonCoded)`,
        `${baseUrl}/ws/rest/v1/person/patient-uuid/attribute?v=custom:(uuid,display,attributeType:(uuid,display,format),value)`,
        `${baseUrl}/ws/rest/v1/patient/patient-uuid/identifier?v=custom:(uuid,identifier,identifierType:(uuid,required,name),preferred)`,
        `${baseUrl}/ws/rest/v1/encounter?patient=patient-uuid&v=custom:(encounterDatetime,obs:(concept:ref,value:ref))&encounterType=registration-encounter-type-uuid`,
      ]),
    );
  });

  it('omits the registration encounter request when observations are not configured', async () => {
    mockGetConfig.mockResolvedValue({ registrationObs: { encounterTypeUuid: null } } as never);

    const urls = await getPatientUrlsToBeCached('patient-uuid');

    expect(urls.some((url) => url.includes('/encounter?'))).toBe(false);
  });
});
