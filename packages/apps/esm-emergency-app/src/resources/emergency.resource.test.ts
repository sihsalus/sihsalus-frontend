import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import {
  loadTriageTransitionCheckpoint,
  saveTriageTransitionCheckpoint,
} from '../emergency-workflow/triage-transition-reconciliation-checkpoint';
import {
  assertEmergencyQueueEntryActive,
  createEmergencyQueueEntry,
  EmergencyQueueEntryCreationConflictError,
  EmergencyQueueEntryCreationNotAttemptedError,
  EmergencyQueueEntryCreationRejectedError,
  EmergencyQueueEntryCreationVerificationError,
  EmergencyQueueEntryInactiveError,
  EmergencyQueueEntrySearchInvalidResponseError,
  EmergencyQueueEntryTransitionConflictError,
  EmergencyQueueEntryTransitionAmbiguousError,
  EmergencyQueueEntryTransitionNotAppliedError,
  EmergencyQueueEntryVerificationError,
  endEmergencyQueueEntry,
  isDefinitiveEmergencyQueueCreateRejection,
  MultipleActiveEmergencyQueueEntriesError,
  transitionToAttentionQueue,
} from './emergency.resource';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

function queueEntryResponse(data: Record<string, unknown>, date?: string) {
  return {
    data,
    headers: new Headers(date ? { Date: date } : {}),
    status: 200,
  } as Awaited<ReturnType<typeof openmrsFetch>>;
}

function queueEntrySearchResponse(results: Array<Record<string, unknown>> = []) {
  return { data: { results }, status: 200 } as Awaited<ReturnType<typeof openmrsFetch>>;
}

const createdQueueEntry = {
  uuid: 'queue-entry-uuid',
  endedAt: null,
  patient: { uuid: 'patient-uuid' },
  visit: { uuid: 'visit-uuid' },
  queue: { uuid: 'queue-uuid' },
  status: { uuid: 'waiting-status-uuid' },
  priority: { uuid: 'priority-uuid' },
};

function mockSuccessfulQueueCreation(entry = createdQueueEntry) {
  mockOpenmrsFetch
    .mockResolvedValueOnce(queueEntrySearchResponse())
    .mockResolvedValueOnce(queueEntrySearchResponse())
    .mockResolvedValueOnce(queueEntryResponse({ uuid: entry.uuid }))
    .mockResolvedValueOnce(queueEntrySearchResponse([entry]));
}

describe('createEmergencyQueueEntry', () => {
  beforeEach(() => {
    mockOpenmrsFetch.mockReset();
  });

  it('preserves sortWeight 0 for direct emergency attention', async () => {
    mockSuccessfulQueueCreation({
      ...createdQueueEntry,
      status: { uuid: 'in-service-uuid' },
      priority: { uuid: 'priority-i-uuid' },
    });

    await createEmergencyQueueEntry(
      'patient-uuid',
      'visit-uuid',
      'priority-i-uuid',
      'in-service-uuid',
      'queue-uuid',
      0,
    );

    expect(mockOpenmrsFetch).toHaveBeenCalledWith(`${restBaseUrl}/visit-queue-entry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: expect.objectContaining({
        queueEntry: expect.objectContaining({
          sortWeight: 0,
        }),
      }),
    });
  });

  it('defaults sortWeight only when none is provided', async () => {
    mockSuccessfulQueueCreation();

    await createEmergencyQueueEntry('patient-uuid', 'visit-uuid', 'priority-uuid', 'waiting-status-uuid', 'queue-uuid');

    expect(mockOpenmrsFetch).toHaveBeenCalledWith(
      `${restBaseUrl}/visit-queue-entry`,
      expect.objectContaining({
        body: expect.objectContaining({
          queueEntry: expect.objectContaining({
            sortWeight: 4,
          }),
        }),
      }),
    );
  });

  it('returns a matching active visit entry without posting a duplicate', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce(queueEntrySearchResponse([createdQueueEntry]));

    await expect(
      createEmergencyQueueEntry('patient-uuid', 'visit-uuid', 'priority-uuid', 'waiting-status-uuid', 'queue-uuid'),
    ).resolves.toMatchObject({ data: { uuid: 'queue-entry-uuid' } });
    expect(mockOpenmrsFetch).toHaveBeenCalledOnce();
    expect(mockOpenmrsFetch.mock.calls[0][0]).toContain('visit=visit-uuid');
  });

  it('reconciles a successful write whose response was lost', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce(queueEntrySearchResponse())
      .mockResolvedValueOnce(queueEntrySearchResponse())
      .mockRejectedValueOnce(new Error('network response lost'))
      .mockResolvedValueOnce(queueEntrySearchResponse([createdQueueEntry]));

    await expect(
      createEmergencyQueueEntry('patient-uuid', 'visit-uuid', 'priority-uuid', 'waiting-status-uuid', 'queue-uuid'),
    ).resolves.toMatchObject({ data: { uuid: 'queue-entry-uuid' } });
  });

  it('fails closed when a 2xx response has no persisted matching entry', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce(queueEntrySearchResponse())
      .mockResolvedValueOnce(queueEntrySearchResponse())
      .mockResolvedValueOnce(queueEntryResponse({}))
      .mockResolvedValueOnce(queueEntrySearchResponse());

    await expect(
      createEmergencyQueueEntry('patient-uuid', 'visit-uuid', 'priority-uuid', 'waiting-status-uuid', 'queue-uuid'),
    ).rejects.toBeInstanceOf(EmergencyQueueEntryCreationVerificationError);
  });

  it('rejects multiple active entries created by a concurrent race', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce(
      queueEntrySearchResponse([createdQueueEntry, { ...createdQueueEntry, uuid: 'duplicate-entry-uuid' }]),
    );

    const promise = createEmergencyQueueEntry(
      'patient-uuid',
      'visit-uuid',
      'priority-uuid',
      'waiting-status-uuid',
      'queue-uuid',
    );
    await expect(promise).rejects.toBeInstanceOf(EmergencyQueueEntryCreationNotAttemptedError);
    await expect(promise).rejects.toMatchObject({
      originalError: expect.any(MultipleActiveEmergencyQueueEntriesError),
    });
  });

  it('rejects a conflicting active entry for the same visit', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce(
      queueEntrySearchResponse([{ ...createdQueueEntry, queue: { uuid: 'different-queue' } }]),
    );

    await expect(
      createEmergencyQueueEntry('patient-uuid', 'visit-uuid', 'priority-uuid', 'waiting-status-uuid', 'queue-uuid'),
    ).rejects.toMatchObject({
      originalError: expect.any(EmergencyQueueEntryCreationConflictError),
    });
  });

  it('rejects an invalid reconciliation response instead of posting blindly', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce(queueEntryResponse({}));

    await expect(
      createEmergencyQueueEntry('patient-uuid', 'visit-uuid', 'priority-uuid', 'waiting-status-uuid', 'queue-uuid'),
    ).rejects.toMatchObject({
      originalError: expect.any(EmergencyQueueEntrySearchInvalidResponseError),
    });
    expect(mockOpenmrsFetch).toHaveBeenCalledOnce();
  });

  it('marks only an explicitly rejected POST as safe to retry after empty reconciliation', async () => {
    const postRejection = { response: { status: 400 } };
    mockOpenmrsFetch
      .mockResolvedValueOnce(queueEntrySearchResponse())
      .mockResolvedValueOnce(queueEntrySearchResponse())
      .mockRejectedValueOnce(postRejection)
      .mockResolvedValueOnce(queueEntrySearchResponse());

    const promise = createEmergencyQueueEntry(
      'patient-uuid',
      'visit-uuid',
      'priority-uuid',
      'waiting-status-uuid',
      'queue-uuid',
    );
    await expect(promise).rejects.toBeInstanceOf(EmergencyQueueEntryCreationRejectedError);

    try {
      await promise;
    } catch (error) {
      expect(isDefinitiveEmergencyQueueCreateRejection(error)).toBe(true);
    }
  });

  it('keeps an explicit POST error ambiguous when the reconciliation read is unavailable', async () => {
    const postRejection = { response: { status: 400 } };
    mockOpenmrsFetch
      .mockResolvedValueOnce(queueEntrySearchResponse())
      .mockResolvedValueOnce(queueEntrySearchResponse())
      .mockRejectedValueOnce(postRejection)
      .mockRejectedValueOnce({ response: { status: 403 } });

    const promise = createEmergencyQueueEntry(
      'patient-uuid',
      'visit-uuid',
      'priority-uuid',
      'waiting-status-uuid',
      'queue-uuid',
    );
    await expect(promise).rejects.toBe(postRejection);
    expect(isDefinitiveEmergencyQueueCreateRejection(postRejection)).toBe(false);
  });

  it('does not classify a failed post-write verification as a rejected POST', async () => {
    const verificationReadError = { response: { status: 403 } };
    mockOpenmrsFetch
      .mockResolvedValueOnce(queueEntrySearchResponse())
      .mockResolvedValueOnce(queueEntrySearchResponse())
      .mockResolvedValueOnce(queueEntryResponse({ uuid: 'queue-entry-uuid' }))
      .mockRejectedValueOnce(verificationReadError);

    const promise = createEmergencyQueueEntry(
      'patient-uuid',
      'visit-uuid',
      'priority-uuid',
      'waiting-status-uuid',
      'queue-uuid',
    );
    await expect(promise).rejects.toBe(verificationReadError);
    expect(isDefinitiveEmergencyQueueCreateRejection(verificationReadError)).toBe(false);
  });
});

const activeQueueEntry = {
  uuid: 'queue-entry-uuid',
  startedAt: '2026-07-15T15:00:00.000Z',
  endedAt: null,
  patient: { uuid: 'patient-uuid' },
  visit: { uuid: 'visit-uuid' },
  queue: { uuid: 'queue-uuid' },
  status: { uuid: 'status-uuid' },
};

const expectedQueueContext = {
  patientUuid: 'patient-uuid',
  visitUuid: 'visit-uuid',
  queueUuid: 'queue-uuid',
  statusUuid: 'status-uuid',
};

describe('assertEmergencyQueueEntryActive', () => {
  beforeEach(() => {
    mockOpenmrsFetch.mockReset();
  });

  it('verifies the current patient, visit, queue and status', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce(queueEntryResponse(activeQueueEntry));

    await expect(assertEmergencyQueueEntryActive('queue-entry-uuid', expectedQueueContext)).resolves.toMatchObject({
      data: { uuid: 'queue-entry-uuid', endedAt: null },
    });
  });

  it('rejects an entry that already ended before the clinical write', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce(
      queueEntryResponse({ ...activeQueueEntry, endedAt: '2026-07-15T15:20:00.000Z' }),
    );

    await expect(assertEmergencyQueueEntryActive('queue-entry-uuid', expectedQueueContext)).rejects.toBeInstanceOf(
      EmergencyQueueEntryInactiveError,
    );
  });

  it('fails closed when the queue context changed', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce(
      queueEntryResponse({ ...activeQueueEntry, patient: { uuid: 'different-patient' } }),
    );

    await expect(assertEmergencyQueueEntryActive('queue-entry-uuid', expectedQueueContext)).rejects.toBeInstanceOf(
      EmergencyQueueEntryVerificationError,
    );
  });
});

describe('endEmergencyQueueEntry', () => {
  beforeEach(() => {
    mockOpenmrsFetch.mockReset();
  });

  it('fresh-reads, closes with the server time, and verifies persistence', async () => {
    const serverDate = 'Wed, 15 Jul 2026 15:30:00 GMT';
    mockOpenmrsFetch
      .mockResolvedValueOnce(queueEntryResponse(activeQueueEntry, serverDate))
      .mockResolvedValueOnce(queueEntryResponse({ uuid: 'queue-entry-uuid' }))
      .mockResolvedValueOnce(queueEntryResponse({ ...activeQueueEntry, endedAt: '2026-07-15T15:30:00.000Z' }))
      .mockResolvedValueOnce(queueEntrySearchResponse());

    await endEmergencyQueueEntry('queue-entry-uuid', expectedQueueContext);

    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(4);
    expect(mockOpenmrsFetch.mock.calls[0][0]).toContain('/queue-entry/queue-entry-uuid?v=');
    expect(mockOpenmrsFetch.mock.calls[1][0]).toBe(`${restBaseUrl}/queue-entry/queue-entry-uuid`);
    expect(mockOpenmrsFetch.mock.calls[1][1]).toMatchObject({ method: 'POST' });
    const persistedEndDate = (mockOpenmrsFetch.mock.calls[1][1]?.body as { endedAt: string }).endedAt;
    expect(new Date(persistedEndDate).toISOString()).toBe('2026-07-15T15:30:00.000Z');
  });

  it('preserves an existing closure without posting again', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce(
      queueEntryResponse({ ...activeQueueEntry, endedAt: '2026-07-15T15:20:00.000Z' }),
    );
    mockOpenmrsFetch.mockResolvedValueOnce(queueEntrySearchResponse());

    await expect(endEmergencyQueueEntry('queue-entry-uuid')).resolves.toMatchObject({
      data: { endedAt: '2026-07-15T15:20:00.000Z' },
    });
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(2);
    expect(mockOpenmrsFetch.mock.calls[1][0]).toContain('queueComingFrom=queue-uuid');
  });

  it('reconciles a lost write response when the entry is already ended', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce(queueEntryResponse(activeQueueEntry))
      .mockRejectedValueOnce(new Error('network response lost'))
      .mockResolvedValueOnce(queueEntryResponse({ ...activeQueueEntry, endedAt: '2026-07-15T15:30:00.000Z' }))
      .mockResolvedValueOnce(queueEntrySearchResponse());

    await expect(endEmergencyQueueEntry('queue-entry-uuid')).resolves.toMatchObject({
      data: { endedAt: '2026-07-15T15:30:00.000Z' },
    });
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(4);
  });

  it('fails closed when the persisted closure cannot be verified', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce(queueEntryResponse(activeQueueEntry))
      .mockResolvedValueOnce(queueEntryResponse({ uuid: 'queue-entry-uuid' }))
      .mockResolvedValueOnce(queueEntryResponse(activeQueueEntry));

    await expect(endEmergencyQueueEntry('queue-entry-uuid')).rejects.toThrow(/could not be verified/u);
  });

  it('rejects a prior transition instead of treating any endedAt as this closure', async () => {
    const endedEntry = { ...activeQueueEntry, endedAt: '2026-07-15T15:20:00.000Z' };
    const successor = {
      ...activeQueueEntry,
      uuid: 'successor-entry-uuid',
      startedAt: endedEntry.endedAt,
      queueComingFrom: { uuid: 'queue-uuid' },
    };
    mockOpenmrsFetch
      .mockResolvedValueOnce(queueEntryResponse(endedEntry))
      .mockResolvedValueOnce(queueEntrySearchResponse([successor]));

    await expect(endEmergencyQueueEntry('queue-entry-uuid')).rejects.toBeInstanceOf(
      EmergencyQueueEntryTransitionConflictError,
    );
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(2);
  });

  it('recognizes an exact transition successor even when its timestamp is slightly later', async () => {
    const endedEntry = { ...activeQueueEntry, endedAt: '2026-07-15T15:20:00.000Z' };
    const successor = {
      ...activeQueueEntry,
      uuid: 'successor-entry-uuid',
      startedAt: '2026-07-15T15:20:01.000Z',
      queueComingFrom: { uuid: 'queue-uuid' },
      previousQueueEntry: { uuid: 'queue-entry-uuid' },
    };
    mockOpenmrsFetch
      .mockResolvedValueOnce(queueEntryResponse(endedEntry))
      .mockResolvedValueOnce(queueEntrySearchResponse([successor]));

    await expect(endEmergencyQueueEntry('queue-entry-uuid')).rejects.toBeInstanceOf(
      EmergencyQueueEntryTransitionConflictError,
    );
  });

  it('surfaces a concurrent transition when the close response was lost', async () => {
    const endedEntry = { ...activeQueueEntry, endedAt: '2026-07-15T15:20:00.000Z' };
    const successor = {
      ...activeQueueEntry,
      uuid: 'successor-entry-uuid',
      startedAt: endedEntry.endedAt,
      queueComingFrom: { uuid: 'queue-uuid' },
    };
    mockOpenmrsFetch
      .mockResolvedValueOnce(queueEntryResponse(activeQueueEntry))
      .mockRejectedValueOnce(new Error('network response lost'))
      .mockResolvedValueOnce(queueEntryResponse(endedEntry))
      .mockResolvedValueOnce(queueEntrySearchResponse([successor]));

    await expect(endEmergencyQueueEntry('queue-entry-uuid')).rejects.toBeInstanceOf(
      EmergencyQueueEntryTransitionConflictError,
    );
  });

  it('fails closed when the transition search response is malformed', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce(queueEntryResponse({ ...activeQueueEntry, endedAt: '2026-07-15T15:20:00.000Z' }))
      .mockResolvedValueOnce(queueEntryResponse({}));

    await expect(endEmergencyQueueEntry('queue-entry-uuid')).rejects.toBeInstanceOf(
      EmergencyQueueEntryVerificationError,
    );
  });
});

const triageTransitionContext = {
  sourceQueueEntryUuid: 'queue-entry-uuid',
  patientUuid: 'patient-uuid',
  visitUuid: 'visit-uuid',
  sourceQueueUuid: 'triage-queue-uuid',
  sourceStatusUuid: 'in-service-status-uuid',
  targetQueueUuid: 'attention-queue-uuid',
  targetStatusUuid: 'waiting-status-uuid',
  targetPriorityUuid: 'priority-i-uuid',
};

const activeTriageEntry = {
  ...activeQueueEntry,
  queue: { uuid: triageTransitionContext.sourceQueueUuid },
  status: { uuid: triageTransitionContext.sourceStatusUuid },
  priority: { uuid: 'triage-priority-uuid' },
};

const endedTriageEntry = {
  ...activeTriageEntry,
  endedAt: '2026-07-15T15:20:00.000Z',
};

const attentionSuccessor = {
  ...endedTriageEntry,
  uuid: 'attention-entry-uuid',
  startedAt: '2026-07-15T15:20:01.000Z',
  endedAt: null,
  queue: { uuid: triageTransitionContext.targetQueueUuid },
  status: { uuid: triageTransitionContext.targetStatusUuid },
  priority: { uuid: triageTransitionContext.targetPriorityUuid },
  queueComingFrom: { uuid: triageTransitionContext.sourceQueueUuid },
  previousQueueEntry: { uuid: triageTransitionContext.sourceQueueEntryUuid },
};

describe('transitionToAttentionQueue', () => {
  beforeEach(() => {
    mockOpenmrsFetch.mockReset();
    sessionStorage.clear();
  });

  it('fresh-reads, transitions once, and verifies the exact persisted successor', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce(queueEntryResponse(activeTriageEntry))
      .mockResolvedValueOnce(queueEntryResponse({ uuid: 'transition-response-uuid' }))
      .mockResolvedValueOnce(queueEntryResponse(endedTriageEntry))
      .mockResolvedValueOnce(queueEntrySearchResponse([attentionSuccessor]));

    await expect(transitionToAttentionQueue(triageTransitionContext)).resolves.toMatchObject({
      data: { uuid: 'attention-entry-uuid' },
    });

    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(4);
    expect(mockOpenmrsFetch).toHaveBeenNthCalledWith(2, `${restBaseUrl}/queue-entry/transition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        queueEntryToTransition: triageTransitionContext.sourceQueueEntryUuid,
        newQueue: triageTransitionContext.targetQueueUuid,
        newPriority: triageTransitionContext.targetPriorityUuid,
        newStatus: triageTransitionContext.targetStatusUuid,
      },
    });
    expect(loadTriageTransitionCheckpoint(triageTransitionContext.sourceQueueEntryUuid)).toBeNull();
  });

  it('reconciles a successful transition whose HTTP response was lost', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce(queueEntryResponse(activeTriageEntry))
      .mockRejectedValueOnce(new Error('network response lost'))
      .mockResolvedValueOnce(queueEntryResponse(endedTriageEntry))
      .mockResolvedValueOnce(queueEntrySearchResponse([attentionSuccessor]));

    await expect(transitionToAttentionQueue(triageTransitionContext)).resolves.toMatchObject({
      data: { uuid: 'attention-entry-uuid' },
    });
    expect(mockOpenmrsFetch.mock.calls.filter(([url]) => url === `${restBaseUrl}/queue-entry/transition`)).toHaveLength(
      1,
    );
    expect(loadTriageTransitionCheckpoint(triageTransitionContext.sourceQueueEntryUuid)).toBeNull();
  });

  it('only reconciles a durable pending checkpoint and never repeats the POST', async () => {
    expect(saveTriageTransitionCheckpoint({ version: 1, ...triageTransitionContext })).toBe(true);
    mockOpenmrsFetch
      .mockResolvedValueOnce(queueEntryResponse(endedTriageEntry))
      .mockResolvedValueOnce(queueEntrySearchResponse([attentionSuccessor]));

    await expect(transitionToAttentionQueue(triageTransitionContext)).resolves.toMatchObject({
      data: { uuid: 'attention-entry-uuid' },
    });
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(2);
    expect(mockOpenmrsFetch.mock.calls.some(([url]) => url === `${restBaseUrl}/queue-entry/transition`)).toBe(false);
  });

  it('preserves a pending checkpoint after confirming the transition was not applied without posting', async () => {
    expect(saveTriageTransitionCheckpoint({ version: 1, ...triageTransitionContext })).toBe(true);
    mockOpenmrsFetch.mockResolvedValueOnce(queueEntryResponse(activeTriageEntry));

    await expect(transitionToAttentionQueue(triageTransitionContext)).rejects.toBeInstanceOf(
      EmergencyQueueEntryTransitionNotAppliedError,
    );
    expect(mockOpenmrsFetch).toHaveBeenCalledOnce();
    expect(loadTriageTransitionCheckpoint(triageTransitionContext.sourceQueueEntryUuid)).not.toBeNull();
  });

  it('fails closed and preserves the checkpoint when a 2xx transition has no verifiable successor', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce(queueEntryResponse(activeTriageEntry))
      .mockResolvedValueOnce(queueEntryResponse({ uuid: 'transition-response-uuid' }))
      .mockResolvedValueOnce(queueEntryResponse(endedTriageEntry))
      .mockResolvedValueOnce(queueEntrySearchResponse());

    await expect(transitionToAttentionQueue(triageTransitionContext)).rejects.toBeInstanceOf(
      EmergencyQueueEntryTransitionAmbiguousError,
    );
    expect(loadTriageTransitionCheckpoint(triageTransitionContext.sourceQueueEntryUuid)).toEqual({
      version: 1,
      ...triageTransitionContext,
    });
  });

  it('rejects an incompatible successor and preserves the checkpoint', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce(queueEntryResponse(activeTriageEntry))
      .mockResolvedValueOnce(queueEntryResponse({ uuid: 'transition-response-uuid' }))
      .mockResolvedValueOnce(queueEntryResponse(endedTriageEntry))
      .mockResolvedValueOnce(
        queueEntrySearchResponse([{ ...attentionSuccessor, queue: { uuid: 'different-attention-queue' } }]),
      );

    await expect(transitionToAttentionQueue(triageTransitionContext)).rejects.toBeInstanceOf(
      EmergencyQueueEntryTransitionConflictError,
    );
    expect(loadTriageTransitionCheckpoint(triageTransitionContext.sourceQueueEntryUuid)).not.toBeNull();
  });

  it('rejects multiple direct successors instead of accepting the first result', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce(queueEntryResponse(activeTriageEntry))
      .mockResolvedValueOnce(queueEntryResponse({ uuid: 'transition-response-uuid' }))
      .mockResolvedValueOnce(queueEntryResponse(endedTriageEntry))
      .mockResolvedValueOnce(
        queueEntrySearchResponse([attentionSuccessor, { ...attentionSuccessor, uuid: 'second-attention-entry-uuid' }]),
      );

    await expect(transitionToAttentionQueue(triageTransitionContext)).rejects.toBeInstanceOf(
      EmergencyQueueEntryTransitionConflictError,
    );
  });

  it('fails closed on a malformed transition search response', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce(queueEntryResponse(activeTriageEntry))
      .mockResolvedValueOnce(queueEntryResponse({ uuid: 'transition-response-uuid' }))
      .mockResolvedValueOnce(queueEntryResponse(endedTriageEntry))
      .mockResolvedValueOnce(queueEntryResponse({}));

    await expect(transitionToAttentionQueue(triageTransitionContext)).rejects.toBeInstanceOf(
      EmergencyQueueEntryVerificationError,
    );
  });
});
