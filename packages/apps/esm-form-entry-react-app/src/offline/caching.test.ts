import { messageOmrsServiceWorker, openmrsFetch, setupDynamicOfflineDataHandler } from '@openmrs/esm-framework';

import { setupDynamicOfflineFormDataHandler } from './caching';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  makeUrl: vi.fn((url: string) => `/openmrs${url}`),
  messageOmrsServiceWorker: vi.fn(),
  omrsOfflineCachingStrategyHttpHeaderName: 'x-omrs-offline-caching-strategy',
  openmrsFetch: vi.fn(),
  restBaseUrl: '/ws/rest/v1',
  setupDynamicOfflineDataHandler: vi.fn(),
  subscribePrecacheStaticDependencies: vi.fn(),
}));

const mockMessageOmrsServiceWorker = vi.mocked(messageOmrsServiceWorker);
const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const mockSetupDynamicOfflineDataHandler = vi.mocked(setupDynamicOfflineDataHandler);

describe('offline form caching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fails synchronization when the service worker rejects route registration', async () => {
    mockOpenmrsFetch.mockResolvedValue({
      data: { uuid: 'synthetic-form-uuid' },
    } as never);
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
    expect(mockOpenmrsFetch).toHaveBeenCalledOnce();
  });
});
