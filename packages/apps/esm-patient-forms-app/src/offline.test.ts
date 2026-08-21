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
const generatedEncounterUuid = '22222222-2222-4222-8222-222222222222';
const fixedSynchronizationError = 'The offline patient form could not be synchronized.';

interface TestPatientFormContent {
  _id: string;
  encounter: Record<string, unknown>;
  _syncState?: {
    encounter?: TestWriteCheckpoint<NonNullable<TestPatientFormContent['_payloads']['encounterCreate']>>;
    person?: TestWriteCheckpoint<NonNullable<TestPatientFormContent['_payloads']['personUpdate']>>;
  };
  _payloads: {
    encounterCreate?: {
      uuid?: string;
      encounterDatetime: string;
      patient: string;
      encounterType: string;
      location: string;
      visit?: string;
    };
    personUpdate?: {
      uuid?: string;
      attributes: Array<{ attributeType: string; value: string }>;
    };
  };
}

type TestWriteCheckpoint<T> =
  | { status: 'attempted'; payload: T; attemptId: string }
  | { status: 'completed'; payload: T; attemptId?: string };

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
}

function createPatientFormSyncHarness(initialContent: TestPatientFormContent = queuedPatientForm) {
  let persistedContent = structuredClone(initialContent);
  let pendingUpdate = Promise.resolve();
  const mutations: Array<TestPatientFormContent> = [];
  const updateContent = vi.fn(
    (update: (currentContent: TestPatientFormContent) => TestPatientFormContent): Promise<TestPatientFormContent> => {
      const result = pendingUpdate.then(() => {
        persistedContent = update(persistedContent);
        mutations.push(structuredClone(persistedContent));
        return persistedContent;
      });
      pendingUpdate = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    },
  );

  return {
    getContent: () => structuredClone(persistedContent),
    mutations,
    options: {
      abort: new AbortController(),
      userId: 'user-uuid',
      index: 0,
      items: [],
      dependencies: [{ stopDatetime: '2026-08-20T12:00:00.000Z' }],
      updateContent,
    } satisfies SyncProcessOptions<TestPatientFormContent>,
    updateContent,
  };
}

const queuedPatientForm: TestPatientFormContent = {
  _id: generatedEncounterUuid,
  encounter: {},
  _payloads: {
    encounterCreate: {
      uuid: generatedEncounterUuid,
      encounterDatetime: '2026-08-20T12:00:00.000Z',
      patient: 'patient-uuid',
      encounterType: 'encounter-type-uuid',
      location: 'location-uuid',
    },
    personUpdate: {
      uuid: 'person-uuid',
      attributes: [{ attributeType: 'attribute-type-uuid', value: 'synthetic-value' }],
    },
  },
};

function createNotFoundError(sensitiveDetail = 'Encounter was not found for a synthetic identifier') {
  return Object.assign(new Error(sensitiveDetail), { response: new Response(null, { status: 404 }) });
}

function createEncounterResponse(encounterUuid = generatedEncounterUuid) {
  return {
    data: {
      uuid: encounterUuid,
      encounterDatetime: '2026-08-20T12:00:00.000Z',
      patient: { uuid: 'patient-uuid' },
      encounterType: { uuid: 'encounter-type-uuid' },
      location: { uuid: 'location-uuid' },
      visit: null,
      form: null,
      voided: false,
    },
  } as Awaited<ReturnType<typeof openmrsFetch>>;
}

function isEncounterRecoveryRequest(url: string) {
  return url.startsWith('/ws/rest/v1/encounter/') && url.includes('?');
}

function isPersonRecoveryRequest(url: string) {
  return url.startsWith('/ws/rest/v1/person/person-uuid?');
}

function createPersonResponse(attributes: Array<{ attributeType: string; value: string }> = []) {
  return {
    data: {
      uuid: 'person-uuid',
      attributes: attributes.map((attribute, index) => ({
        uuid: `person-attribute-${index}`,
        attributeType: { uuid: attribute.attributeType },
        value: attribute.value,
        voided: false,
      })),
    },
  } as Awaited<ReturnType<typeof openmrsFetch>>;
}

function getPatientFormSyncProcess() {
  return mockSetupOfflineSync.mock.calls[0][2] as (
    item: TestPatientFormContent,
    options: SyncProcessOptions<TestPatientFormContent>,
  ) => Promise<unknown>;
}

vi.mock('@openmrs/esm-framework', async () => {
  const { refreshOfflineCacheEntry } = await vi.importActual<typeof import('@openmrs/esm-offline/src/public')>(
    '@openmrs/esm-offline/src/public',
  );
  return {
    ...(await vi.importActual('@openmrs/esm-framework')),
    launchWorkspace2: vi.fn(),
    makeUrl: vi.fn(),
    messageOmrsServiceWorker: vi.fn(),
    omrsOfflineCachingStrategyHttpHeaderName: 'x-omrs-offline-caching-strategy',
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
    let personCommitted = false;
    mockOpenmrsFetch.mockImplementation((url) => {
      if (isEncounterRecoveryRequest(url)) {
        return Promise.reject(createNotFoundError());
      }

      if (isPersonRecoveryRequest(url)) {
        return Promise.resolve(
          createPersonResponse(personCommitted ? (queuedPatientForm._payloads.personUpdate?.attributes ?? []) : []),
        );
      }

      if (url === '/ws/rest/v1/encounter') {
        return Promise.resolve(createEncounterResponse());
      }

      if (url === '/ws/rest/v1/person/person-uuid') {
        personCommitted = true;
      }

      return Promise.resolve(successfulFetchResponse);
    });
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
    const process = getPatientFormSyncProcess();
    const abortController = new AbortController();
    const harness = createPatientFormSyncHarness();
    harness.options.abort = abortController;

    await process(harness.getContent(), harness.options);

    expect(mockOpenmrsFetch).toHaveBeenCalledWith(
      '/ws/rest/v1/encounter',
      expect.objectContaining({ rejectOnAuthFailure: true, signal: abortController.signal }),
    );
    expect(mockOpenmrsFetch).toHaveBeenCalledWith(
      '/ws/rest/v1/person/person-uuid',
      expect.objectContaining({ rejectOnAuthFailure: true, signal: abortController.signal }),
    );
    expect(mockOpenmrsFetch).toHaveBeenCalledWith(
      expect.stringMatching(/^\/ws\/rest\/v1\/encounter\/22222222-2222-4222-8222-222222222222\?/),
      expect.objectContaining({
        cache: 'no-store',
        headers: expect.objectContaining({
          'Cache-Control': 'no-store',
          'x-omrs-offline-caching-strategy': 'network-only-or-cache-only',
        }),
        rejectOnAuthFailure: true,
        signal: abortController.signal,
      }),
    );
    expect(mockOpenmrsFetch).toHaveBeenCalledWith(
      expect.stringMatching(/^\/ws\/rest\/v1\/person\/person-uuid\?/),
      expect.objectContaining({
        cache: 'no-store',
        headers: expect.objectContaining({
          'Cache-Control': 'no-store',
          'x-omrs-offline-caching-strategy': 'network-only-or-cache-only',
        }),
        rejectOnAuthFailure: true,
        signal: abortController.signal,
      }),
    );
  });

  it('recovers a response-lost person update without repeating the completed encounter create', async () => {
    let personCommitted = false;
    mockOpenmrsFetch.mockImplementation((url) => {
      if (isEncounterRecoveryRequest(url)) {
        return Promise.reject(createNotFoundError());
      }
      if (isPersonRecoveryRequest(url)) {
        return Promise.resolve(
          createPersonResponse(personCommitted ? (queuedPatientForm._payloads.personUpdate?.attributes ?? []) : []),
        );
      }
      if (url === '/ws/rest/v1/encounter') {
        return Promise.resolve(createEncounterResponse());
      }
      if (url === '/ws/rest/v1/person/person-uuid') {
        personCommitted = true;
        return Promise.reject(new Error('Sensitive person response loss for private-patient-uuid'));
      }
      return Promise.resolve(successfulFetchResponse);
    });
    await setupPatientFormSync();
    const process = getPatientFormSyncProcess();
    const harness = createPatientFormSyncHarness();

    await expect(process(harness.getContent(), harness.options)).rejects.toEqual(new Error(fixedSynchronizationError));
    expect(harness.getContent()._syncState?.encounter?.status).toBe('completed');
    expect(harness.getContent()._syncState?.person?.status).toBe('attempted');

    await expect(process(harness.getContent(), harness.options)).resolves.toBeUndefined();

    expect(harness.getContent()._syncState?.encounter?.status).toBe('completed');
    expect(harness.getContent()._syncState?.person?.status).toBe('completed');
    expect(mockOpenmrsFetch.mock.calls.filter(([url]) => url === '/ws/rest/v1/encounter')).toHaveLength(1);
    expect(mockOpenmrsFetch.mock.calls.filter(([url]) => isEncounterRecoveryRequest(url))).toHaveLength(1);
    expect(mockOpenmrsFetch.mock.calls.filter(([url]) => url === '/ws/rest/v1/person/person-uuid')).toHaveLength(1);
    expect(harness.getContent()._syncState?.encounter?.payload).toEqual(queuedPatientForm._payloads.encounterCreate);
    expect(harness.getContent()._syncState?.person?.payload).toEqual(queuedPatientForm._payloads.personUpdate);
  });

  it('recovers a response-lost encounter create without repeating the completed person update', async () => {
    let encounterCommitted = false;
    let personCommitted = false;
    mockOpenmrsFetch.mockImplementation((url) => {
      if (isEncounterRecoveryRequest(url)) {
        return encounterCommitted ? Promise.resolve(createEncounterResponse()) : Promise.reject(createNotFoundError());
      }
      if (isPersonRecoveryRequest(url)) {
        return Promise.resolve(
          createPersonResponse(personCommitted ? (queuedPatientForm._payloads.personUpdate?.attributes ?? []) : []),
        );
      }
      if (url === '/ws/rest/v1/encounter') {
        encounterCommitted = true;
        return Promise.reject(new Error('Sensitive encounter response loss for private-patient-uuid'));
      }
      if (url === '/ws/rest/v1/person/person-uuid') {
        personCommitted = true;
      }
      return Promise.resolve(successfulFetchResponse);
    });
    await setupPatientFormSync();
    const process = getPatientFormSyncProcess();
    const harness = createPatientFormSyncHarness();

    await expect(process(harness.getContent(), harness.options)).rejects.toEqual(new Error(fixedSynchronizationError));
    expect(harness.getContent()._syncState?.person?.status).toBe('completed');
    expect(harness.getContent()._syncState?.encounter?.status).toBe('attempted');

    await expect(process(harness.getContent(), harness.options)).resolves.toBeUndefined();

    expect(harness.getContent()._syncState?.person?.status).toBe('completed');
    expect(harness.getContent()._syncState?.encounter?.status).toBe('completed');
    expect(mockOpenmrsFetch.mock.calls.filter(([url]) => url === '/ws/rest/v1/person/person-uuid')).toHaveLength(1);
    expect(mockOpenmrsFetch.mock.calls.filter(([url]) => url === '/ws/rest/v1/encounter')).toHaveLength(1);
    expect(mockOpenmrsFetch.mock.calls.filter(([url]) => isEncounterRecoveryRequest(url))).toHaveLength(2);
  });

  it('does not repeat either write while an ambiguous server attempt may still be in flight', async () => {
    const sensitiveAbortDetail = 'Connection aborted after writes for private-patient-uuid';
    mockOpenmrsFetch.mockImplementation((url) => {
      if (isEncounterRecoveryRequest(url)) {
        return Promise.reject(createNotFoundError());
      }
      if (isPersonRecoveryRequest(url)) {
        return Promise.resolve(createPersonResponse());
      }
      if (url === '/ws/rest/v1/encounter') {
        return Promise.reject(new DOMException(sensitiveAbortDetail, 'AbortError'));
      }
      if (url === '/ws/rest/v1/person/person-uuid') {
        return Promise.reject(new DOMException(sensitiveAbortDetail, 'AbortError'));
      }
      return Promise.resolve(successfulFetchResponse);
    });
    await setupPatientFormSync();
    const process = getPatientFormSyncProcess();
    const harness = createPatientFormSyncHarness();

    const firstAttempt = process(harness.getContent(), harness.options);
    await expect(firstAttempt).rejects.toEqual(new Error(fixedSynchronizationError));
    await expect(firstAttempt).rejects.not.toThrow(sensitiveAbortDetail);
    expect(harness.getContent()._syncState?.encounter?.status).toBe('attempted');
    expect(harness.getContent()._syncState?.person?.status).toBe('attempted');

    await expect(process(harness.getContent(), harness.options)).rejects.toEqual(new Error(fixedSynchronizationError));

    const encounterPosts = mockOpenmrsFetch.mock.calls.filter(([url]) => url === '/ws/rest/v1/encounter');
    const personPosts = mockOpenmrsFetch.mock.calls.filter(([url]) => url === '/ws/rest/v1/person/person-uuid');
    expect(encounterPosts).toHaveLength(1);
    expect(personPosts).toHaveLength(1);
    expect(encounterPosts[0][1]?.body).toEqual(queuedPatientForm._payloads.encounterCreate);
    expect(personPosts[0][1]?.body).toEqual(queuedPatientForm._payloads.personUpdate);
    expect(harness.getContent()._syncState?.encounter?.status).toBe('attempted');
    expect(harness.getContent()._syncState?.person?.status).toBe('attempted');
  });

  it('uses one atomic claim across concurrent processors and never downgrades completion', async () => {
    const personOnlyContent = structuredClone(queuedPatientForm);
    delete personOnlyContent._payloads.encounterCreate;
    let personRecoveryReads = 0;
    mockOpenmrsFetch.mockImplementation((url) => {
      if (isPersonRecoveryRequest(url)) {
        personRecoveryReads += 1;
        return Promise.resolve(
          createPersonResponse(
            personRecoveryReads > 2 ? (queuedPatientForm._payloads.personUpdate?.attributes ?? []) : [],
          ),
        );
      }
      return Promise.resolve(successfulFetchResponse);
    });
    await setupPatientFormSync();
    const process = getPatientFormSyncProcess();
    const harness = createPatientFormSyncHarness(personOnlyContent);
    const firstSnapshot = harness.getContent();
    const secondSnapshot = harness.getContent();

    const results = await Promise.allSettled([
      process(firstSnapshot, harness.options),
      process(secondSnapshot, harness.options),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(mockOpenmrsFetch.mock.calls.filter(([url]) => url === '/ws/rest/v1/person/person-uuid')).toHaveLength(1);
    expect(harness.mutations.map((content) => content._syncState?.person?.status)).toEqual(['attempted', 'completed']);
    expect(harness.getContent()._syncState?.person).toEqual({
      status: 'completed',
      payload: queuedPatientForm._payloads.personUpdate,
      attemptId: expect.any(String),
    });
  });

  it('fails closed on duplicate active person attributes without posting or checkpointing', async () => {
    const personOnlyContent = structuredClone(queuedPatientForm);
    delete personOnlyContent._payloads.encounterCreate;
    mockOpenmrsFetch.mockImplementation((url) => {
      if (isPersonRecoveryRequest(url)) {
        return Promise.resolve(
          createPersonResponse([
            { attributeType: 'attribute-type-uuid', value: 'synthetic-value' },
            { attributeType: 'attribute-type-uuid', value: 'conflicting-value' },
          ]),
        );
      }
      return Promise.resolve(successfulFetchResponse);
    });
    await setupPatientFormSync();
    const process = getPatientFormSyncProcess();
    const harness = createPatientFormSyncHarness(personOnlyContent);

    await expect(process(harness.getContent(), harness.options)).rejects.toEqual(new Error(fixedSynchronizationError));

    expect(mockOpenmrsFetch.mock.calls.filter(([url]) => url === '/ws/rest/v1/person/person-uuid')).toHaveLength(0);
    expect(harness.mutations).toEqual([]);
  });

  it('validates every desired person attribute type before reading or writing', async () => {
    const personOnlyContent = structuredClone(queuedPatientForm);
    delete personOnlyContent._payloads.encounterCreate;
    personOnlyContent._payloads.personUpdate?.attributes.push({
      attributeType: 'attribute-type-uuid',
      value: 'conflicting-value',
    });
    await setupPatientFormSync();
    const process = getPatientFormSyncProcess();
    const harness = createPatientFormSyncHarness(personOnlyContent);

    await expect(process(harness.getContent(), harness.options)).rejects.toEqual(new Error(fixedSynchronizationError));
    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
    expect(harness.mutations).toEqual([]);
  });

  it('requires a fresh exact person read after POST and does not blindly retry a mismatch', async () => {
    const personOnlyContent = structuredClone(queuedPatientForm);
    delete personOnlyContent._payloads.encounterCreate;
    mockOpenmrsFetch.mockImplementation((url) => {
      if (isPersonRecoveryRequest(url)) {
        return Promise.resolve(createPersonResponse());
      }
      return Promise.resolve(successfulFetchResponse);
    });
    await setupPatientFormSync();
    const process = getPatientFormSyncProcess();
    const harness = createPatientFormSyncHarness(personOnlyContent);

    await expect(process(harness.getContent(), harness.options)).rejects.toEqual(new Error(fixedSynchronizationError));
    await expect(process(harness.getContent(), harness.options)).rejects.toEqual(new Error(fixedSynchronizationError));

    expect(mockOpenmrsFetch.mock.calls.filter(([url]) => url === '/ws/rest/v1/person/person-uuid')).toHaveLength(1);
    expect(harness.getContent()._syncState?.person).toEqual({
      status: 'attempted',
      payload: queuedPatientForm._payloads.personUpdate,
      attemptId: expect.any(String),
    });
  });

  it('persists the effective encounter datetime before a visit dependency disappears', async () => {
    const encounterOnlyContent = structuredClone(queuedPatientForm);
    delete encounterOnlyContent._payloads.personUpdate;
    delete (encounterOnlyContent._payloads.encounterCreate as { encounterDatetime?: string }).encounterDatetime;
    let encounterCommitted = false;
    mockOpenmrsFetch.mockImplementation((url, init) => {
      if (isEncounterRecoveryRequest(url)) {
        return encounterCommitted ? Promise.resolve(createEncounterResponse()) : Promise.reject(createNotFoundError());
      }
      if (url === '/ws/rest/v1/encounter') {
        expect(init?.body).toMatchObject({ encounterDatetime: '2026-08-20T12:00:00.000Z' });
        encounterCommitted = true;
        return Promise.reject(new Error('Synthetic encounter response loss'));
      }
      return Promise.resolve(successfulFetchResponse);
    });
    await setupPatientFormSync();
    const process = getPatientFormSyncProcess();
    const harness = createPatientFormSyncHarness(encounterOnlyContent);

    await expect(process(harness.getContent(), harness.options)).rejects.toEqual(new Error(fixedSynchronizationError));
    expect(harness.getContent()._payloads.encounterCreate?.encounterDatetime).toBe('2026-08-20T12:00:00.000Z');

    await expect(process(harness.getContent(), { ...harness.options, dependencies: [] })).resolves.toBeUndefined();

    expect(mockOpenmrsFetch.mock.calls.filter(([url]) => url === '/ws/rest/v1/encounter')).toHaveLength(1);
    expect(harness.getContent()._syncState?.encounter).toEqual({
      status: 'completed',
      payload: queuedPatientForm._payloads.encounterCreate,
      attemptId: expect.any(String),
    });
    expect(harness.getContent()._syncState?.encounter?.payload.encounterDatetime).toBe('2026-08-20T12:00:00.000Z');
  });

  it('does not accept a supplied encounter UUID whose recovered clinical identity differs', async () => {
    const encounterOnlyContent = structuredClone(queuedPatientForm);
    delete encounterOnlyContent._payloads.personUpdate;
    mockOpenmrsFetch.mockImplementation((url) => {
      if (isEncounterRecoveryRequest(url)) {
        const response = createEncounterResponse() as Awaited<ReturnType<typeof openmrsFetch>> & {
          data: { location: { uuid: string } };
        };
        response.data.location = { uuid: 'different-location-uuid' };
        return Promise.resolve(response);
      }
      return Promise.resolve(successfulFetchResponse);
    });
    await setupPatientFormSync();
    const process = getPatientFormSyncProcess();
    const harness = createPatientFormSyncHarness(encounterOnlyContent);

    await expect(process(harness.getContent(), harness.options)).rejects.toEqual(new Error(fixedSynchronizationError));
    expect(mockOpenmrsFetch.mock.calls.filter(([url]) => url === '/ws/rest/v1/encounter')).toHaveLength(0);
    expect(harness.getContent()._syncState).toBeUndefined();
  });

  it('fails closed when a recovered encounter has complex children that cannot be compared canonically', async () => {
    const complexContent = structuredClone(queuedPatientForm);
    delete complexContent._payloads.personUpdate;
    Object.assign(complexContent._payloads.encounterCreate ?? {}, { obs: [{ concept: 'synthetic-concept' }] });
    mockOpenmrsFetch.mockResolvedValue(createEncounterResponse());
    await setupPatientFormSync();
    const process = getPatientFormSyncProcess();
    const harness = createPatientFormSyncHarness(complexContent);

    await expect(process(harness.getContent(), harness.options)).rejects.toEqual(new Error(fixedSynchronizationError));
    expect(mockOpenmrsFetch.mock.calls.filter(([url]) => url === '/ws/rest/v1/encounter')).toHaveLength(0);
    expect(harness.getContent()._syncState).toBeUndefined();
  });

  it('does not create an encounter when the fresh recovery read has an unknown outcome', async () => {
    const encounterOnlyContent = structuredClone(queuedPatientForm);
    delete encounterOnlyContent._payloads.personUpdate;
    const sensitiveRecoveryError = 'GET recovery failed at https://clinical.example.test for private-patient-uuid';
    mockOpenmrsFetch.mockRejectedValue(new Error(sensitiveRecoveryError));
    await setupPatientFormSync();
    const process = getPatientFormSyncProcess();
    const harness = createPatientFormSyncHarness(encounterOnlyContent);

    const attempt = process(harness.getContent(), harness.options);
    await expect(attempt).rejects.toEqual(new Error(fixedSynchronizationError));
    await expect(attempt).rejects.not.toThrow(sensitiveRecoveryError);
    expect(mockOpenmrsFetch.mock.calls.filter(([url]) => url === '/ws/rest/v1/encounter')).toHaveLength(0);
    expect(harness.getContent()._syncState).toBeUndefined();
  });

  it('fails closed without mutating or writing an ambiguous legacy row that has no encounter UUID', async () => {
    const legacyContent = structuredClone(queuedPatientForm);
    delete legacyContent._payloads.encounterCreate?.uuid;
    const harness = createPatientFormSyncHarness(legacyContent);
    await setupPatientFormSync();
    const process = getPatientFormSyncProcess();

    await expect(process(harness.getContent(), harness.options)).rejects.toEqual(new Error(fixedSynchronizationError));
    expect(harness.getContent()).toEqual(legacyContent);
    expect(harness.mutations).toEqual([]);
    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
  });

  it('waits for the sibling write before rejecting with one fixed error', async () => {
    const sensitiveEncounterError =
      'POST /encounter failed for patient private-patient-uuid at https://clinical.example.test';
    const pendingPersonWrite = createDeferred<Awaited<ReturnType<typeof openmrsFetch>>>();
    let personCommitted = false;
    mockOpenmrsFetch.mockImplementation((url) => {
      if (isEncounterRecoveryRequest(url)) {
        return Promise.reject(createNotFoundError());
      }
      if (isPersonRecoveryRequest(url)) {
        return Promise.resolve(
          createPersonResponse(personCommitted ? (queuedPatientForm._payloads.personUpdate?.attributes ?? []) : []),
        );
      }
      if (url === '/ws/rest/v1/encounter') {
        return Promise.reject(new Error(sensitiveEncounterError));
      }
      return pendingPersonWrite.promise.then((response) => {
        personCommitted = true;
        return response;
      });
    });
    await setupPatientFormSync();
    const process = getPatientFormSyncProcess();
    const harness = createPatientFormSyncHarness();
    let attemptSettled = false;
    const syncAttempt = process(harness.getContent(), harness.options)
      .then(
        () => ({ status: 'fulfilled' as const, error: undefined }),
        (error: unknown) => ({ status: 'rejected' as const, error }),
      )
      .finally(() => {
        attemptSettled = true;
      });

    await vi.waitFor(() => expect(mockOpenmrsFetch).toHaveBeenCalledTimes(4));
    await Promise.resolve();
    expect(attemptSettled).toBe(false);

    pendingPersonWrite.resolve(successfulFetchResponse);
    const outcome = await syncAttempt;

    expect(outcome.status).toBe('rejected');
    expect(outcome.error).toEqual(new Error(fixedSynchronizationError));
    expect(String(outcome.error)).not.toContain(sensitiveEncounterError);
    expect(harness.getContent()._syncState?.person?.status).toBe('completed');
    expect(harness.getContent()._syncState?.encounter?.status).toBe('attempted');
  });

  it('settles and sanitizes synchronous failures from both writes', async () => {
    const sensitiveEncounterError = 'Synchronous encounter failure for private-patient-uuid';
    const sensitivePersonError = 'Synchronous person failure for private-patient-uuid';
    mockOpenmrsFetch.mockImplementation((url) => {
      if (isEncounterRecoveryRequest(url)) {
        throw createNotFoundError();
      }
      if (isPersonRecoveryRequest(url)) {
        return Promise.resolve(createPersonResponse());
      }
      if (url === '/ws/rest/v1/encounter') {
        throw new Error(sensitiveEncounterError);
      }
      throw new Error(sensitivePersonError);
    });
    await setupPatientFormSync();
    const process = getPatientFormSyncProcess();
    const harness = createPatientFormSyncHarness();
    const syncAttempt = process(harness.getContent(), harness.options);

    await expect(syncAttempt).rejects.toThrow(fixedSynchronizationError);
    await expect(syncAttempt).rejects.not.toThrow(sensitiveEncounterError);
    await expect(syncAttempt).rejects.not.toThrow(sensitivePersonError);
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(4);
    expect(mockOpenmrsFetch).toHaveBeenCalledWith(
      '/ws/rest/v1/person/person-uuid',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(harness.getContent()._syncState?.encounter?.status).toBe('attempted');
    expect(harness.getContent()._syncState?.person?.status).toBe('attempted');
  });

  it('fails closed before a clinical write when the queue cannot persist checkpoints', async () => {
    await setupPatientFormSync();
    const process = getPatientFormSyncProcess();
    const { updateContent: _updateContent, ...optionsWithoutCheckpoint } = createPatientFormSyncHarness().options;

    await expect(process(structuredClone(queuedPatientForm), optionsWithoutCheckpoint)).rejects.toEqual(
      new Error(fixedSynchronizationError),
    );
    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
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
