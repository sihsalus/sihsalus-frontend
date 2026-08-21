import {
  messageOmrsServiceWorker,
  refreshOfflineCacheEntry,
  setupDynamicOfflineDataHandler,
} from '@openmrs/esm-framework';

import { setupOffline } from './offline';

vi.mock('@openmrs/esm-framework', () => ({
  fetchCurrentPatient: vi.fn().mockResolvedValue(undefined),
  fhirBaseUrl: '/ws/fhir2/R4',
  makeUrl: vi.fn((url: string) => `/openmrs${url}`),
  messageOmrsServiceWorker: vi.fn(),
  refreshOfflineCacheEntry: vi.fn(),
  setupDynamicOfflineDataHandler: vi.fn(),
}));

const mockMessageOmrsServiceWorker = vi.mocked(messageOmrsServiceWorker);
const mockRefreshOfflineCacheEntry = vi.mocked(refreshOfflineCacheEntry);
const mockSetupDynamicOfflineDataHandler = vi.mocked(setupDynamicOfflineDataHandler);
const refreshErrorMessage = 'Patient offline data could not be refreshed.';

function getPatientHandler() {
  setupOffline();
  const handler = mockSetupDynamicOfflineDataHandler.mock.calls[0]?.[0];

  if (!handler) {
    throw new Error('The patient offline handler was not registered.');
  }

  return handler;
}

describe('patient-search patient synchronization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMessageOmrsServiceWorker.mockResolvedValue({ success: true });
    mockRefreshOfflineCacheEntry.mockResolvedValue(undefined);
  });

  it('fails safely when the service worker cannot register the patient route', async () => {
    mockMessageOmrsServiceWorker.mockResolvedValue({
      success: false,
      error: 'private-patient-uuid at /ws/fhir2/R4/Patient/private-patient-uuid',
    });
    const handler = getPatientHandler();

    const error = await handler.sync('synthetic-patient-uuid').catch((reason) => reason);

    expect(error).toEqual(new Error(refreshErrorMessage));
    expect(String(error)).not.toContain('private-patient-uuid');
    expect(String(error)).not.toContain('/ws/fhir2/R4/Patient');
    expect(mockMessageOmrsServiceWorker).toHaveBeenCalledWith({
      type: 'registerDynamicRoute',
      pattern: '/ws/fhir2/R4/Patient/synthetic-patient-uuid',
    });
    expect(mockRefreshOfflineCacheEntry).not.toHaveBeenCalled();
  });

  it('does not count a rejected fresh refresh as synchronized and forwards cancellation', async () => {
    mockRefreshOfflineCacheEntry.mockRejectedValue(
      new Error('stale response for private-patient-uuid at /ws/fhir2/R4/Patient/private-patient-uuid'),
    );
    const handler = getPatientHandler();
    const abortController = new AbortController();

    const error = await handler.sync('synthetic-patient-uuid', abortController.signal).catch((reason) => reason);

    expect(error).toEqual(new Error(refreshErrorMessage));
    expect(String(error)).not.toContain('private-patient-uuid');
    expect(mockRefreshOfflineCacheEntry).toHaveBeenCalledWith(
      '/ws/fhir2/R4/Patient/synthetic-patient-uuid',
      abortController.signal,
    );
  });

  it('succeeds only after the fresh patient response is cached', async () => {
    const handler = getPatientHandler();
    const abortController = new AbortController();

    await expect(handler.sync('synthetic-patient-uuid', abortController.signal)).resolves.toBeUndefined();
    expect(mockRefreshOfflineCacheEntry).toHaveBeenCalledWith(
      '/ws/fhir2/R4/Patient/synthetic-patient-uuid',
      abortController.signal,
    );
  });
});
