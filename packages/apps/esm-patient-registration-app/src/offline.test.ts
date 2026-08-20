import { getConfig, messageOmrsServiceWorker } from '@openmrs/esm-framework';

import { cachePatientUrlsForOfflineUse, getPatientUrlsToBeCached } from './offline';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  fhirBaseUrl: '/ws/fhir2/R4',
  getConfig: vi.fn(),
  makeUrl: vi.fn((url: string) => `/openmrs${url}`),
  messageOmrsServiceWorker: vi.fn(),
  omrsOfflineCachingStrategyHttpHeaderName: 'x-omrs-offline-caching-strategy',
  restBaseUrl: '/ws/rest/v1',
}));

const mockGetConfig = vi.mocked(getConfig);
const mockMessageOmrsServiceWorker = vi.mocked(messageOmrsServiceWorker);

describe('patient registration offline cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMessageOmrsServiceWorker.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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

  it('surfaces a partial cache failure after attempting every resource and succeeds on retry', async () => {
    const urls = ['https://example.test/patient', 'https://example.test/relationships', 'https://example.test/ids'];
    let relationshipsUnavailable = true;
    const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
      if (relationshipsUnavailable && input.toString().endsWith('/relationships')) {
        throw new TypeError('network unavailable');
      }

      return new Response(null, { status: 200 });
    });
    vi.stubGlobal('fetch', mockFetch);

    const failedAttempt = cachePatientUrlsForOfflineUse(urls);
    await expect(failedAttempt).rejects.toMatchObject({
      name: 'AggregateError',
      message: 'Failed to cache 1 of 3 patient resources for offline use.',
    });
    await expect(failedAttempt).rejects.not.toThrow(/example\.test|relationships/);
    expect(mockMessageOmrsServiceWorker).toHaveBeenCalledTimes(3);
    expect(mockFetch).toHaveBeenCalledTimes(3);

    relationshipsUnavailable = false;

    await expect(cachePatientUrlsForOfflineUse(urls)).resolves.toBeUndefined();
    expect(mockMessageOmrsServiceWorker).toHaveBeenCalledTimes(6);
    expect(mockFetch).toHaveBeenCalledTimes(6);
  });

  it('treats a controlled service worker registration failure as a cache failure', async () => {
    const urls = ['https://example.test/patient', 'https://example.test/relationships'];
    const mockFetch = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', mockFetch);
    mockMessageOmrsServiceWorker
      .mockResolvedValueOnce({ success: false, error: 'service worker unavailable' })
      .mockResolvedValue({ success: true });

    await expect(cachePatientUrlsForOfflineUse(urls)).rejects.toMatchObject({
      name: 'AggregateError',
      message: 'Failed to cache 1 of 2 patient resources for offline use.',
    });
    expect(mockMessageOmrsServiceWorker).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockFetch).toHaveBeenCalledWith('https://example.test/relationships');
  });

  it('treats an unsuccessful HTTP response as a cache failure', async () => {
    const urls = ['https://example.test/patient', 'https://example.test/identifiers'];
    const mockFetch = vi.fn(async (input: RequestInfo | URL) =>
      input.toString().endsWith('/identifiers')
        ? new Response(null, { status: 503 })
        : new Response(null, { status: 200 }),
    );
    vi.stubGlobal('fetch', mockFetch);

    await expect(cachePatientUrlsForOfflineUse(urls)).rejects.toMatchObject({
      name: 'AggregateError',
      message: 'Failed to cache 1 of 2 patient resources for offline use.',
    });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
