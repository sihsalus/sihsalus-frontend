import {
  isOnline,
  messageOmrsServiceWorker,
  openmrsFetch,
  setupDynamicOfflineDataHandler,
  showSnackbar,
  subscribePrecacheStaticDependencies,
  translateFrom,
} from '@openmrs/esm-framework';

import { setupDynamicOfflineFormDataHandler, setupStaticDataOfflinePrecaching } from './caching';

vi.mock('@openmrs/esm-framework', async () => {
  const { refreshOfflineCacheEntry } = await vi.importActual<typeof import('@openmrs/esm-offline/src/public')>(
    '@openmrs/esm-offline/src/public',
  );
  return {
    ...(await vi.importActual('@openmrs/esm-framework')),
    makeUrl: vi.fn((url: string) => `/openmrs${url}`),
    isOnline: vi.fn(() => true),
    messageOmrsServiceWorker: vi.fn(),
    openmrsFetch: vi.fn(),
    refreshOfflineCacheEntry,
    restBaseUrl: '/ws/rest/v1',
    showSnackbar: vi.fn(),
    setupDynamicOfflineDataHandler: vi.fn(),
    subscribePrecacheStaticDependencies: vi.fn(),
    translateFrom: vi.fn((_moduleName: string, _key: string, fallback?: string) => fallback),
  };
});

const mockMessageOmrsServiceWorker = vi.mocked(messageOmrsServiceWorker);
const mockIsOnline = vi.mocked(isOnline);
const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const mockShowSnackbar = vi.mocked(showSnackbar);
const mockSetupDynamicOfflineDataHandler = vi.mocked(setupDynamicOfflineDataHandler);
const mockSubscribePrecacheStaticDependencies = vi.mocked(subscribePrecacheStaticDependencies);
const mockTranslateFrom = vi.mocked(translateFrom);

describe('offline form caching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsOnline.mockReturnValue(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not refresh or notify when static dependencies are requested while offline', async () => {
    mockIsOnline.mockReturnValue(false);

    setupStaticDataOfflinePrecaching();

    const callback = mockSubscribePrecacheStaticDependencies.mock.calls[0]?.[0];
    expect(callback).toBeDefined();
    expect(callback?.()).toBeUndefined();
    await Promise.resolve();

    expect(mockMessageOmrsServiceWorker).not.toHaveBeenCalled();
    expect(mockShowSnackbar).not.toHaveBeenCalled();
    expect(mockTranslateFrom).not.toHaveBeenCalled();
  });

  it('does not notify when connectivity is lost during a static dependency refresh', async () => {
    mockIsOnline.mockReturnValueOnce(true).mockReturnValue(false);
    mockMessageOmrsServiceWorker.mockResolvedValue({
      success: false,
      error: 'The service worker is unavailable.',
    });

    setupStaticDataOfflinePrecaching();

    const callback = mockSubscribePrecacheStaticDependencies.mock.calls[0]?.[0];
    expect(callback).toBeDefined();
    expect(callback?.()).toBeUndefined();
    await vi.waitFor(() => expect(mockMessageOmrsServiceWorker).toHaveBeenCalledTimes(2));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockShowSnackbar).not.toHaveBeenCalled();
    expect(mockTranslateFrom).not.toHaveBeenCalled();
  });

  it('settles static dependencies and reports a route registration failure safely', async () => {
    const cachePut = vi.fn();
    vi.stubGlobal('caches', {
      open: vi.fn(async () => ({ put: cachePut })),
    });
    const fetchMock = vi.fn(async () => new Response('fresh provider data', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    mockMessageOmrsServiceWorker.mockImplementation(async (message) =>
      String(message.pattern).includes('/location')
        ? { success: false, error: 'private-provider-uuid at /ws/rest/v1/location' }
        : { success: true },
    );

    setupStaticDataOfflinePrecaching();

    const callback = mockSubscribePrecacheStaticDependencies.mock.calls[0]?.[0];
    expect(callback).toBeDefined();
    expect(callback?.()).toBeUndefined();
    await vi.waitFor(() => expect(mockShowSnackbar).toHaveBeenCalledTimes(1));

    expect(mockMessageOmrsServiceWorker).toHaveBeenCalledTimes(2);
    const registeredPatterns = mockMessageOmrsServiceWorker.mock.calls.map(
      ([message]) => new RegExp(String(message.pattern)),
    );
    expect(
      registeredPatterns[0].test(
        `${globalThis.location.origin}/openmrs/ws/rest/v1/location?q=&v=custom:(uuid,display)`,
      ),
    ).toBe(true);
    expect(
      registeredPatterns[1].test(
        `${globalThis.location.origin}/openmrs/ws/rest/v1/provider?q=&v=custom:(uuid,display,person:(uuid))`,
      ),
    ).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(cachePut).toHaveBeenCalledTimes(1);
    expect(mockShowSnackbar).toHaveBeenCalledWith({
      kind: 'warning',
      title: 'Information for offline use could not be updated',
      subtitle: 'Location or clinical provider options may be out of date. Try again before working offline.',
    });
    expect(mockTranslateFrom).toHaveBeenNthCalledWith(
      1,
      '@sihsalus/esm-form-entry-react-app',
      'offlineFormDependenciesRefreshFailed',
      'Information for offline use could not be updated',
    );
    expect(mockTranslateFrom).toHaveBeenNthCalledWith(
      2,
      '@sihsalus/esm-form-entry-react-app',
      'offlineFormDependenciesRefreshFailedSubtitle',
      'Location or clinical provider options may be out of date. Try again before working offline.',
    );
    expect(JSON.stringify(mockShowSnackbar.mock.calls)).not.toContain('private-provider-uuid');
    expect(JSON.stringify(mockShowSnackbar.mock.calls)).not.toContain('/ws/rest/v1/location');
  });

  it('waits for every static dependency after a non-2xx response before reporting failure', async () => {
    const cachePut = vi.fn();
    vi.stubGlobal('caches', {
      open: vi.fn(async () => ({ put: cachePut })),
    });
    mockMessageOmrsServiceWorker.mockResolvedValue({ success: true });
    let releaseProviderResponse!: (response: Response) => void;
    let markProviderStarted!: () => void;
    const providerStarted = new Promise<void>((resolve) => {
      markProviderStarted = resolve;
    });
    const providerResponse = new Promise<Response>((resolve) => {
      releaseProviderResponse = resolve;
    });
    const fetchMock = vi.fn((input: RequestInfo | URL, _init?: RequestInit): Promise<Response> => {
      const requestUrl = input instanceof Request ? input.url : input.toString();
      if (requestUrl.includes('/provider')) {
        markProviderStarted();
        return providerResponse;
      }
      return Promise.resolve(new Response(null, { status: 503 }));
    });
    vi.stubGlobal('fetch', fetchMock);

    setupStaticDataOfflinePrecaching();

    const callback = mockSubscribePrecacheStaticDependencies.mock.calls[0]?.[0];
    expect(callback).toBeDefined();
    expect(callback?.()).toBeUndefined();
    await providerStarted;
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await new Promise((resolve) => setTimeout(resolve, 0));
    const notificationsBeforeProviderSettles = mockShowSnackbar.mock.calls.length;
    releaseProviderResponse(new Response('fresh provider data', { status: 200 }));
    await vi.waitFor(() => expect(mockShowSnackbar).toHaveBeenCalledTimes(1));

    expect(notificationsBeforeProviderSettles).toBe(0);
    expect(cachePut).toHaveBeenCalledTimes(1);
    expect(mockShowSnackbar).toHaveBeenCalledWith({
      kind: 'warning',
      title: 'Information for offline use could not be updated',
      subtitle: 'Location or clinical provider options may be out of date. Try again before working offline.',
    });
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
