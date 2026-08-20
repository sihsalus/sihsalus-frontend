import { messageOmrsServiceWorker, openmrsFetch, setupDynamicOfflineDataHandler } from '@openmrs/esm-framework';

import { setupDynamicOfflineFormDataHandler } from './caching';

vi.mock('@openmrs/esm-framework', async () => {
  const { refreshOfflineCacheEntry } = await vi.importActual<typeof import('@openmrs/esm-offline/src/public')>(
    '@openmrs/esm-offline/src/public',
  );
  return {
    ...(await vi.importActual('@openmrs/esm-framework')),
    makeUrl: vi.fn((url: string) => `/openmrs${url}`),
    messageOmrsServiceWorker: vi.fn(),
    openmrsFetch: vi.fn(),
    refreshOfflineCacheEntry,
    restBaseUrl: '/ws/rest/v1',
    setupDynamicOfflineDataHandler: vi.fn(),
    subscribePrecacheStaticDependencies: vi.fn(),
  };
});

const mockMessageOmrsServiceWorker = vi.mocked(messageOmrsServiceWorker);
const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const mockSetupDynamicOfflineDataHandler = vi.mocked(setupDynamicOfflineDataHandler);

describe('offline form caching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fails synchronization when the service worker rejects route registration', async () => {
    mockMessageOmrsServiceWorker.mockResolvedValue({
      success: false,
      error: 'The service worker is unavailable.',
    });

    setupDynamicOfflineFormDataHandler();

    const handler = mockSetupDynamicOfflineDataHandler.mock.calls[0]?.[0];
    expect(handler).toBeDefined();
    await expect(handler?.sync('synthetic-form-uuid')).rejects.toThrow(
      'Some form data could not be properly downloaded.',
    );
    expect(mockMessageOmrsServiceWorker).toHaveBeenCalledTimes(2);
    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
  });

  it('requires fresh responses and preserves stale form data when the network is unavailable', async () => {
    const formUuid = 'synthetic-form-uuid';
    const stableUrls = [
      `${globalThis.location.origin}/openmrs/ws/rest/v1/form/${formUuid}?v=full`,
      `${globalThis.location.origin}/openmrs/ws/rest/v1/o3/forms/${formUuid}`,
    ];
    const cachedResponses = new Map(
      stableUrls.map((url) => [url, new Response('stale form data', { status: 200 })]),
    );
    const cachePut = vi.fn(async (request: RequestInfo | URL, response: Response) => {
      const key = request instanceof Request ? request.url : request.toString();
      cachedResponses.set(key, response.clone());
    });
    vi.stubGlobal('caches', {
      open: vi.fn(async () => ({ put: cachePut })),
    });
    let networkAvailable = false;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const requestUrl = input instanceof Request ? input.url : input.toString();
      return networkAvailable
        ? new Response('fresh form data', { status: 200 })
        : (cachedResponses.get(requestUrl)?.clone() ?? new Response(null, { status: 503 }));
    });
    vi.stubGlobal('fetch', fetchMock);
    mockMessageOmrsServiceWorker.mockResolvedValue({ success: true });

    setupDynamicOfflineFormDataHandler();
    const handler = mockSetupDynamicOfflineDataHandler.mock.calls[0]?.[0];
    const abortController = new AbortController();

    await expect(handler?.sync(formUuid, abortController.signal)).rejects.toThrow(
      'Some form data could not be properly downloaded.',
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(cachePut).not.toHaveBeenCalled();
    for (const stableUrl of stableUrls) {
      await expect(cachedResponses.get(stableUrl)?.clone().text()).resolves.toBe('stale form data');
    }
    for (const refreshCall of fetchMock.mock.calls) {
      expect(refreshCall[0].toString()).toContain('_openmrsOfflineRefresh=');
      expect(refreshCall[1]).toMatchObject({
        cache: 'no-store',
        headers: { 'x-omrs-offline-caching-strategy': 'network-only-or-cache-only' },
        signal: abortController.signal,
      });
    }

    networkAvailable = true;
    await expect(handler?.sync(formUuid, abortController.signal)).resolves.toBeUndefined();
    expect(cachePut).toHaveBeenCalledTimes(2);
    for (const stableUrl of stableUrls) {
      await expect(cachedResponses.get(stableUrl)?.clone().text()).resolves.toBe('fresh form data');
    }
    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
  });
});
