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
});
