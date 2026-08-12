import { type FetchResponse, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import {
  assertFreshPatientIsAlive,
  DECEASED_PATIENT_OPERATION_BLOCKED,
  PATIENT_VITAL_STATUS_UNAVAILABLE,
} from '@openmrs/esm-patient-common-lib';
import {
  createEmergencyQueueEntry,
  EMERGENCY_QUEUE_ENTRY_ALREADY_ENDED,
  EMERGENCY_QUEUE_ENTRY_CLOSE_UNVERIFIED,
  EMERGENCY_QUEUE_ENTRY_CREATION_AMBIGUOUS,
  EMERGENCY_QUEUE_ENTRY_CREATION_CONFLICT,
  EMERGENCY_QUEUE_ENTRY_CREATION_UNVERIFIED,
  EMERGENCY_QUEUE_ENTRY_PATIENT_UNAVAILABLE,
  EMERGENCY_QUEUE_ENTRY_SEARCH_STALLED,
  EMERGENCY_QUEUE_ENTRY_TRANSITION_CONFLICT,
  EMERGENCY_QUEUE_ENTRY_TRANSITION_UNVERIFIED,
  EMERGENCY_QUEUE_ENTRY_UPDATE_UNVERIFIED,
  EMERGENCY_QUEUE_ENTRY_UUID_UNAVAILABLE,
  endEmergencyQueueEntry,
  transitionEmergencyQueueEntry,
  transitionToAttentionQueue,
  updateEmergencyQueueEntry,
} from './emergency.resource';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const mockAssertFreshPatientIsAlive = vi.mocked(assertFreshPatientIsAlive);

vi.mock('@openmrs/esm-patient-common-lib', async () => ({
  ...(await vi.importActual('@openmrs/esm-patient-common-lib')),
  assertFreshPatientIsAlive: vi.fn(),
}));

function response<T>(data: T, status = 200) {
  return { data, status, headers: new Headers() } as FetchResponse<T>;
}

function mockLivingPatient() {
  mockAssertFreshPatientIsAlive.mockResolvedValue({ dead: false, deathDate: null, isDeceased: false });
}

const createdEmergencyEntry = {
  uuid: 'queue-entry-uuid',
  startedAt: '2026-08-12T14:00:00.000Z',
  endedAt: null,
  patient: { uuid: 'patient-uuid' },
  visit: { uuid: 'visit-uuid' },
  queue: { uuid: 'queue-uuid' },
  status: { uuid: 'waiting-status-uuid' },
  priority: { uuid: 'priority-uuid' },
  sortWeight: 4,
};

describe('createEmergencyQueueEntry', () => {
  beforeEach(() => {
    mockOpenmrsFetch.mockReset();
    mockAssertFreshPatientIsAlive.mockReset();
    mockAssertFreshPatientIsAlive.mockResolvedValue({ dead: false, deathDate: null, isDeceased: false });
  });

  it('preserves sortWeight 0 for direct emergency attention', async () => {
    const directEntry = {
      ...createdEmergencyEntry,
      priority: { uuid: 'priority-i-uuid' },
      status: { uuid: 'in-service-uuid' },
      sortWeight: 0,
    };
    mockOpenmrsFetch
      .mockResolvedValueOnce(response({ results: [] }))
      .mockResolvedValueOnce(response({ uuid: directEntry.uuid }, 201))
      .mockResolvedValueOnce(response({ results: [directEntry] }));

    await expect(createEmergencyQueueEntry(
      'patient-uuid',
      'visit-uuid',
      'priority-i-uuid',
      'in-service-uuid',
      'queue-uuid',
      0,
    )).resolves.toMatchObject({ data: { uuid: directEntry.uuid } });

    expect(mockOpenmrsFetch).toHaveBeenNthCalledWith(2, `${restBaseUrl}/visit-queue-entry`, {
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
    expect(mockAssertFreshPatientIsAlive).toHaveBeenCalledWith('patient-uuid');
    expect(mockAssertFreshPatientIsAlive.mock.invocationCallOrder[0]).toBeLessThan(
      mockOpenmrsFetch.mock.invocationCallOrder[1],
    );
  });

  it('defaults sortWeight only when none is provided', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce(response({ results: [] }))
      .mockResolvedValueOnce(response({ uuid: createdEmergencyEntry.uuid }, 201))
      .mockResolvedValueOnce(response({ results: [createdEmergencyEntry] }));

    await createEmergencyQueueEntry('patient-uuid', 'visit-uuid', 'priority-uuid', 'waiting-status-uuid', 'queue-uuid');

    expect(mockOpenmrsFetch).toHaveBeenNthCalledWith(
      2,
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

  it.each([
    ['deceased', DECEASED_PATIENT_OPERATION_BLOCKED],
    ['unavailable', PATIENT_VITAL_STATUS_UNAVAILABLE],
  ])('fails closed when patient vital status is %s', async (_state, code) => {
    mockOpenmrsFetch.mockResolvedValueOnce(response({ results: [] }));
    mockAssertFreshPatientIsAlive.mockRejectedValueOnce(Object.assign(new Error(String(_state)), { code }));

    await expect(
      createEmergencyQueueEntry(
        'patient-uuid',
        'visit-uuid',
        'priority-uuid',
        'waiting-status-uuid',
        'queue-uuid',
      ),
    ).rejects.toMatchObject({ code });

    expect(mockOpenmrsFetch).toHaveBeenCalledOnce();
    expect(mockOpenmrsFetch.mock.calls.some(([url]) => url === `${restBaseUrl}/visit-queue-entry`)).toBe(false);
  });

  it('reuses one exact active entry for the visit after a fresh patient check', async () => {
    const existingResponse = response({ results: [createdEmergencyEntry] });
    mockOpenmrsFetch.mockResolvedValueOnce(existingResponse);

    await expect(
      createEmergencyQueueEntry('patient-uuid', 'visit-uuid', 'priority-uuid', 'waiting-status-uuid', 'queue-uuid'),
    ).resolves.toMatchObject({ data: { uuid: createdEmergencyEntry.uuid } });

    expect(mockAssertFreshPatientIsAlive).toHaveBeenCalledWith('patient-uuid');
    expect(mockOpenmrsFetch).toHaveBeenCalledOnce();
  });

  it('rejects multiple active entries for the same visit as ambiguous', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce(
      response({ results: [createdEmergencyEntry, { ...createdEmergencyEntry, uuid: 'duplicate-entry' }] }),
    );

    await expect(
      createEmergencyQueueEntry('patient-uuid', 'visit-uuid', 'priority-uuid', 'waiting-status-uuid', 'queue-uuid'),
    ).rejects.toMatchObject({ code: EMERGENCY_QUEUE_ENTRY_CREATION_AMBIGUOUS });

    expect(mockAssertFreshPatientIsAlive).not.toHaveBeenCalled();
  });

  it('rejects a conflicting active entry instead of creating another one', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce(
      response({ results: [{ ...createdEmergencyEntry, queue: { uuid: 'other-queue' } }] }),
    );

    await expect(
      createEmergencyQueueEntry('patient-uuid', 'visit-uuid', 'priority-uuid', 'waiting-status-uuid', 'queue-uuid'),
    ).rejects.toMatchObject({ code: EMERGENCY_QUEUE_ENTRY_CREATION_CONFLICT });

    expect(mockAssertFreshPatientIsAlive).not.toHaveBeenCalled();
  });

  it('accepts a 2xx response without a UUID when the authoritative entry persisted', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce(response({ results: [] }))
      .mockResolvedValueOnce(response({}, 201))
      .mockResolvedValueOnce(response({ results: [createdEmergencyEntry] }));

    await expect(
      createEmergencyQueueEntry('patient-uuid', 'visit-uuid', 'priority-uuid', 'waiting-status-uuid', 'queue-uuid'),
    ).resolves.toMatchObject({ data: { uuid: createdEmergencyEntry.uuid } });
  });

  it('rejects a 2xx response without a UUID when no authoritative entry persisted', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce(response({ results: [] }))
      .mockResolvedValueOnce(response({}, 201))
      .mockResolvedValueOnce(response({ results: [] }));

    await expect(
      createEmergencyQueueEntry('patient-uuid', 'visit-uuid', 'priority-uuid', 'waiting-status-uuid', 'queue-uuid'),
    ).rejects.toMatchObject({ code: EMERGENCY_QUEUE_ENTRY_CREATION_UNVERIFIED });
  });

  it('rejects a 2xx response whose UUID contradicts the authoritative entry', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce(response({ results: [] }))
      .mockResolvedValueOnce(response({ uuid: 'different-response-uuid' }, 201))
      .mockResolvedValueOnce(response({ results: [createdEmergencyEntry] }));

    await expect(
      createEmergencyQueueEntry('patient-uuid', 'visit-uuid', 'priority-uuid', 'waiting-status-uuid', 'queue-uuid'),
    ).rejects.toMatchObject({ code: EMERGENCY_QUEUE_ENTRY_CREATION_UNVERIFIED });
  });

  it('rejects an authoritative active entry without a UUID', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce(
      response({ results: [{ ...createdEmergencyEntry, uuid: undefined }] }),
    );

    await expect(
      createEmergencyQueueEntry('patient-uuid', 'visit-uuid', 'priority-uuid', 'waiting-status-uuid', 'queue-uuid'),
    ).rejects.toMatchObject({ code: EMERGENCY_QUEUE_ENTRY_UUID_UNAVAILABLE });
  });

  it('fails closed when a capped active-entry page repeats without progress', async () => {
    const repeatedPage = Array.from({ length: 100 }, () => createdEmergencyEntry);
    mockOpenmrsFetch
      .mockResolvedValueOnce(response({ results: repeatedPage }))
      .mockResolvedValueOnce(response({ results: repeatedPage }));

    await expect(
      createEmergencyQueueEntry('patient-uuid', 'visit-uuid', 'priority-uuid', 'waiting-status-uuid', 'queue-uuid'),
    ).rejects.toMatchObject({ code: EMERGENCY_QUEUE_ENTRY_SEARCH_STALLED });
    expect(mockOpenmrsFetch.mock.calls[0][0]).toContain('startIndex=0');
    expect(mockOpenmrsFetch.mock.calls[1][0]).toContain('startIndex=100');
  });

  it('reconciles a lost or duplicate response when exactly one requested entry persisted', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce(response({ results: [] }))
      .mockRejectedValueOnce(Object.assign(new Error('duplicate response lost'), { status: 409 }))
      .mockResolvedValueOnce(response({ results: [createdEmergencyEntry] }));

    await expect(
      createEmergencyQueueEntry('patient-uuid', 'visit-uuid', 'priority-uuid', 'waiting-status-uuid', 'queue-uuid'),
    ).resolves.toMatchObject({ data: { uuid: createdEmergencyEntry.uuid } });
    expect(mockAssertFreshPatientIsAlive).toHaveBeenCalledTimes(2);
  });

  it('preserves the write error when lost-response reconciliation finds no entry', async () => {
    const writeError = new TypeError('response lost');
    mockOpenmrsFetch
      .mockResolvedValueOnce(response({ results: [] }))
      .mockRejectedValueOnce(writeError)
      .mockResolvedValueOnce(response({ results: [] }));

    await expect(
      createEmergencyQueueEntry('patient-uuid', 'visit-uuid', 'priority-uuid', 'waiting-status-uuid', 'queue-uuid'),
    ).rejects.toBe(writeError);
  });

  it('coalesces identical concurrent attempts for the same visit into one POST', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce(response({ results: [] }))
      .mockResolvedValueOnce(response({ uuid: createdEmergencyEntry.uuid }, 201))
      .mockResolvedValueOnce(response({ results: [createdEmergencyEntry] }));

    const calls = [
      createEmergencyQueueEntry('patient-uuid', 'visit-uuid', 'priority-uuid', 'waiting-status-uuid', 'queue-uuid'),
      createEmergencyQueueEntry('patient-uuid', 'visit-uuid', 'priority-uuid', 'waiting-status-uuid', 'queue-uuid'),
    ];

    await expect(Promise.all(calls)).resolves.toHaveLength(2);
    expect(mockOpenmrsFetch.mock.calls.filter(([url]) => url === `${restBaseUrl}/visit-queue-entry`)).toHaveLength(1);
  });
});

const activeQueueEntry = {
  uuid: 'source-entry',
  startedAt: '2026-08-12T14:00:00.000Z',
  endedAt: null,
  patient: { uuid: 'fresh-patient-uuid' },
  visit: { uuid: 'visit-uuid' },
  queue: { uuid: 'triage-queue' },
  status: { uuid: 'waiting-status' },
  priority: { uuid: 'urgency-priority' },
  priorityComment: null,
};

const updatedQueueEntry = {
  ...activeQueueEntry,
  status: { uuid: 'in-service-status' },
  priority: { uuid: 'priority-i' },
  priorityComment: 'Immediate attention',
};

const endedQueueEntry = {
  ...activeQueueEntry,
  endedAt: '2026-08-12T14:15:00.000Z',
};

const expectedSuccessor = {
  ...endedQueueEntry,
  uuid: 'successor-entry',
  startedAt: endedQueueEntry.endedAt,
  endedAt: null,
  queueComingFrom: { uuid: activeQueueEntry.queue.uuid },
  queue: { uuid: 'attention-queue' },
  status: { uuid: 'waiting-status' },
  priority: { uuid: 'priority-i' },
};

const transitionParams = {
  queueEntryToTransition: activeQueueEntry.uuid,
  newQueue: expectedSuccessor.queue.uuid,
  newStatus: expectedSuccessor.status.uuid,
  newPriority: expectedSuccessor.priority.uuid,
};

describe('updateEmergencyQueueEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLivingPatient();
  });

  it('fresh-reads the queue patient, asserts life, writes, and verifies the update', async () => {
    const writeResponse = response({ uuid: activeQueueEntry.uuid });
    mockOpenmrsFetch
      .mockResolvedValueOnce(response(activeQueueEntry))
      .mockResolvedValueOnce(writeResponse)
      .mockResolvedValueOnce(response(updatedQueueEntry));

    await expect(
      updateEmergencyQueueEntry(activeQueueEntry.uuid, {
        statusUuid: updatedQueueEntry.status.uuid,
        priorityUuid: updatedQueueEntry.priority.uuid,
        priorityComment: updatedQueueEntry.priorityComment,
      }),
    ).resolves.toBe(writeResponse);

    expect(mockAssertFreshPatientIsAlive).toHaveBeenCalledWith('fresh-patient-uuid');
    expect(mockOpenmrsFetch).toHaveBeenNthCalledWith(2, `${restBaseUrl}/queue-entry/${activeQueueEntry.uuid}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        status: { uuid: 'in-service-status' },
        priority: { uuid: 'priority-i' },
        priorityComment: 'Immediate attention',
      },
    });
    expect(mockAssertFreshPatientIsAlive.mock.invocationCallOrder[0]).toBeLessThan(
      mockOpenmrsFetch.mock.invocationCallOrder[1],
    );
  });

  it.each([
    ['deceased', DECEASED_PATIENT_OPERATION_BLOCKED],
    ['unavailable', PATIENT_VITAL_STATUS_UNAVAILABLE],
  ])('does not update when fresh patient status is %s', async (_state, code) => {
    mockOpenmrsFetch.mockResolvedValueOnce(response(activeQueueEntry));
    mockAssertFreshPatientIsAlive.mockRejectedValueOnce(Object.assign(new Error(String(_state)), { code }));

    await expect(
      updateEmergencyQueueEntry(activeQueueEntry.uuid, { statusUuid: 'in-service-status' }),
    ).rejects.toMatchObject({ code });

    expect(mockOpenmrsFetch).toHaveBeenCalledOnce();
  });

  it('fails closed when the fresh queue entry does not identify its patient', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce(response({ ...activeQueueEntry, patient: undefined }));

    await expect(
      updateEmergencyQueueEntry(activeQueueEntry.uuid, { statusUuid: 'in-service-status' }),
    ).rejects.toMatchObject({ code: EMERGENCY_QUEUE_ENTRY_PATIENT_UNAVAILABLE });

    expect(mockAssertFreshPatientIsAlive).not.toHaveBeenCalled();
    expect(mockOpenmrsFetch).toHaveBeenCalledOnce();
  });

  it('accepts a lost response only after the exact update is visible', async () => {
    const writeError = new TypeError('response lost');
    mockOpenmrsFetch
      .mockResolvedValueOnce(response(activeQueueEntry))
      .mockRejectedValueOnce(writeError)
      .mockResolvedValueOnce(response(updatedQueueEntry));

    await expect(
      updateEmergencyQueueEntry(activeQueueEntry.uuid, {
        statusUuid: updatedQueueEntry.status.uuid,
        priorityUuid: updatedQueueEntry.priority.uuid,
        priorityComment: updatedQueueEntry.priorityComment,
      }),
    ).resolves.toBeNull();

    expect(mockAssertFreshPatientIsAlive).toHaveBeenCalledTimes(2);
  });

  it('preserves a lost-response error when the update did not persist', async () => {
    const writeError = new TypeError('response lost');
    mockOpenmrsFetch
      .mockResolvedValueOnce(response(activeQueueEntry))
      .mockRejectedValueOnce(writeError)
      .mockResolvedValueOnce(response(activeQueueEntry));

    await expect(
      updateEmergencyQueueEntry(activeQueueEntry.uuid, { statusUuid: updatedQueueEntry.status.uuid }),
    ).rejects.toBe(writeError);
  });

  it('rejects a successful response when the update is not persisted', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce(response(activeQueueEntry))
      .mockResolvedValueOnce(response({ uuid: activeQueueEntry.uuid }))
      .mockResolvedValueOnce(response(activeQueueEntry));

    await expect(
      updateEmergencyQueueEntry(activeQueueEntry.uuid, { statusUuid: updatedQueueEntry.status.uuid }),
    ).rejects.toMatchObject({ code: EMERGENCY_QUEUE_ENTRY_UPDATE_UNVERIFIED });
  });
});

describe('endEmergencyQueueEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fresh-reads, closes directly with a date not before startedAt, and returns the verified response', async () => {
    const freshActiveResponse = {
      ...response(activeQueueEntry),
      headers: new Headers({ Date: 'Wed, 12 Aug 2026 13:30:00 GMT' }),
    } as FetchResponse<typeof activeQueueEntry>;
    const verifiedResponse = response(endedQueueEntry);
    mockOpenmrsFetch
      .mockResolvedValueOnce(freshActiveResponse)
      .mockResolvedValueOnce(response({ uuid: activeQueueEntry.uuid }))
      .mockResolvedValueOnce(verifiedResponse)
      .mockResolvedValueOnce(response({ results: [] }));

    await expect(endEmergencyQueueEntry(activeQueueEntry.uuid)).resolves.toBe(verifiedResponse);

    expect(mockOpenmrsFetch).toHaveBeenNthCalledWith(2, `${restBaseUrl}/queue-entry/${activeQueueEntry.uuid}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { endedAt: expect.any(String) },
    });
    const postedEnd = (mockOpenmrsFetch.mock.calls[1][1]?.body as { endedAt: string }).endedAt;
    expect(new Date(postedEnd).toISOString()).toBe(activeQueueEntry.startedAt);
  });

  it('preserves an already-ended entry when it has no transition successor', async () => {
    const freshEndedResponse = response(endedQueueEntry);
    mockOpenmrsFetch
      .mockResolvedValueOnce(freshEndedResponse)
      .mockResolvedValueOnce(response({ results: [] }));

    await expect(endEmergencyQueueEntry(activeQueueEntry.uuid)).resolves.toBe(freshEndedResponse);

    expect(mockOpenmrsFetch.mock.calls.some(([url, init]) => url === `${restBaseUrl}/queue-entry/${activeQueueEntry.uuid}` && init?.method === 'POST')).toBe(false);
  });

  it('does not misreport a concurrent transition as a direct close', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce(response(endedQueueEntry))
      .mockResolvedValueOnce(response({ results: [expectedSuccessor] }));

    await expect(endEmergencyQueueEntry(activeQueueEntry.uuid)).rejects.toMatchObject({
      code: EMERGENCY_QUEUE_ENTRY_TRANSITION_CONFLICT,
    });
  });

  it('does not mistake an earlier historical transition for a successor of this close', async () => {
    const historicalTransition = {
      ...expectedSuccessor,
      uuid: 'historical-successor',
      startedAt: '2026-08-12T14:05:00.000Z',
    };
    const freshEndedResponse = response(endedQueueEntry);
    mockOpenmrsFetch
      .mockResolvedValueOnce(freshEndedResponse)
      .mockResolvedValueOnce(response({ results: [historicalTransition] }));

    await expect(endEmergencyQueueEntry(activeQueueEntry.uuid)).resolves.toBe(freshEndedResponse);
  });

  it('rejects a concurrent transition even when the direct close overwrites the source end time', async () => {
    const transitionBeforeCloseOverwrite = {
      ...expectedSuccessor,
      startedAt: '2026-08-12T14:10:00.000Z',
    };
    const overwrittenSource = {
      ...endedQueueEntry,
      endedAt: '2026-08-12T14:15:00.000Z',
    };
    mockOpenmrsFetch
      .mockResolvedValueOnce(response(activeQueueEntry))
      .mockResolvedValueOnce(response({ uuid: activeQueueEntry.uuid }))
      .mockResolvedValueOnce(response(overwrittenSource))
      .mockResolvedValueOnce(response({ results: [transitionBeforeCloseOverwrite] }));

    await expect(endEmergencyQueueEntry(activeQueueEntry.uuid)).rejects.toMatchObject({
      code: EMERGENCY_QUEUE_ENTRY_TRANSITION_CONFLICT,
    });
  });

  it('rejects a 2xx close response when the entry remains active', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce(response(activeQueueEntry))
      .mockResolvedValueOnce(response({ uuid: activeQueueEntry.uuid }))
      .mockResolvedValueOnce(response(activeQueueEntry));

    await expect(endEmergencyQueueEntry(activeQueueEntry.uuid)).rejects.toMatchObject({
      code: EMERGENCY_QUEUE_ENTRY_CLOSE_UNVERIFIED,
    });
  });

  it('reconciles a lost response when a fresh read proves a direct close', async () => {
    const writeError = new TypeError('response lost');
    const verifiedResponse = response(endedQueueEntry);
    mockOpenmrsFetch
      .mockResolvedValueOnce(response(activeQueueEntry))
      .mockRejectedValueOnce(writeError)
      .mockResolvedValueOnce(verifiedResponse)
      .mockResolvedValueOnce(response({ results: [] }));

    await expect(endEmergencyQueueEntry(activeQueueEntry.uuid)).resolves.toBe(verifiedResponse);
  });

  it('preserves the lost-response error when the close did not persist', async () => {
    const writeError = new TypeError('response lost');
    mockOpenmrsFetch
      .mockResolvedValueOnce(response(activeQueueEntry))
      .mockRejectedValueOnce(writeError)
      .mockResolvedValueOnce(response(activeQueueEntry));

    await expect(endEmergencyQueueEntry(activeQueueEntry.uuid)).rejects.toBe(writeError);
  });

  it('reports transition conflict when a lost close response reveals a successor', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce(response(activeQueueEntry))
      .mockRejectedValueOnce(new TypeError('response lost'))
      .mockResolvedValueOnce(response(endedQueueEntry))
      .mockResolvedValueOnce(response({ results: [expectedSuccessor] }));

    await expect(endEmergencyQueueEntry(activeQueueEntry.uuid)).rejects.toMatchObject({
      code: EMERGENCY_QUEUE_ENTRY_TRANSITION_CONFLICT,
    });
  });
});

describe('transitionEmergencyQueueEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLivingPatient();
  });

  it('fresh-checks the source patient and verifies the exact successor after transition', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce(response(activeQueueEntry))
      .mockResolvedValueOnce(response({ uuid: expectedSuccessor.uuid }))
      .mockResolvedValueOnce(response(endedQueueEntry))
      .mockResolvedValueOnce(response({ results: [expectedSuccessor] }));

    await expect(transitionEmergencyQueueEntry(transitionParams)).resolves.toMatchObject({
      data: { uuid: expectedSuccessor.uuid },
    });

    expect(mockAssertFreshPatientIsAlive).toHaveBeenCalledWith('fresh-patient-uuid');
    expect(mockOpenmrsFetch).toHaveBeenNthCalledWith(2, `${restBaseUrl}/queue-entry/transition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: transitionParams,
    });
    expect(mockAssertFreshPatientIsAlive.mock.invocationCallOrder[0]).toBeLessThan(
      mockOpenmrsFetch.mock.invocationCallOrder[1],
    );
  });

  it.each([
    ['deceased', DECEASED_PATIENT_OPERATION_BLOCKED],
    ['unavailable', PATIENT_VITAL_STATUS_UNAVAILABLE],
  ])('does not transition when fresh patient status is %s', async (_state, code) => {
    mockOpenmrsFetch.mockResolvedValueOnce(response(activeQueueEntry));
    mockAssertFreshPatientIsAlive.mockRejectedValueOnce(Object.assign(new Error(String(_state)), { code }));

    await expect(transitionEmergencyQueueEntry(transitionParams)).rejects.toMatchObject({ code });

    expect(mockOpenmrsFetch).toHaveBeenCalledOnce();
  });

  it('reconciles a lost response only when the exact requested successor exists', async () => {
    const writeError = new TypeError('response lost');
    mockOpenmrsFetch
      .mockResolvedValueOnce(response(activeQueueEntry))
      .mockRejectedValueOnce(writeError)
      .mockResolvedValueOnce(response(endedQueueEntry))
      .mockResolvedValueOnce(response({ results: [expectedSuccessor] }));

    await expect(transitionEmergencyQueueEntry(transitionParams)).resolves.toMatchObject({
      data: { uuid: expectedSuccessor.uuid },
    });
    expect(mockAssertFreshPatientIsAlive).toHaveBeenCalledTimes(2);
  });

  it('does not mistake an ended source and a different successor for a successful transition', async () => {
    const writeError = new TypeError('response lost');
    const differentSuccessor = { ...expectedSuccessor, status: { uuid: 'different-status' } };
    mockOpenmrsFetch
      .mockResolvedValueOnce(response(activeQueueEntry))
      .mockRejectedValueOnce(writeError)
      .mockResolvedValueOnce(response(endedQueueEntry))
      .mockResolvedValueOnce(response({ results: [differentSuccessor] }));

    await expect(transitionEmergencyQueueEntry(transitionParams)).rejects.toBe(writeError);
  });

  it('reconciles an idempotent retry only when the exact successor already exists', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce(response(endedQueueEntry))
      .mockResolvedValueOnce(response({ results: [expectedSuccessor] }));

    await expect(transitionEmergencyQueueEntry(transitionParams)).resolves.toMatchObject({
      data: { uuid: expectedSuccessor.uuid },
    });
    expect(mockOpenmrsFetch.mock.calls.some(([url]) => url === `${restBaseUrl}/queue-entry/transition`)).toBe(false);
  });

  it('rejects an ended source whose successor does not match the requested transition', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce(response(endedQueueEntry))
      .mockResolvedValueOnce(response({ results: [{ ...expectedSuccessor, queue: { uuid: 'other-queue' } }] }));

    await expect(transitionEmergencyQueueEntry(transitionParams)).rejects.toMatchObject({
      code: EMERGENCY_QUEUE_ENTRY_ALREADY_ENDED,
    });
  });

  it('rejects a successful response when no exact successor persisted', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce(response(activeQueueEntry))
      .mockResolvedValueOnce(response({ uuid: expectedSuccessor.uuid }))
      .mockResolvedValueOnce(response(endedQueueEntry))
      .mockResolvedValueOnce(response({ results: [] }));

    await expect(transitionEmergencyQueueEntry(transitionParams)).rejects.toMatchObject({
      code: EMERGENCY_QUEUE_ENTRY_TRANSITION_UNVERIFIED,
    });
  });

  it('does not report a reconciled transition as usable if the patient dies in flight', async () => {
    const writeError = new TypeError('response lost');
    mockOpenmrsFetch
      .mockResolvedValueOnce(response(activeQueueEntry))
      .mockRejectedValueOnce(writeError)
      .mockResolvedValueOnce(response(endedQueueEntry))
      .mockResolvedValueOnce(response({ results: [expectedSuccessor] }));
    mockAssertFreshPatientIsAlive
      .mockResolvedValueOnce({ dead: false, deathDate: null, isDeceased: false })
      .mockRejectedValueOnce(
        Object.assign(new Error('deceased in flight'), { code: DECEASED_PATIENT_OPERATION_BLOCKED }),
      );

    await expect(transitionEmergencyQueueEntry(transitionParams)).rejects.toMatchObject({
      code: DECEASED_PATIENT_OPERATION_BLOCKED,
    });
  });

  it('protects the post-triage transition using the patient from the fresh queue entry', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce(response(activeQueueEntry))
      .mockResolvedValueOnce(response({ uuid: expectedSuccessor.uuid }))
      .mockResolvedValueOnce(response(endedQueueEntry))
      .mockResolvedValueOnce(response({ results: [expectedSuccessor] }));

    await transitionToAttentionQueue(
      activeQueueEntry.uuid,
      'stale-caller-patient-uuid',
      activeQueueEntry.visit.uuid,
      expectedSuccessor.priority.uuid,
      expectedSuccessor.queue.uuid,
      expectedSuccessor.status.uuid,
      1,
    );

    expect(mockAssertFreshPatientIsAlive).toHaveBeenCalledWith('fresh-patient-uuid');
    expect(mockAssertFreshPatientIsAlive).not.toHaveBeenCalledWith('stale-caller-patient-uuid');
  });
});
