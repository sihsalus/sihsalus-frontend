import {
  deleteSynchronizationItem,
  getSynchronizationItem,
  omrsOfflineCachingStrategyHttpHeaderName,
  openmrsFetch,
  queueSynchronizationItem,
  restBaseUrl,
  setupOfflineSync,
  type SyncProcessOptions,
} from '@openmrs/esm-framework';
import { assertFreshPatientIsAlive } from '@openmrs/esm-patient-common-lib';

import {
  buildVitalsEncounter,
  persistVitalsEncounter,
  reconcileVitalsQueueContent,
  setupVitalsSync,
  synchronizeVitalsEncounter,
  type VitalsEncounterCreate,
  type VitalsSyncItemContent,
  vitalsSyncType,
} from './vitals-sync';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  deleteSynchronizationItem: vi.fn(),
  getSynchronizationItem: vi.fn(),
  omrsOfflineCachingStrategyHttpHeaderName: 'x-omrs-offline-caching-strategy',
  openmrsFetch: vi.fn(),
  queueSynchronizationItem: vi.fn(),
  setupOfflineSync: vi.fn(),
}));

vi.mock('@openmrs/esm-patient-common-lib', async () => ({
  ...(await vi.importActual('@openmrs/esm-patient-common-lib')),
  assertFreshPatientIsAlive: vi.fn(),
}));

const encounterUuid = '11111111-1111-4111-8111-111111111111';
const codedValueUuid = '22222222-2222-4222-8222-222222222222';
const providerUuid = '33333333-3333-4333-8333-333333333333';
const encounterRoleUuid = '44444444-4444-4444-8444-444444444444';
const attemptUuid = '55555555-5555-4555-8555-555555555555';

const mockAssertFreshPatientIsAlive = vi.mocked(assertFreshPatientIsAlive);
const mockDeleteSynchronizationItem = vi.mocked(deleteSynchronizationItem);
const mockGetSynchronizationItem = vi.mocked(getSynchronizationItem);
const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const mockQueueSynchronizationItem = vi.mocked(queueSynchronizationItem);
const mockSetupOfflineSync = vi.mocked(setupOfflineSync);

function createEncounter(overrides: Partial<VitalsEncounterCreate> = {}): VitalsEncounterCreate {
  return {
    uuid: encounterUuid,
    patient: 'synthetic-patient-uuid',
    location: 'synthetic-location-uuid',
    encounterType: 'synthetic-encounter-type-uuid',
    visit: 'synthetic-visit-uuid',
    encounterDatetime: '2026-08-24T17:45:00.000Z',
    encounterProviders: [{ provider: providerUuid, encounterRole: encounterRoleUuid }],
    obs: [
      { concept: 'pulse-concept-uuid', value: 80 },
      { concept: 'coded-concept-uuid', value: codedValueUuid },
      { concept: 'note-concept-uuid', value: 'SYNTHETIC' },
    ],
    ...overrides,
  };
}

function createRecoveredEncounter(overrides: Record<string, unknown> = {}) {
  const encounter = createEncounter();
  return {
    uuid: encounter.uuid,
    patient: { uuid: encounter.patient },
    location: { uuid: encounter.location },
    encounterType: { uuid: encounter.encounterType },
    visit: { uuid: encounter.visit },
    encounterDatetime: encounter.encounterDatetime,
    voided: false,
    encounterProviders: [
      {
        provider: { uuid: providerUuid },
        encounterRole: { uuid: encounterRoleUuid },
        voided: false,
      },
    ],
    obs: [
      { concept: { uuid: 'pulse-concept-uuid' }, value: 80, voided: false },
      { concept: { uuid: 'coded-concept-uuid' }, value: { uuid: codedValueUuid }, voided: false },
      { concept: { uuid: 'note-concept-uuid' }, value: 'SYNTHETIC', voided: false },
    ],
    ...overrides,
  };
}

function createSyncOptions(initialContent: VitalsSyncItemContent) {
  let content = initialContent;
  const abort = new AbortController();
  const updateContent: NonNullable<SyncProcessOptions<VitalsSyncItemContent>['updateContent']> = vi.fn(
    async (update) => {
      content = update(content);
      return content;
    },
  );
  return {
    options: {
      abort,
      dependencies: [],
      index: 0,
      items: [initialContent],
      updateContent,
      userId: 'synthetic-user-uuid',
    } satisfies SyncProcessOptions<VitalsSyncItemContent>,
    getContent: () => content,
  };
}

describe('vitals offline persistence', () => {
  let queuedContent: VitalsSyncItemContent | undefined;
  let nextQueueId: number;
  let currentQueueId: number | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    queuedContent = undefined;
    nextQueueId = 1;
    currentQueueId = undefined;
    mockAssertFreshPatientIsAlive.mockResolvedValue({ dead: false, deathDate: null, isDeceased: false });
    mockQueueSynchronizationItem.mockImplementation(async (_type, proposedContent, _descriptor, options) => {
      const proposedVitals = proposedContent as VitalsSyncItemContent;
      queuedContent =
        (options?.reconcileContent?.(queuedContent, proposedVitals) as VitalsSyncItemContent | undefined) ??
        proposedVitals;
      currentQueueId = nextQueueId++;
      return currentQueueId;
    });
    mockGetSynchronizationItem.mockImplementation(async (itemId) =>
      itemId === currentQueueId && queuedContent
        ? ({
            id: itemId,
            type: vitalsSyncType,
            content: queuedContent,
            descriptor: {},
            createdOn: new Date(),
            userId: 'synthetic-user-uuid',
          } as Awaited<ReturnType<typeof getSynchronizationItem<VitalsSyncItemContent>>>)
        : undefined,
    );
    mockDeleteSynchronizationItem.mockImplementation(async (itemId) => {
      if (itemId === currentQueueId) {
        queuedContent = undefined;
      }
    });
  });

  it('builds an immutable encounter with a stable UUID and only configured observations', () => {
    const encounter = buildVitalsEncounter({
      concepts: {
        pulseUuid: 'pulse-concept-uuid',
        generalPatientNoteUuid: 'note-concept-uuid',
      } as never,
      encounterDatetime: new Date('2026-08-24T17:45:00.000Z'),
      encounterRoleUuid,
      encounterTypeUuid: 'synthetic-encounter-type-uuid',
      encounterUuid,
      locationUuid: 'synthetic-location-uuid',
      patientUuid: 'synthetic-patient-uuid',
      providerUuid,
      visitUuid: 'synthetic-visit-uuid',
      vitals: {
        computedBodyMassIndex: 20,
        generalPatientNote: 'SYNTHETIC',
        pulse: 80,
      },
    });

    expect(encounter).toEqual({
      uuid: encounterUuid,
      patient: 'synthetic-patient-uuid',
      location: 'synthetic-location-uuid',
      encounterType: 'synthetic-encounter-type-uuid',
      visit: 'synthetic-visit-uuid',
      encounterDatetime: '2026-08-24T17:45:00.000Z',
      encounterProviders: [{ provider: providerUuid, encounterRole: encounterRoleUuid }],
      obs: [
        { concept: 'note-concept-uuid', value: 'SYNTHETIC' },
        { concept: 'pulse-concept-uuid', value: 80 },
      ],
    });
  });

  it('queues before checking the patient or posting, then removes the row only after an exact response', async () => {
    const events: Array<string> = [];
    mockQueueSynchronizationItem.mockImplementation(async (_type, proposedContent, _descriptor, options) => {
      const proposedVitals = proposedContent as VitalsSyncItemContent;
      queuedContent =
        (options?.reconcileContent?.(queuedContent, proposedVitals) as VitalsSyncItemContent | undefined) ??
        proposedVitals;
      events.push(`queue:${queuedContent._syncState?.encounter?.status ?? 'initial'}`);
      currentQueueId = nextQueueId++;
      return currentQueueId;
    });
    mockAssertFreshPatientIsAlive.mockImplementation(async () => {
      events.push('patient-check');
      return { dead: false, deathDate: null, isDeceased: false };
    });
    mockOpenmrsFetch.mockImplementation(async () => {
      events.push('post');
      return { data: { uuid: encounterUuid } } as Awaited<ReturnType<typeof openmrsFetch>>;
    });

    await expect(
      persistVitalsEncounter(createEncounter(), {
        abortController: new AbortController(),
        displayName: 'Synthetic vitals',
      }),
    ).resolves.toEqual({ status: 'confirmed', encounterUuid });

    expect(events).toEqual(['queue:initial', 'patient-check', 'queue:attempted', 'post', 'queue:completed']);
    expect(mockOpenmrsFetch).toHaveBeenCalledWith(`${restBaseUrl}/encounter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: createEncounter(),
      signal: expect.any(AbortSignal),
      rejectOnAuthFailure: true,
    });
    expect(mockQueueSynchronizationItem.mock.calls[0]?.[2]).toEqual({
      id: encounterUuid,
      displayName: 'Synthetic vitals',
      patientUuid: 'synthetic-patient-uuid',
      dependencies: [{ type: 'visit', id: 'synthetic-visit-uuid' }],
    });
    expect(mockDeleteSynchronizationItem).toHaveBeenCalledOnce();
    expect(queuedContent).toBeUndefined();
  });

  it('keeps an unattempted item queued when the authoritative patient check is unavailable', async () => {
    mockAssertFreshPatientIsAlive.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(
      persistVitalsEncounter(createEncounter(), {
        abortController: new AbortController(),
        displayName: 'Synthetic vitals',
      }),
    ).resolves.toEqual({ status: 'queued', encounterUuid });

    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
    expect(mockDeleteSynchronizationItem).not.toHaveBeenCalled();
    expect(queuedContent?._syncState).toBeUndefined();
  });

  it('treats a checkpoint failure after the initial durable write as queued instead of inviting a duplicate', async () => {
    let queueCall = 0;
    mockQueueSynchronizationItem.mockImplementation(async (_type, proposedContent, _descriptor, options) => {
      queueCall += 1;
      if (queueCall === 2) {
        throw new Error('Synthetic checkpoint failure');
      }
      const proposedVitals = proposedContent as VitalsSyncItemContent;
      queuedContent =
        (options?.reconcileContent?.(queuedContent, proposedVitals) as VitalsSyncItemContent | undefined) ??
        proposedVitals;
      currentQueueId = nextQueueId++;
      return currentQueueId;
    });

    await expect(
      persistVitalsEncounter(createEncounter(), {
        abortController: new AbortController(),
        displayName: 'Synthetic vitals',
      }),
    ).resolves.toEqual({ status: 'queued', encounterUuid });

    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
    expect(queuedContent).toEqual({ _id: encounterUuid, encounter: createEncounter() });
  });

  it('removes an unattempted item and fails closed when the patient is authoritatively deceased', async () => {
    const deceasedError = Object.assign(new Error('Blocked'), { code: 'DECEASED_PATIENT_OPERATION_BLOCKED' });
    mockAssertFreshPatientIsAlive.mockRejectedValue(deceasedError);

    await expect(
      persistVitalsEncounter(createEncounter(), {
        abortController: new AbortController(),
        displayName: 'Synthetic vitals',
      }),
    ).rejects.toBe(deceasedError);

    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
    expect(mockDeleteSynchronizationItem).toHaveBeenCalledOnce();
  });

  it('retains an attempted item after an ambiguous server failure', async () => {
    mockOpenmrsFetch.mockRejectedValue({ response: { status: 500 } });

    await expect(
      persistVitalsEncounter(createEncounter(), {
        abortController: new AbortController(),
        displayName: 'Synthetic vitals',
      }),
    ).resolves.toEqual({ status: 'queued', encounterUuid });

    expect(queuedContent?._syncState?.encounter).toMatchObject({ status: 'attempted' });
    expect(mockDeleteSynchronizationItem).not.toHaveBeenCalled();
  });

  it('removes a definitively rejected write and keeps the form responsible for presenting the error', async () => {
    mockOpenmrsFetch.mockRejectedValue({ response: { status: 400 } });

    await expect(
      persistVitalsEncounter(createEncounter(), {
        abortController: new AbortController(),
        displayName: 'Synthetic vitals',
      }),
    ).rejects.toEqual(new Error('The offline vitals could not be queued.'));

    expect(mockDeleteSynchronizationItem).toHaveBeenCalledOnce();
  });

  it('does not let a replacement erase or alter an existing write checkpoint', () => {
    const encounter = createEncounter();
    const existing: VitalsSyncItemContent = {
      _id: encounter.uuid,
      encounter,
      _syncState: {
        encounter: { status: 'attempted', payload: encounter, attemptId: attemptUuid },
      },
    };

    expect(reconcileVitalsQueueContent(existing, { _id: encounter.uuid, encounter }, 'initial')).toBe(existing);
    expect(() =>
      reconcileVitalsQueueContent(
        existing,
        { _id: encounter.uuid, encounter: { ...encounter, location: 'different-location' } },
        'initial',
      ),
    ).toThrow('The offline vitals could not be queued.');
  });
});

describe('vitals synchronization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertFreshPatientIsAlive.mockResolvedValue({ dead: false, deathDate: null, isDeceased: false });
  });

  it('registers after visit synchronization', () => {
    setupVitalsSync();

    expect(mockSetupOfflineSync).toHaveBeenCalledWith(vitalsSyncType, ['visit'], synchronizeVitalsEncounter);
  });

  it('fresh-checks the patient, claims the write, posts once, and checkpoints completion', async () => {
    const item: VitalsSyncItemContent = { _id: encounterUuid, encounter: createEncounter() };
    const state = createSyncOptions(item);
    mockOpenmrsFetch
      .mockRejectedValueOnce({ response: { status: 404 } })
      .mockResolvedValueOnce({ data: { uuid: encounterUuid } } as Awaited<ReturnType<typeof openmrsFetch>>);

    await expect(synchronizeVitalsEncounter(item, state.options)).resolves.toEqual({ uuid: encounterUuid });

    expect(mockAssertFreshPatientIsAlive).toHaveBeenCalledWith('synthetic-patient-uuid', state.options.abort.signal);
    expect(mockOpenmrsFetch.mock.calls[0]?.[0]).toContain(`${restBaseUrl}/encounter/${encounterUuid}?`);
    expect(mockOpenmrsFetch.mock.calls[0]?.[1]).toEqual({
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-store',
        [omrsOfflineCachingStrategyHttpHeaderName]: 'network-only-or-cache-only',
      },
      signal: state.options.abort.signal,
      rejectOnAuthFailure: true,
    });
    expect(mockOpenmrsFetch.mock.calls[1]).toEqual([
      `${restBaseUrl}/encounter`,
      expect.objectContaining({ body: item.encounter, signal: state.options.abort.signal }),
    ]);
    expect(state.getContent()._syncState?.encounter).toMatchObject({
      status: 'completed',
      payload: item.encounter,
    });
  });

  it('reconciles an exact committed encounter after a lost response without replaying the POST', async () => {
    const item: VitalsSyncItemContent = {
      _id: encounterUuid,
      encounter: createEncounter(),
      _syncState: {
        encounter: { status: 'attempted', payload: createEncounter(), attemptId: attemptUuid },
      },
    };
    const state = createSyncOptions(item);
    mockOpenmrsFetch.mockResolvedValue({ data: createRecoveredEncounter() } as Awaited<
      ReturnType<typeof openmrsFetch>
    >);

    await expect(synchronizeVitalsEncounter(item, state.options)).resolves.toMatchObject({ uuid: encounterUuid });

    expect(mockOpenmrsFetch).toHaveBeenCalledOnce();
    expect(state.getContent()._syncState?.encounter).toEqual({
      status: 'completed',
      payload: item.encounter,
      attemptId: attemptUuid,
    });
  });

  it('fails closed when the recovered encounter observations differ', async () => {
    const item: VitalsSyncItemContent = { _id: encounterUuid, encounter: createEncounter() };
    const state = createSyncOptions(item);
    mockOpenmrsFetch.mockResolvedValue({
      data: createRecoveredEncounter({
        obs: [{ concept: { uuid: 'pulse-concept-uuid' }, value: 79, voided: false }],
      }),
    } as Awaited<ReturnType<typeof openmrsFetch>>);

    await expect(synchronizeVitalsEncounter(item, state.options)).rejects.toEqual(
      new Error('The offline vitals could not be synchronized.'),
    );

    expect(mockOpenmrsFetch).toHaveBeenCalledOnce();
    expect(state.getContent()._syncState).toBeUndefined();
  });

  it('never blindly replays an attempted write while the recovery read is absent', async () => {
    const item: VitalsSyncItemContent = {
      _id: encounterUuid,
      encounter: createEncounter(),
      _syncState: {
        encounter: { status: 'attempted', payload: createEncounter(), attemptId: attemptUuid },
      },
    };
    const state = createSyncOptions(item);
    mockOpenmrsFetch.mockRejectedValue({ response: { status: 404 } });

    await expect(synchronizeVitalsEncounter(item, state.options)).rejects.toEqual(
      new Error('The offline vitals could not be synchronized.'),
    );

    expect(mockOpenmrsFetch).toHaveBeenCalledOnce();
    expect(state.getContent()).toEqual(item);
  });

  it('finishes a durably completed row without another network request', async () => {
    const encounter = createEncounter();
    const item: VitalsSyncItemContent = {
      _id: encounterUuid,
      encounter,
      _syncState: {
        encounter: { status: 'completed', payload: encounter, attemptId: attemptUuid },
      },
    };
    const state = createSyncOptions(item);

    await expect(synchronizeVitalsEncounter(item, state.options)).resolves.toEqual({ uuid: encounterUuid });

    expect(mockAssertFreshPatientIsAlive).not.toHaveBeenCalled();
    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
  });
});
