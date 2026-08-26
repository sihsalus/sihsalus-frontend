import {
  deleteSynchronizationItem,
  getSynchronizationItem,
  omrsOfflineCachingStrategyHttpHeaderName,
  openmrsFetch,
  queueSynchronizationItem,
  restBaseUrl,
  type SyncProcessOptions,
  setupOfflineSync,
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
const serverDateHeader = 'Mon, 24 Aug 2026 17:45:00 GMT';

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
      {
        concept: { uuid: 'coded-concept-uuid' },
        value: { uuid: codedValueUuid },
        voided: false,
      },
      {
        concept: { uuid: 'note-concept-uuid' },
        value: 'SYNTHETIC',
        voided: false,
      },
    ],
    ...overrides,
  };
}

function createVisitTimingResponse({
  serverDate = serverDateHeader,
  startDatetime = '2026-08-24T17:30:00.000Z',
  stopDatetime = null,
  includeStopDatetime = true,
  voided = false,
  patientUuid = 'synthetic-patient-uuid',
  visitUuid = 'synthetic-visit-uuid',
}: {
  serverDate?: string | null;
  startDatetime?: string;
  stopDatetime?: string | null;
  includeStopDatetime?: boolean;
  voided?: boolean;
  patientUuid?: string;
  visitUuid?: string;
} = {}) {
  return {
    data: {
      uuid: visitUuid,
      startDatetime,
      ...(includeStopDatetime ? { stopDatetime } : {}),
      voided,
      patient: { uuid: patientUuid },
    },
    headers: {
      get: vi.fn((name: string) => (name.toLowerCase() === 'date' ? serverDate : null)),
    },
  } as unknown as Awaited<ReturnType<typeof openmrsFetch>>;
}

function isEncounterPost(call: (typeof mockOpenmrsFetch.mock.calls)[number]) {
  return call[0] === `${restBaseUrl}/encounter` && call[1]?.method === 'POST';
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
    mockAssertFreshPatientIsAlive.mockResolvedValue({
      dead: false,
      deathDate: null,
      isDeceased: false,
    });
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
    mockOpenmrsFetch.mockImplementation(async (url) => {
      if (url.toString().includes(`/visit/synthetic-visit-uuid?`)) {
        events.push('visit-time');
        return createVisitTimingResponse();
      }
      events.push('post');
      return { data: { uuid: encounterUuid } } as Awaited<ReturnType<typeof openmrsFetch>>;
    });

    await expect(
      persistVitalsEncounter(createEncounter(), {
        abortController: new AbortController(),
        displayName: 'Synthetic vitals',
      }),
    ).resolves.toEqual({ status: 'confirmed', encounterUuid });

    expect(events).toEqual([
      'queue:initial',
      'patient-check',
      'visit-time',
      'queue:attempted',
      'post',
      'queue:completed',
    ]);
    expect(mockOpenmrsFetch.mock.calls[0]?.[0]).toContain(`${restBaseUrl}/visit/synthetic-visit-uuid?`);
    expect(
      new URL(mockOpenmrsFetch.mock.calls[0]?.[0].toString() ?? '', 'https://synthetic.invalid').searchParams.get('v'),
    ).toContain('voided');
    expect(mockOpenmrsFetch.mock.calls[0]?.[1]).toEqual({
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-store',
        [omrsOfflineCachingStrategyHttpHeaderName]: 'network-only-or-cache-only',
      },
      signal: expect.any(AbortSignal),
      rejectOnAuthFailure: true,
    });
    expect(mockOpenmrsFetch.mock.calls[1]).toEqual([
      `${restBaseUrl}/encounter`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: createEncounter(),
        signal: expect.any(AbortSignal),
        rejectOnAuthFailure: true,
      },
    ]);
    expect(mockQueueSynchronizationItem.mock.calls[0]?.[2]).toEqual({
      id: encounterUuid,
      displayName: 'Synthetic vitals',
      patientUuid: 'synthetic-patient-uuid',
      dependencies: [{ type: 'visit', id: 'synthetic-visit-uuid' }],
    });
    expect(mockDeleteSynchronizationItem).toHaveBeenCalledOnce();
    expect(queuedContent).toBeUndefined();
  });

  it.each([
    ['ahead', '2099-08-24T17:45:00.000Z'],
    ['behind', '2020-08-24T17:45:00.000Z'],
  ])('replaces an online browser clock that is %s with the authoritative server time', async (_clockState, clientTime) => {
    const submittedEncounter = createEncounter({
      encounterDatetime: clientTime,
    });
    const authoritativeEncounter = createEncounter({
      encounterDatetime: '2026-08-24T17:45:00.000Z',
    });
    mockOpenmrsFetch
      .mockResolvedValueOnce(createVisitTimingResponse())
      .mockResolvedValueOnce({ data: { uuid: encounterUuid } } as Awaited<ReturnType<typeof openmrsFetch>>);

    await expect(
      persistVitalsEncounter(submittedEncounter, {
        abortController: new AbortController(),
        displayName: 'Synthetic vitals',
      }),
    ).resolves.toEqual({ status: 'confirmed', encounterUuid });

    expect(mockQueueSynchronizationItem.mock.calls[0]?.[1]).toEqual({
      _id: encounterUuid,
      encounter: submittedEncounter,
    });
    expect(mockQueueSynchronizationItem.mock.calls[1]?.[1]).toEqual({
      _id: encounterUuid,
      encounter: authoritativeEncounter,
    });
    expect(mockOpenmrsFetch.mock.calls.find(isEncounterPost)?.[1]).toMatchObject({ body: authoritativeEncounter });
    expect(mockDeleteSynchronizationItem).toHaveBeenCalledOnce();
  });

  it('retains the triage workspace location when the authoritative visit timing omits location', async () => {
    const submittedEncounter = createEncounter({
      encounterDatetime: '2099-08-24T17:45:00.000Z',
      location: 'synthetic-triage-workspace-location-uuid',
    });
    const authoritativeEncounter = {
      ...submittedEncounter,
      encounterDatetime: '2026-08-24T17:45:00.000Z',
    };
    mockOpenmrsFetch
      .mockResolvedValueOnce(createVisitTimingResponse())
      .mockResolvedValueOnce({ data: { uuid: encounterUuid } } as Awaited<ReturnType<typeof openmrsFetch>>);

    await expect(
      persistVitalsEncounter(submittedEncounter, {
        abortController: new AbortController(),
        displayName: 'Synthetic vitals',
      }),
    ).resolves.toEqual({ status: 'confirmed', encounterUuid });

    expect(mockOpenmrsFetch.mock.calls.find(isEncounterPost)?.[1]).toMatchObject({ body: authoritativeEncounter });
    expect(mockQueueSynchronizationItem.mock.calls[1]?.[1]).toEqual({
      _id: encounterUuid,
      encounter: authoritativeEncounter,
    });
  });

  it.each([
    ['missing', null],
    ['malformed', 'not-an-http-date'],
  ])('keeps the original item unattempted when the server Date header is %s', async (_case, serverDate) => {
    const encounter = createEncounter({
      encounterDatetime: '2099-08-24T17:45:00.000Z',
    });
    mockOpenmrsFetch.mockResolvedValue(createVisitTimingResponse({ serverDate }));

    await expect(
      persistVitalsEncounter(encounter, {
        abortController: new AbortController(),
        displayName: 'Synthetic vitals',
      }),
    ).resolves.toEqual({ status: 'queued', encounterUuid });

    expect(mockQueueSynchronizationItem).toHaveBeenCalledOnce();
    expect(queuedContent).toEqual({ _id: encounterUuid, encounter });
    expect(queuedContent?._syncState).toBeUndefined();
    expect(mockOpenmrsFetch.mock.calls.some(isEncounterPost)).toBe(false);
    expect(mockDeleteSynchronizationItem).not.toHaveBeenCalled();
  });

  it('clamps the online encounter to a visit start within the Date header precision window', async () => {
    const visitStart = '2026-08-24T17:45:00.750Z';
    const authoritativeEncounter = createEncounter({
      encounterDatetime: visitStart,
    });
    mockOpenmrsFetch
      .mockResolvedValueOnce(createVisitTimingResponse({ startDatetime: visitStart }))
      .mockResolvedValueOnce({ data: { uuid: encounterUuid } } as Awaited<ReturnType<typeof openmrsFetch>>);

    await expect(
      persistVitalsEncounter(createEncounter(), {
        abortController: new AbortController(),
        displayName: 'Synthetic vitals',
      }),
    ).resolves.toEqual({ status: 'confirmed', encounterUuid });

    expect(mockQueueSynchronizationItem.mock.calls[1]?.[1]).toEqual({
      _id: encounterUuid,
      encounter: authoritativeEncounter,
    });
    expect(mockOpenmrsFetch.mock.calls.find(isEncounterPost)?.[1]).toMatchObject({ body: authoritativeEncounter });
  });

  it('keeps an online item unattempted when the visit starts beyond the Date header precision window', async () => {
    mockOpenmrsFetch.mockResolvedValue(createVisitTimingResponse({ startDatetime: '2026-08-24T17:45:01.000Z' }));

    await expect(
      persistVitalsEncounter(createEncounter(), {
        abortController: new AbortController(),
        displayName: 'Synthetic vitals',
      }),
    ).resolves.toEqual({ status: 'queued', encounterUuid });

    expect(mockQueueSynchronizationItem).toHaveBeenCalledOnce();
    expect(queuedContent).toEqual({
      _id: encounterUuid,
      encounter: createEncounter(),
    });
    expect(mockOpenmrsFetch.mock.calls.some(isEncounterPost)).toBe(false);
    expect(mockDeleteSynchronizationItem).not.toHaveBeenCalled();
  });

  it.each([
    ['missing', createVisitTimingResponse({ includeStopDatetime: false })],
    ['empty', createVisitTimingResponse({ stopDatetime: '' })],
    ['malformed', createVisitTimingResponse({ stopDatetime: 'not-a-datetime' })],
  ])('keeps an online item unattempted when stopDatetime is %s', async (_case, timingResponse) => {
    mockOpenmrsFetch.mockResolvedValue(timingResponse);

    await expect(
      persistVitalsEncounter(createEncounter(), {
        abortController: new AbortController(),
        displayName: 'Synthetic vitals',
      }),
    ).resolves.toEqual({ status: 'queued', encounterUuid });

    expect(mockQueueSynchronizationItem).toHaveBeenCalledOnce();
    expect(queuedContent).toEqual({ _id: encounterUuid, encounter: createEncounter() });
    expect(queuedContent?._syncState).toBeUndefined();
    expect(mockOpenmrsFetch.mock.calls.some(isEncounterPost)).toBe(false);
    expect(mockDeleteSynchronizationItem).not.toHaveBeenCalled();
  });

  it('keeps an online item unattempted when the authoritative visit has a valid stopDatetime', async () => {
    mockOpenmrsFetch.mockResolvedValue(createVisitTimingResponse({ stopDatetime: '2026-08-24T17:44:59.999Z' }));

    await expect(
      persistVitalsEncounter(createEncounter(), {
        abortController: new AbortController(),
        displayName: 'Synthetic vitals',
      }),
    ).resolves.toEqual({ status: 'queued', encounterUuid });

    expect(mockQueueSynchronizationItem).toHaveBeenCalledOnce();
    expect(queuedContent).toEqual({ _id: encounterUuid, encounter: createEncounter() });
    expect(queuedContent?._syncState).toBeUndefined();
    expect(mockOpenmrsFetch.mock.calls.some(isEncounterPost)).toBe(false);
    expect(mockDeleteSynchronizationItem).not.toHaveBeenCalled();
  });

  it('keeps an online item unattempted when the authoritative visit is voided', async () => {
    mockOpenmrsFetch.mockResolvedValue(createVisitTimingResponse({ voided: true }));

    await expect(
      persistVitalsEncounter(createEncounter(), {
        abortController: new AbortController(),
        displayName: 'Synthetic vitals',
      }),
    ).resolves.toEqual({ status: 'queued', encounterUuid });

    expect(mockQueueSynchronizationItem).toHaveBeenCalledOnce();
    expect(queuedContent).toEqual({ _id: encounterUuid, encounter: createEncounter() });
    expect(queuedContent?._syncState).toBeUndefined();
    expect(mockOpenmrsFetch.mock.calls.some(isEncounterPost)).toBe(false);
    expect(mockDeleteSynchronizationItem).not.toHaveBeenCalled();
  });

  it('keeps the initial item unattempted when the server-time queue transition fails', async () => {
    let queueCall = 0;
    mockQueueSynchronizationItem.mockImplementation(async (_type, proposedContent, _descriptor, options) => {
      queueCall += 1;
      if (queueCall === 2) {
        throw new Error('Synthetic server-time transition failure');
      }
      const proposedVitals = proposedContent as VitalsSyncItemContent;
      queuedContent =
        (options?.reconcileContent?.(queuedContent, proposedVitals) as VitalsSyncItemContent | undefined) ??
        proposedVitals;
      currentQueueId = nextQueueId++;
      return currentQueueId;
    });
    const encounter = createEncounter({
      encounterDatetime: '2099-08-24T17:45:00.000Z',
    });
    mockOpenmrsFetch.mockResolvedValue(createVisitTimingResponse());

    await expect(
      persistVitalsEncounter(encounter, {
        abortController: new AbortController(),
        displayName: 'Synthetic vitals',
      }),
    ).resolves.toEqual({ status: 'queued', encounterUuid });

    expect(mockQueueSynchronizationItem).toHaveBeenCalledTimes(2);
    expect(queuedContent).toEqual({ _id: encounterUuid, encounter });
    expect(queuedContent?._syncState).toBeUndefined();
    expect(mockOpenmrsFetch.mock.calls.some(isEncounterPost)).toBe(false);
    expect(mockDeleteSynchronizationItem).not.toHaveBeenCalled();
  });

  it.each([
    ['undefined', undefined],
    [
      'different',
      {
        _id: encounterUuid,
        encounter: createEncounter({ location: 'synthetic-unexpected-location-uuid' }),
      } satisfies VitalsSyncItemContent,
    ],
  ])('does not POST when the durable server-time readback is %s', async (_case, readbackContent) => {
    const submittedEncounter = createEncounter({ encounterDatetime: '2099-08-24T17:45:00.000Z' });
    mockOpenmrsFetch.mockResolvedValue(createVisitTimingResponse());
    mockGetSynchronizationItem.mockResolvedValueOnce(
      readbackContent
        ? ({
            id: 2,
            type: vitalsSyncType,
            content: readbackContent,
            descriptor: {},
            createdOn: new Date(),
            userId: 'synthetic-user-uuid',
          } as Awaited<ReturnType<typeof getSynchronizationItem<VitalsSyncItemContent>>>)
        : undefined,
    );

    await expect(
      persistVitalsEncounter(submittedEncounter, {
        abortController: new AbortController(),
        displayName: 'Synthetic vitals',
      }),
    ).resolves.toEqual({ status: 'queued', encounterUuid });

    expect(mockQueueSynchronizationItem).toHaveBeenCalledTimes(2);
    expect(queuedContent).toEqual({ _id: encounterUuid, encounter: createEncounter() });
    expect(queuedContent?._syncState).toBeUndefined();
    expect(mockOpenmrsFetch.mock.calls.some(isEncounterPost)).toBe(false);
    expect(mockDeleteSynchronizationItem).not.toHaveBeenCalled();
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
    mockOpenmrsFetch.mockResolvedValue(createVisitTimingResponse());

    await expect(
      persistVitalsEncounter(createEncounter(), {
        abortController: new AbortController(),
        displayName: 'Synthetic vitals',
      }),
    ).resolves.toEqual({ status: 'queued', encounterUuid });

    expect(mockOpenmrsFetch).toHaveBeenCalledOnce();
    expect(mockOpenmrsFetch.mock.calls[0]?.[0]).toContain(`${restBaseUrl}/visit/synthetic-visit-uuid?`);
    expect(mockOpenmrsFetch.mock.calls.some(isEncounterPost)).toBe(false);
    expect(queuedContent).toEqual({
      _id: encounterUuid,
      encounter: createEncounter(),
    });
  });

  it('removes an unattempted item and fails closed when the patient is authoritatively deceased', async () => {
    const deceasedError = Object.assign(new Error('Blocked'), {
      code: 'DECEASED_PATIENT_OPERATION_BLOCKED',
    });
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
    const submittedEncounter = createEncounter({ encounterDatetime: '2099-08-24T17:45:00.000Z' });
    const authoritativeEncounter = createEncounter();
    mockOpenmrsFetch
      .mockResolvedValueOnce(createVisitTimingResponse())
      .mockRejectedValueOnce({ response: { status: 500 } });

    await expect(
      persistVitalsEncounter(submittedEncounter, {
        abortController: new AbortController(),
        displayName: 'Synthetic vitals',
      }),
    ).resolves.toEqual({ status: 'queued', encounterUuid });

    expect(queuedContent?.encounter).toEqual(authoritativeEncounter);
    expect(queuedContent?._syncState?.encounter).toMatchObject({
      status: 'attempted',
      payload: authoritativeEncounter,
    });
    expect(mockDeleteSynchronizationItem).not.toHaveBeenCalled();
  });

  it('removes a definitively rejected write and keeps the form responsible for presenting the error', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce(createVisitTimingResponse())
      .mockRejectedValueOnce({ response: { status: 400 } });

    await expect(
      persistVitalsEncounter(createEncounter(), {
        abortController: new AbortController(),
        displayName: 'Synthetic vitals',
      }),
    ).rejects.toEqual(new Error('The offline vitals could not be queued.'));

    expect(mockDeleteSynchronizationItem).toHaveBeenCalledOnce();
  });

  it('allows only the datetime to change during the pre-checkpoint server-time transition', () => {
    const encounter = createEncounter({
      encounterDatetime: '2099-08-24T17:45:00.000Z',
    });
    const serverTimedEncounter = {
      ...encounter,
      encounterDatetime: '2026-08-24T17:45:00.000Z',
    };
    const existing: VitalsSyncItemContent = { _id: encounter.uuid, encounter };
    const proposed: VitalsSyncItemContent = {
      _id: encounter.uuid,
      encounter: serverTimedEncounter,
    };

    expect(reconcileVitalsQueueContent(existing, proposed, 'server-time')).toEqual(proposed);
    expect(() =>
      reconcileVitalsQueueContent(
        existing,
        {
          ...proposed,
          encounter: {
            ...serverTimedEncounter,
            obs: [{ concept: 'pulse-concept-uuid', value: 79 }],
          },
        },
        'server-time',
      ),
    ).toThrow('The offline vitals could not be queued.');

    const checkpointed: VitalsSyncItemContent = {
      ...existing,
      _syncState: {
        encounter: {
          status: 'attempted',
          payload: encounter,
          attemptId: attemptUuid,
        },
      },
    };
    expect(() => reconcileVitalsQueueContent(checkpointed, proposed, 'server-time')).toThrow(
      'The offline vitals could not be queued.',
    );
  });

  it('does not let a replacement erase or alter an existing write checkpoint', () => {
    const encounter = createEncounter();
    const existing: VitalsSyncItemContent = {
      _id: encounter.uuid,
      encounter,
      _syncState: {
        encounter: {
          status: 'attempted',
          payload: encounter,
          attemptId: attemptUuid,
        },
      },
    };

    expect(reconcileVitalsQueueContent(existing, { _id: encounter.uuid, encounter }, 'initial')).toBe(existing);
    expect(() =>
      reconcileVitalsQueueContent(
        existing,
        {
          _id: encounter.uuid,
          encounter: { ...encounter, location: 'different-location' },
        },
        'initial',
      ),
    ).toThrow('The offline vitals could not be queued.');
  });
});

describe('vitals synchronization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertFreshPatientIsAlive.mockResolvedValue({
      dead: false,
      deathDate: null,
      isDeceased: false,
    });
  });

  it('registers after visit synchronization', () => {
    setupVitalsSync();

    expect(mockSetupOfflineSync).toHaveBeenCalledWith(vitalsSyncType, ['visit'], synchronizeVitalsEncounter);
  });

  it('fresh-checks the patient, claims the write, posts once, and checkpoints completion', async () => {
    const item: VitalsSyncItemContent = {
      _id: encounterUuid,
      encounter: createEncounter(),
    };
    const state = createSyncOptions(item);
    mockOpenmrsFetch
      .mockRejectedValueOnce({ response: { status: 404 } })
      .mockResolvedValueOnce(createVisitTimingResponse())
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
    expect(mockOpenmrsFetch.mock.calls[1]?.[0]).toContain(`${restBaseUrl}/visit/synthetic-visit-uuid?`);
    expect(mockOpenmrsFetch.mock.calls[1]?.[1]).toEqual({
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-store',
        [omrsOfflineCachingStrategyHttpHeaderName]: 'network-only-or-cache-only',
      },
      signal: state.options.abort.signal,
      rejectOnAuthFailure: true,
    });
    expect(mockOpenmrsFetch.mock.calls[2]).toEqual([
      `${restBaseUrl}/encounter`,
      expect.objectContaining({
        body: item.encounter,
        signal: state.options.abort.signal,
      }),
    ]);
    expect(state.getContent()._syncState?.encounter).toMatchObject({
      status: 'completed',
      payload: item.encounter,
    });
  });

  it('preserves the exact offline capture time when it is valid at reconnect', async () => {
    const capturedEncounter = createEncounter({
      encounterDatetime: '2026-08-24T17:44:30.250Z',
    });
    const item: VitalsSyncItemContent = {
      _id: encounterUuid,
      encounter: capturedEncounter,
    };
    const state = createSyncOptions(item);
    mockOpenmrsFetch
      .mockRejectedValueOnce({ response: { status: 404 } })
      .mockResolvedValueOnce(
        createVisitTimingResponse({
          serverDate: 'Mon, 24 Aug 2026 17:50:00 GMT',
          startDatetime: '2026-08-24T17:30:00.000Z',
        }),
      )
      .mockResolvedValueOnce({ data: { uuid: encounterUuid } } as Awaited<ReturnType<typeof openmrsFetch>>);

    await expect(synchronizeVitalsEncounter(item, state.options)).resolves.toEqual({ uuid: encounterUuid });

    expect(mockOpenmrsFetch.mock.calls[2]).toEqual([
      `${restBaseUrl}/encounter`,
      expect.objectContaining({
        body: capturedEncounter,
        signal: state.options.abort.signal,
      }),
    ]);
    expect(state.getContent().encounter.encounterDatetime).toBe('2026-08-24T17:44:30.250Z');
    expect(state.getContent()._syncState?.encounter).toMatchObject({
      status: 'completed',
      payload: capturedEncounter,
    });
  });

  it('synchronizes an offline capture exactly at a valid visit stopDatetime', async () => {
    const stopDatetime = '2026-08-24T17:45:00.000Z';
    const capturedEncounter = createEncounter({ encounterDatetime: stopDatetime });
    const item: VitalsSyncItemContent = { _id: encounterUuid, encounter: capturedEncounter };
    const state = createSyncOptions(item);
    mockOpenmrsFetch
      .mockRejectedValueOnce({ response: { status: 404 } })
      .mockResolvedValueOnce(
        createVisitTimingResponse({
          serverDate: 'Mon, 24 Aug 2026 17:50:00 GMT',
          stopDatetime,
        }),
      )
      .mockResolvedValueOnce({ data: { uuid: encounterUuid } } as Awaited<ReturnType<typeof openmrsFetch>>);

    await expect(synchronizeVitalsEncounter(item, state.options)).resolves.toEqual({ uuid: encounterUuid });

    expect(mockOpenmrsFetch.mock.calls[2]).toEqual([
      `${restBaseUrl}/encounter`,
      expect.objectContaining({ body: capturedEncounter, signal: state.options.abort.signal }),
    ]);
    expect(state.getContent()._syncState?.encounter).toMatchObject({
      status: 'completed',
      payload: capturedEncounter,
    });
  });

  it('does not synchronize an offline capture after a valid visit stopDatetime', async () => {
    const stopDatetime = '2026-08-24T17:45:00.000Z';
    const item: VitalsSyncItemContent = {
      _id: encounterUuid,
      encounter: createEncounter({ encounterDatetime: '2026-08-24T17:45:00.001Z' }),
    };
    const state = createSyncOptions(item);
    mockOpenmrsFetch.mockRejectedValueOnce({ response: { status: 404 } }).mockResolvedValueOnce(
      createVisitTimingResponse({
        serverDate: 'Mon, 24 Aug 2026 17:50:00 GMT',
        stopDatetime,
      }),
    );

    await expect(synchronizeVitalsEncounter(item, state.options)).rejects.toEqual(
      new Error('The offline vitals could not be synchronized.'),
    );

    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(2);
    expect(mockOpenmrsFetch.mock.calls.some(isEncounterPost)).toBe(false);
    expect(state.options.updateContent).not.toHaveBeenCalled();
    expect(state.getContent()).toEqual(item);
  });

  it.each([
    [
      'after the server upper bound',
      '2026-08-24T17:50:01.000Z',
      createVisitTimingResponse({
        serverDate: 'Mon, 24 Aug 2026 17:50:00 GMT',
      }),
    ],
    [
      'before the visit start',
      '2026-08-24T17:29:59.999Z',
      createVisitTimingResponse({
        serverDate: 'Mon, 24 Aug 2026 17:50:00 GMT',
        startDatetime: '2026-08-24T17:30:00.000Z',
      }),
    ],
    ['without a server Date header', '2026-08-24T17:45:00.000Z', createVisitTimingResponse({ serverDate: null })],
    ['against a voided visit', '2026-08-24T17:45:00.000Z', createVisitTimingResponse({ voided: true })],
  ])('does not attempt an offline write captured %s', async (_case, encounterDatetime, timingResponse) => {
    const item: VitalsSyncItemContent = {
      _id: encounterUuid,
      encounter: createEncounter({ encounterDatetime }),
    };
    const state = createSyncOptions(item);
    mockOpenmrsFetch.mockRejectedValueOnce({ response: { status: 404 } }).mockResolvedValueOnce(timingResponse);

    await expect(synchronizeVitalsEncounter(item, state.options)).rejects.toEqual(
      new Error('The offline vitals could not be synchronized.'),
    );

    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(2);
    expect(mockOpenmrsFetch.mock.calls.some(isEncounterPost)).toBe(false);
    expect(state.options.updateContent).not.toHaveBeenCalled();
    expect(state.getContent()).toEqual(item);
  });

  it('reconciles an exact committed encounter after a lost response without replaying the POST', async () => {
    const item: VitalsSyncItemContent = {
      _id: encounterUuid,
      encounter: createEncounter(),
      _syncState: {
        encounter: {
          status: 'attempted',
          payload: createEncounter(),
          attemptId: attemptUuid,
        },
      },
    };
    const state = createSyncOptions(item);
    mockOpenmrsFetch.mockResolvedValue({
      data: createRecoveredEncounter(),
    } as Awaited<ReturnType<typeof openmrsFetch>>);

    await expect(synchronizeVitalsEncounter(item, state.options)).resolves.toMatchObject({ uuid: encounterUuid });

    expect(mockOpenmrsFetch).toHaveBeenCalledOnce();
    expect(state.getContent()._syncState?.encounter).toEqual({
      status: 'completed',
      payload: item.encounter,
      attemptId: attemptUuid,
    });
  });

  it('fails closed when the recovered encounter observations differ', async () => {
    const item: VitalsSyncItemContent = {
      _id: encounterUuid,
      encounter: createEncounter(),
    };
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
        encounter: {
          status: 'attempted',
          payload: createEncounter(),
          attemptId: attemptUuid,
        },
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
        encounter: {
          status: 'completed',
          payload: encounter,
          attemptId: attemptUuid,
        },
      },
    };
    const state = createSyncOptions(item);

    await expect(synchronizeVitalsEncounter(item, state.options)).resolves.toEqual({ uuid: encounterUuid });

    expect(mockAssertFreshPatientIsAlive).not.toHaveBeenCalled();
    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
  });
});
