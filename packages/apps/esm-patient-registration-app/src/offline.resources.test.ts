import { messageOmrsServiceWorker, openmrsFetch } from '@openmrs/esm-framework';

const mockMessageOmrsServiceWorker = vi.mocked(messageOmrsServiceWorker);
const mockOpenmrsFetch = vi.mocked(openmrsFetch);

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  getConfig: vi.fn(),
  messageOmrsServiceWorker: vi.fn(),
  omrsOfflineCachingStrategyHttpHeaderName: 'x-omrs-offline-caching-strategy',
  openmrsFetch: vi.fn(),
  restBaseUrl: '/ws/rest/v1',
}));

describe('registration metadata offline caching', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockOpenmrsFetch.mockResolvedValue({ data: {} } as never);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('continues network requests and warns once when service worker messaging times out', async () => {
    vi.useFakeTimers();
    mockMessageOmrsServiceWorker.mockImplementation(() => new Promise(() => {}));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { fetchAddressTemplate, fetchCurrentSession } = await import('./offline.resources');

    const requests = Promise.all([fetchCurrentSession(), fetchAddressTemplate()]);
    await vi.advanceTimersByTimeAsync(1_000);
    await requests;

    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(2);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      'Offline cache route registration is unavailable. Continuing with network requests.',
      expect.any(Error),
    );
  });

  it('does not warn when service worker messaging succeeds', async () => {
    mockMessageOmrsServiceWorker.mockResolvedValue({ success: true });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { fetchCurrentSession } = await import('./offline.resources');

    await fetchCurrentSession();

    expect(mockOpenmrsFetch).toHaveBeenCalledOnce();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('uses fresh non-unique and disabled ID-generation metadata instead of a cached successful model', async () => {
    const identifierTypeUuid = '11111111-1111-4111-8111-111111111111';
    const identifierSourceUuid = '22222222-2222-4222-8222-222222222222';
    mockMessageOmrsServiceWorker.mockResolvedValue({ success: true });
    mockOpenmrsFetch.mockImplementation(async (input) => {
      const url = new URL(input, globalThis.location.origin);
      const isFreshRequest = url.searchParams.has('_bulkPatientImportMetadata');

      if (url.pathname.endsWith('/patientidentifiertype')) {
        return {
          data: {
            results: [
              {
                display: 'Synthetic document',
                format: '\\d{8}',
                name: 'Synthetic document',
                required: true,
                uniquenessBehavior: isFreshRequest ? 'NON_UNIQUE' : 'UNIQUE',
                uuid: identifierTypeUuid,
              },
            ],
          },
          ok: true,
          status: 200,
        } as never;
      }

      if (url.pathname.endsWith('/metadatamapping/termmapping')) {
        return {
          data: { results: [{ metadataUuid: identifierTypeUuid }] },
          ok: true,
          status: 200,
        } as never;
      }

      if (url.pathname.endsWith('/idgen/identifiersource')) {
        return {
          data: {
            results: [
              {
                identifierType: { uuid: identifierTypeUuid },
                name: 'Synthetic source',
                uuid: identifierSourceUuid,
              },
            ],
          },
          ok: true,
          status: 200,
        } as never;
      }

      return {
        data: {
          results: [
            {
              automaticGenerationEnabled: !isFreshRequest,
              manualEntryEnabled: false,
              source: { uuid: identifierSourceUuid },
            },
          ],
        },
        ok: true,
        status: 200,
      } as never;
    });
    const { fetchFreshPatientIdentifierTypesWithSources, fetchPatientIdentifierTypesWithSources } = await import(
      './offline.resources'
    );

    const cachedIdentifierTypes = await fetchPatientIdentifierTypesWithSources();
    const freshIdentifierTypes = await fetchFreshPatientIdentifierTypesWithSources();

    expect(cachedIdentifierTypes[0]).toMatchObject({
      uniquenessBehavior: 'UNIQUE',
      identifierSources: [{ autoGenerationOption: { automaticGenerationEnabled: true } }],
    });
    expect(freshIdentifierTypes[0]).toMatchObject({
      uniquenessBehavior: 'NON_UNIQUE',
      identifierSources: [{ autoGenerationOption: { automaticGenerationEnabled: false } }],
    });

    const freshCalls = mockOpenmrsFetch.mock.calls.filter(([input]) =>
      new URL(input, globalThis.location.origin).searchParams.has('_bulkPatientImportMetadata'),
    );
    expect(freshCalls).toHaveLength(4);
    expect(
      new Set(
        freshCalls.map(([input]) =>
          new URL(input, globalThis.location.origin).searchParams.get('_bulkPatientImportMetadata'),
        ),
      ).size,
    ).toBe(4);
    for (const [, options] of freshCalls) {
      expect(options).toMatchObject({
        cache: 'no-store',
        headers: { 'x-omrs-offline-caching-strategy': 'network-only-or-cache-only' },
        rejectOnAuthFailure: true,
        signal: expect.any(AbortSignal),
      });
    }
    expect(mockMessageOmrsServiceWorker).toHaveBeenCalledTimes(4);
  });

  it('loads every fresh metadata page before deciding which identifiers are required', async () => {
    const dniTypeUuid = '11111111-1111-4111-8111-111111111111';
    const requiredTypeUuid = '22222222-2222-4222-8222-222222222222';
    const sourceUuid = '33333333-3333-4333-8333-333333333333';
    mockOpenmrsFetch.mockImplementation(async (input) => {
      const url = new URL(input, globalThis.location.origin);
      const isSecondPage = url.searchParams.get('startIndex') === '50';
      const nextPage = () => {
        url.searchParams.delete('_bulkPatientImportMetadata');
        url.searchParams.set('startIndex', '50');
        return [{ rel: 'next', uri: url.href }];
      };

      if (url.pathname.endsWith('/patientidentifiertype')) {
        return {
          data: isSecondPage
            ? {
                results: [
                  {
                    display: 'Synthetic required identifier',
                    format: '',
                    locationBehavior: 'NOT_USED',
                    name: 'Synthetic required identifier',
                    required: true,
                    uniquenessBehavior: 'UNIQUE',
                    uuid: requiredTypeUuid,
                  },
                ],
              }
            : {
                results: [
                  {
                    display: 'Synthetic DNI',
                    format: '\\d{8}',
                    locationBehavior: 'NOT_USED',
                    name: 'Synthetic DNI',
                    required: true,
                    uniquenessBehavior: 'UNIQUE',
                    uuid: dniTypeUuid,
                  },
                ],
                links: nextPage(),
              },
          ok: true,
          status: 200,
        } as never;
      }
      if (url.pathname.endsWith('/metadatamapping/termmapping')) {
        return { data: { results: [{ metadataUuid: dniTypeUuid }] }, ok: true, status: 200 } as never;
      }
      if (url.pathname.endsWith('/idgen/identifiersource')) {
        return {
          data: isSecondPage
            ? { results: [{ identifierType: { uuid: requiredTypeUuid }, name: 'Synthetic source', uuid: sourceUuid }] }
            : { results: [], links: nextPage() },
          ok: true,
          status: 200,
        } as never;
      }
      return {
        data: isSecondPage
          ? {
              results: [
                {
                  automaticGenerationEnabled: true,
                  manualEntryEnabled: false,
                  source: { uuid: sourceUuid },
                },
              ],
            }
          : { results: [], links: nextPage() },
        ok: true,
        status: 200,
      } as never;
    });
    const { fetchFreshPatientIdentifierTypesWithSources } = await import('./offline.resources');

    await expect(fetchFreshPatientIdentifierTypesWithSources()).resolves.toEqual([
      expect.objectContaining({ uuid: dniTypeUuid, isPrimary: true }),
      expect.objectContaining({
        uuid: requiredTypeUuid,
        required: true,
        identifierSources: [expect.objectContaining({ uuid: sourceUuid })],
      }),
    ]);
  });

  it('fails closed when a fresh metadata pagination link repeats', async () => {
    mockOpenmrsFetch.mockImplementation(async (input) => {
      const url = new URL(input, globalThis.location.origin);
      url.searchParams.delete('_bulkPatientImportMetadata');
      return {
        data: { results: [], links: [{ rel: 'next', uri: url.href }] },
        ok: true,
        status: 200,
      } as never;
    });
    const { fetchFreshPatientIdentifierTypesWithSources } = await import('./offline.resources');

    await expect(fetchFreshPatientIdentifierTypesWithSources()).rejects.toThrow(
      'Failed to load fresh patient identifier metadata.',
    );
  });

  it.each([
    '/patientidentifiertype',
    '/metadatamapping/termmapping',
    '/idgen/identifiersource',
    '/idgen/autogenerationoption',
  ])('rejects a non-2xx fresh response from %s', async (failingPath) => {
    mockOpenmrsFetch.mockImplementation(async (input) => {
      const isFailure = new URL(input, globalThis.location.origin).pathname.endsWith(failingPath);
      return {
        data: { results: [] },
        ok: !isFailure,
        status: isFailure ? 503 : 200,
      } as never;
    });
    const { fetchFreshPatientIdentifierTypesWithSources } = await import('./offline.resources');

    await expect(fetchFreshPatientIdentifierTypesWithSources()).rejects.toThrow(
      'Failed to load fresh patient identifier metadata (HTTP 503).',
    );
    expect(mockMessageOmrsServiceWorker).not.toHaveBeenCalled();
  });

  it('propagates a fresh metadata network error without replacing it', async () => {
    const networkError = new TypeError('synthetic network failure');
    mockOpenmrsFetch.mockImplementation(async (input) => {
      const url = new URL(input, globalThis.location.origin);
      if (url.pathname.endsWith('/patientidentifiertype')) {
        throw networkError;
      }
      return { data: { results: [] }, ok: true, status: 200 } as never;
    });
    const { fetchFreshPatientIdentifierTypesWithSources } = await import('./offline.resources');

    await expect(fetchFreshPatientIdentifierTypesWithSources()).rejects.toBe(networkError);
  });
});
