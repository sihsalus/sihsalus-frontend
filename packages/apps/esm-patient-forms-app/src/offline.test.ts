import {
  launchWorkspace2,
  messageOmrsServiceWorker,
  openmrsFetch,
  setupDynamicOfflineDataHandler,
  setupOfflineSync,
  type SyncProcessOptions,
} from '@openmrs/esm-framework';

import { formEncounterUrl, formEncounterUrlPoc } from './constants';
import { setupDynamicFormDataHandler, setupPatientFormSync } from './offline';

const mockLaunchWorkspace2 = vi.mocked(launchWorkspace2);
const mockMessageOmrsServiceWorker = vi.mocked(messageOmrsServiceWorker);
const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const mockSetupDynamicOfflineDataHandler = vi.mocked(setupDynamicOfflineDataHandler);
const mockSetupOfflineSync = vi.mocked(setupOfflineSync);
const successfulFetchResponse = { data: {} } as Awaited<ReturnType<typeof openmrsFetch>>;

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
}

function createPatientFormSyncOptions(): SyncProcessOptions<unknown> {
  return {
    abort: new AbortController(),
    userId: 'user-uuid',
    index: 0,
    items: [],
    dependencies: [{ stopDatetime: '2026-08-20T12:00:00.000Z' }],
  };
}

const queuedPatientForm = {
  _id: 'encounter-uuid',
  encounter: {},
  _payloads: {
    encounterCreate: {
      encounterDatetime: '2026-08-20T12:00:00.000Z',
      patient: 'patient-uuid',
      encounterType: 'encounter-type-uuid',
      location: 'location-uuid',
    },
    personUpdate: {
      uuid: 'person-uuid',
      attributes: [],
    },
  },
};

vi.mock('@openmrs/esm-framework', async () => {
  const { refreshOfflineCacheEntry } = await vi.importActual<typeof import('@openmrs/esm-offline/src/public')>(
    '@openmrs/esm-offline/src/public',
  );
  return {
    ...(await vi.importActual('@openmrs/esm-framework')),
    launchWorkspace2: vi.fn(),
    makeUrl: vi.fn(),
    messageOmrsServiceWorker: vi.fn(),
    openmrsFetch: vi.fn(),
    refreshOfflineCacheEntry,
    restBaseUrl: '/ws/rest/v1',
    setupDynamicOfflineDataHandler: vi.fn(),
    setupOfflineSync: vi.fn(),
  };
});

describe('setupPatientFormSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOpenmrsFetch.mockReset();
    mockOpenmrsFetch.mockResolvedValue(successfulFetchResponse);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('launches canonical queued forms through the workspace2 contract', async () => {
    await setupPatientFormSync();

    const options = mockSetupOfflineSync.mock.calls[0][3] as {
      onBeginEditSyncItem: (syncItem: any) => void;
    };

    options.onBeginEditSyncItem({
      descriptor: { patientUuid: 'patient-uuid' },
      content: {
        _id: 'encounter-uuid',
        form: { uuid: 'form-uuid' },
        encounter: {},
        _payloads: {},
      },
    });

    expect(mockLaunchWorkspace2).toHaveBeenCalledWith(
      'patient-form-entry-workspace-v2',
      {
        form: expect.objectContaining({
          uuid: 'form-uuid',
          display: 'Clinical form',
          name: 'Clinical form',
        }),
        encounterUuid: 'encounter-uuid',
      },
      null,
      {
        patient: null,
        patientUuid: 'patient-uuid',
        visitContext: null,
        mutateVisitContext: null,
      },
    );
  });

  it('keeps legacy queued forms editable through the canonical workspace path', async () => {
    await setupPatientFormSync();

    const options = mockSetupOfflineSync.mock.calls[0][3] as {
      onBeginEditSyncItem: (syncItem: any) => void;
    };

    options.onBeginEditSyncItem({
      descriptor: { patientUuid: 'patient-uuid' },
      content: {
        _id: 'encounter-uuid',
        formSchemaUuid: 'legacy-form-uuid',
        encounter: {},
        _payloads: {},
      },
    });

    expect(mockLaunchWorkspace2).toHaveBeenCalledWith(
      'patient-form-entry-workspace-v2',
      {
        form: expect.objectContaining({
          uuid: 'legacy-form-uuid',
          display: 'Clinical form',
          name: 'Clinical form',
        }),
        encounterUuid: 'encounter-uuid',
      },
      null,
      {
        patient: null,
        patientUuid: 'patient-uuid',
        visitContext: null,
        mutateVisitContext: null,
      },
    );
  });

  it('passes the synchronization abort signal to every clinical write', async () => {
    await setupPatientFormSync();
    const process = mockSetupOfflineSync.mock.calls[0][2];
    const abortController = new AbortController();
    const options = {
      ...createPatientFormSyncOptions(),
      abort: abortController,
    };

    await process(queuedPatientForm, options);

    expect(mockOpenmrsFetch).toHaveBeenCalledWith(
      '/ws/rest/v1/encounter',
      expect.objectContaining({ signal: abortController.signal }),
    );
    expect(mockOpenmrsFetch).toHaveBeenCalledWith(
      '/ws/rest/v1/person/person-uuid',
      expect.objectContaining({ signal: abortController.signal }),
    );
  });

  it('waits for both clinical writes before rejecting with one fixed error', async () => {
    const sensitiveEncounterError =
      'POST /encounter failed for patient private-patient-uuid at https://clinical.example.test';
    const pendingPersonWrite = createDeferred<Awaited<ReturnType<typeof openmrsFetch>>>();
    mockOpenmrsFetch.mockImplementation((url) =>
      url === '/ws/rest/v1/encounter' ? Promise.reject(new Error(sensitiveEncounterError)) : pendingPersonWrite.promise,
    );
    await setupPatientFormSync();
    const process = mockSetupOfflineSync.mock.calls[0][2];
    let attemptSettled = false;
    const syncAttempt = process(queuedPatientForm, createPatientFormSyncOptions())
      .then(
        () => ({ status: 'fulfilled' as const, error: undefined }),
        (error: unknown) => ({ status: 'rejected' as const, error }),
      )
      .finally(() => {
        attemptSettled = true;
      });

    await vi.waitFor(() => expect(mockOpenmrsFetch).toHaveBeenCalledTimes(2));
    await Promise.resolve();
    expect(attemptSettled).toBe(false);

    pendingPersonWrite.resolve(successfulFetchResponse);
    const outcome = await syncAttempt;

    expect(outcome.status).toBe('rejected');
    expect(outcome.error).toEqual(new Error('The offline patient form could not be synchronized.'));
    expect(String(outcome.error)).not.toContain(sensitiveEncounterError);
  });

  it('starts the sibling write and sanitizes a synchronous write failure', async () => {
    const sensitiveEncounterError = 'Synchronous encounter failure for private-patient-uuid';
    mockOpenmrsFetch.mockImplementation((url) => {
      if (url === '/ws/rest/v1/encounter') {
        throw new Error(sensitiveEncounterError);
      }

      return Promise.resolve(successfulFetchResponse);
    });
    await setupPatientFormSync();
    const process = mockSetupOfflineSync.mock.calls[0][2];
    const syncAttempt = process(queuedPatientForm, createPatientFormSyncOptions());

    await expect(syncAttempt).rejects.toThrow('The offline patient form could not be synchronized.');
    await expect(syncAttempt).rejects.not.toThrow(sensitiveEncounterError);
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(2);
    expect(mockOpenmrsFetch).toHaveBeenCalledWith(
      '/ws/rest/v1/person/person-uuid',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('fails form synchronization when the service worker rejects route registration', async () => {
    mockMessageOmrsServiceWorker.mockResolvedValue({
      success: false,
      error: 'The service worker is unavailable.',
    });

    await setupDynamicFormDataHandler();

    const handler = mockSetupDynamicOfflineDataHandler.mock.calls[0]?.[0];
    expect(handler).toBeDefined();
    await expect(handler?.sync('synthetic-form-uuid')).rejects.toThrow(
      'Some form data could not be properly downloaded.',
    );
    expect(mockMessageOmrsServiceWorker).toHaveBeenCalledTimes(2);
    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
  });

  it('requires fresh form-list responses and preserves stale cache entries while offline', async () => {
    const stableUrls = [formEncounterUrl, formEncounterUrlPoc].map(
      (url) => `${globalThis.location.origin}/openmrs${url}`,
    );
    const cachedResponses = new Map(stableUrls.map((url) => [url, new Response('stale form list', { status: 200 })]));
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
        ? new Response('fresh form list', { status: 200 })
        : (cachedResponses.get(requestUrl)?.clone() ?? new Response(null, { status: 503 }));
    });
    vi.stubGlobal('fetch', fetchMock);
    mockMessageOmrsServiceWorker.mockResolvedValue({ success: true });

    await setupDynamicFormDataHandler();
    const handler = mockSetupDynamicOfflineDataHandler.mock.calls[0]?.[0];
    const abortController = new AbortController();

    await expect(handler?.sync('synthetic-form-uuid', abortController.signal)).rejects.toThrow(
      'Some form data could not be properly downloaded.',
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(cachePut).not.toHaveBeenCalled();
    for (const stableUrl of stableUrls) {
      await expect(cachedResponses.get(stableUrl)?.clone().text()).resolves.toBe('stale form list');
    }

    networkAvailable = true;
    await expect(handler?.sync('synthetic-form-uuid', abortController.signal)).resolves.toBeUndefined();
    expect(cachePut).toHaveBeenCalledTimes(2);
    for (const stableUrl of stableUrls) {
      await expect(cachedResponses.get(stableUrl)?.clone().text()).resolves.toBe('fresh form list');
    }
    for (const refreshCall of fetchMock.mock.calls) {
      expect(refreshCall[0].toString()).toContain('_openmrsOfflineRefresh=');
      expect(refreshCall[1]).toMatchObject({
        cache: 'no-store',
        headers: {
          'x-omrs-offline-caching-strategy': 'network-only-or-cache-only',
        },
        signal: abortController.signal,
      });
    }
    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
  });
});
