import { openmrsFetch } from '@openmrs/esm-framework';

import {
  ACTIVE_QUEUE_ENTRY_CONFLICT,
  ACTIVE_VISIT_QUEUE_CONFLICT,
  ActiveQueueEntryConflictError,
  ActiveVisitQueueConflictError,
  MULTIPLE_ACTIVE_VISIT_QUEUE_ENTRIES,
  MultipleActiveVisitQueueEntriesError,
  generateVisitQueueNumber,
  postQueueEntry,
  postQueueEntryWithoutVisit,
  QUEUE_ENTRY_CREATION_UNVERIFIED,
  QUEUE_ENTRY_SEARCH_INVALID_RESPONSE,
  QueueEntryCreationVerificationError,
  QueueEntrySearchInvalidResponseError,
  QueueTicketGenerationError,
} from './queue-fields.resource';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

const input = {
  visitUuid: 'visit-uuid',
  queueUuid: 'queue-uuid',
  patientUuid: 'patient-uuid',
  priorityUuid: 'priority-uuid',
  statusUuid: 'status-uuid',
  sortWeight: 0,
  locationUuid: 'location-uuid',
  visitQueueNumberAttributeUuid: 'queue-number-attribute-uuid',
} as const;

const createQueueEntry = () =>
  postQueueEntry(
    input.visitUuid,
    input.queueUuid,
    input.patientUuid,
    input.priorityUuid,
    input.statusUuid,
    input.sortWeight,
    input.locationUuid,
    input.visitQueueNumberAttributeUuid,
  );

const visitWithoutQueueTicket = {
  data: { uuid: input.visitUuid, startDatetime: '2026-07-14T14:00:00.000Z', attributes: [] },
  headers: new Headers({ Date: 'Tue, 14 Jul 2026 15:30:00 GMT' }),
} as never;

const createdActiveEntry = {
  uuid: 'new-entry',
  queue: { uuid: input.queueUuid },
  visit: { uuid: input.visitUuid },
};

describe('postQueueEntryWithoutVisit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates and verifies a queue entry without a visit', async () => {
    const startedAt = new Date('2026-07-16T14:25:30.125Z');
    const persistedEntry = {
      uuid: 'new-entry',
      queue: { uuid: input.queueUuid },
    };
    mockOpenmrsFetch
      .mockResolvedValueOnce({ data: { results: [] } } as never)
      .mockResolvedValueOnce({ data: { uuid: persistedEntry.uuid }, status: 201 } as never)
      .mockResolvedValueOnce({ data: { results: [persistedEntry] } } as never);

    await expect(
      postQueueEntryWithoutVisit(
        input.queueUuid,
        input.patientUuid,
        input.priorityUuid,
        input.statusUuid,
        input.sortWeight,
        startedAt,
      ),
    ).resolves.toMatchObject({ created: true, queueEntry: persistedEntry });

    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(3);
    expect(mockOpenmrsFetch.mock.calls[0][0]).toContain('/queue-entry?');
    expect(mockOpenmrsFetch.mock.calls[0][0]).toContain(`patient=${input.patientUuid}`);
    expect(mockOpenmrsFetch.mock.calls[0][0]).toContain(`queue=${input.queueUuid}`);
    expect(mockOpenmrsFetch.mock.calls[1][0]).toMatch(/\/queue-entry$/);
    expect(mockOpenmrsFetch.mock.calls[1][1]).toMatchObject({
      method: 'POST',
      body: {
        queue: { uuid: input.queueUuid },
        patient: { uuid: input.patientUuid },
        status: { uuid: input.statusUuid },
        priority: { uuid: input.priorityUuid },
        startedAt,
        sortWeight: input.sortWeight,
      },
    });
    expect(mockOpenmrsFetch.mock.calls[1][1]?.body).not.toHaveProperty('visit');
    expect(mockOpenmrsFetch.mock.calls.some(([url]) => String(url).includes('/queue-entry-number'))).toBe(false);
    expect(mockOpenmrsFetch.mock.calls.some(([url]) => String(url).includes('/visit-queue-entry'))).toBe(false);
    expect(mockOpenmrsFetch.mock.calls[2][0]).toContain('/queue-entry?');
  });

  it('uses the current time when startedAt is omitted', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-16T16:45:30.250Z'));
    mockOpenmrsFetch
      .mockResolvedValueOnce({ data: { results: [] } } as never)
      .mockResolvedValueOnce({ data: { uuid: 'new-entry' }, status: 201 } as never)
      .mockResolvedValueOnce({
        data: { results: [{ uuid: 'new-entry', queue: { uuid: input.queueUuid } }] },
      } as never);

    await postQueueEntryWithoutVisit(
      input.queueUuid,
      input.patientUuid,
      input.priorityUuid,
      input.statusUuid,
      input.sortWeight,
    );

    expect(mockOpenmrsFetch.mock.calls[1][1]?.body).toMatchObject({
      startedAt: new Date('2026-07-16T16:45:30.250Z'),
    });
  });

  it('reuses an existing active entry for the patient and queue', async () => {
    const existingEntry = {
      uuid: 'existing-entry',
      queue: { uuid: input.queueUuid },
    };
    mockOpenmrsFetch.mockResolvedValueOnce({ data: { results: [existingEntry] } } as never);

    await expect(
      postQueueEntryWithoutVisit(
        input.queueUuid,
        input.patientUuid,
        input.priorityUuid,
        input.statusUuid,
        input.sortWeight,
      ),
    ).resolves.toMatchObject({ created: false, queueEntry: existingEntry });

    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(1);
  });

  it('reconciles a concurrent create instead of reporting a false failure', async () => {
    const concurrentEntry = {
      uuid: 'concurrent-entry',
      queue: { uuid: input.queueUuid },
    };
    mockOpenmrsFetch
      .mockResolvedValueOnce({ data: { results: [] } } as never)
      .mockRejectedValueOnce(new Error('duplicate'))
      .mockResolvedValueOnce({ data: { results: [concurrentEntry] } } as never);

    await expect(
      postQueueEntryWithoutVisit(
        input.queueUuid,
        input.patientUuid,
        input.priorityUuid,
        input.statusUuid,
        input.sortWeight,
      ),
    ).resolves.toMatchObject({ created: false, queueEntry: concurrentEntry });
  });

  it('preserves the write error when reconciliation cannot find an entry', async () => {
    const writeError = new Error('write failed');
    mockOpenmrsFetch
      .mockResolvedValueOnce({ data: { results: [] } } as never)
      .mockRejectedValueOnce(writeError)
      .mockResolvedValueOnce({ data: { results: [] } } as never);

    await expect(
      postQueueEntryWithoutVisit(
        input.queueUuid,
        input.patientUuid,
        input.priorityUuid,
        input.statusUuid,
        input.sortWeight,
      ),
    ).rejects.toBe(writeError);
  });

  it('fails closed when the created entry cannot be verified by reading it back', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce({ data: { results: [] } } as never)
      .mockResolvedValueOnce({ data: { uuid: 'new-entry' }, status: 201 } as never)
      .mockResolvedValueOnce({ data: { results: [] } } as never);

    await expect(
      postQueueEntryWithoutVisit(
        input.queueUuid,
        input.patientUuid,
        input.priorityUuid,
        input.statusUuid,
        input.sortWeight,
      ),
    ).rejects.toBeInstanceOf(QueueEntryCreationVerificationError);
  });

  it('does not accept a different entry as verification of the POST response', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce({ data: { results: [] } } as never)
      .mockResolvedValueOnce({ data: { uuid: 'new-entry' }, status: 201 } as never)
      .mockResolvedValueOnce({
        data: { results: [{ uuid: 'different-entry', queue: { uuid: input.queueUuid } }] },
      } as never);

    await expect(
      postQueueEntryWithoutVisit(
        input.queueUuid,
        input.patientUuid,
        input.priorityUuid,
        input.statusUuid,
        input.sortWeight,
      ),
    ).rejects.toBeInstanceOf(QueueEntryCreationVerificationError);
  });
});

describe('postQueueEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reuses an active entry for the same visit and queue', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({
      data: {
        results: [
          {
            uuid: 'existing-entry',
            queue: { uuid: input.queueUuid },
            visit: {
              uuid: input.visitUuid,
              attributes: [
                {
                  attributeType: { uuid: input.visitQueueNumberAttributeUuid },
                  value: 'A-01',
                },
              ],
            },
          },
        ],
      },
    } as never);

    await expect(createQueueEntry()).resolves.toMatchObject({
      created: false,
      queueEntry: { uuid: 'existing-entry' },
    });

    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(1);
    expect(mockOpenmrsFetch.mock.calls[0][0]).toContain('/queue-entry?');
    expect(mockOpenmrsFetch.mock.calls[0][0]).toContain(`visit=${input.visitUuid}`);
    expect(mockOpenmrsFetch.mock.calls[0][0]).not.toContain(`queue=${input.queueUuid}`);
  });

  it('generates the ticket before creating a new queue entry', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce({ data: { results: [] } } as never)
      .mockResolvedValueOnce({ data: { results: [] } } as never)
      .mockResolvedValueOnce(visitWithoutQueueTicket)
      .mockResolvedValueOnce({
        data: { visitQueueNumber: 'A-01' },
        headers: new Headers({ Date: 'Tue, 14 Jul 2026 15:30:00 GMT' }),
      } as never)
      .mockResolvedValueOnce({ data: { uuid: 'new-entry' }, status: 201 } as never)
      .mockResolvedValueOnce({ data: { results: [createdActiveEntry] } } as never);

    await expect(createQueueEntry()).resolves.toMatchObject({ created: true });

    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(6);
    expect(mockOpenmrsFetch.mock.calls[2][0]).toContain(`/visit/${input.visitUuid}?v=`);
    expect(mockOpenmrsFetch.mock.calls[3][0]).toContain('/queue-entry-number?');
    expect(mockOpenmrsFetch.mock.calls[3][1]).toMatchObject({ method: 'GET' });
    expect(mockOpenmrsFetch.mock.calls[4][0]).toContain('/visit-queue-entry');
    expect(mockOpenmrsFetch.mock.calls[4][1]).toMatchObject({ method: 'POST' });
    expect(mockOpenmrsFetch.mock.calls[4][1]?.body).toMatchObject({
      visit: { uuid: input.visitUuid },
      queueEntry: { startedAt: new Date('2026-07-14T15:30:00.000Z') },
    });
  });

  it('falls back from GET to POST when the queue module rejects the GET method', async () => {
    mockOpenmrsFetch
      .mockRejectedValueOnce({ response: { status: 405 } })
      .mockResolvedValueOnce({
        data: { visitQueueNumber: 'A-02' },
        headers: new Headers({ Date: 'Tue, 14 Jul 2026 15:30:00 GMT' }),
      } as never);

    await expect(
      generateVisitQueueNumber(
        input.locationUuid,
        input.visitUuid,
        input.queueUuid,
        input.visitQueueNumberAttributeUuid,
      ),
    ).resolves.toMatchObject({ queueNumber: 'A-02' });

    expect(mockOpenmrsFetch.mock.calls[0][1]).toMatchObject({ method: 'GET' });
    expect(mockOpenmrsFetch.mock.calls[1][1]).toMatchObject({ method: 'POST' });
  });

  it('does not create an entry before the visit millisecond-precision start time', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce({ data: { results: [] } } as never)
      .mockResolvedValueOnce({ data: { results: [] } } as never)
      .mockResolvedValueOnce(visitWithoutQueueTicket)
      .mockResolvedValueOnce({
        data: { visitQueueNumber: 'A-01' },
        headers: new Headers({ Date: 'Tue, 14 Jul 2026 15:30:00 GMT' }),
      } as never)
      .mockResolvedValueOnce({ data: { uuid: 'new-entry' }, status: 201 } as never)
      .mockResolvedValueOnce({ data: { results: [createdActiveEntry] } } as never);

    await postQueueEntry(
      input.visitUuid,
      input.queueUuid,
      input.patientUuid,
      input.priorityUuid,
      input.statusUuid,
      input.sortWeight,
      input.locationUuid,
      input.visitQueueNumberAttributeUuid,
      '2026-07-14T15:30:00.750Z',
    );

    expect(mockOpenmrsFetch.mock.calls[4][1]?.body).toMatchObject({
      queueEntry: { startedAt: new Date('2026-07-14T15:30:00.750Z') },
    });
  });

  it('uses the current time when the ticket response has no valid server date', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-14T16:45:30.250Z'));
    mockOpenmrsFetch
      .mockResolvedValueOnce({ data: { results: [] } } as never)
      .mockResolvedValueOnce({ data: { results: [] } } as never)
      .mockResolvedValueOnce({ data: { uuid: input.visitUuid, attributes: [] } } as never)
      .mockResolvedValueOnce({ data: { visitQueueNumber: 'A-01' } } as never)
      .mockResolvedValueOnce({ data: { uuid: 'new-entry' }, status: 201 } as never)
      .mockResolvedValueOnce({ data: { results: [createdActiveEntry] } } as never);

    await postQueueEntry(
      input.visitUuid,
      input.queueUuid,
      input.patientUuid,
      input.priorityUuid,
      input.statusUuid,
      input.sortWeight,
      input.locationUuid,
      input.visitQueueNumberAttributeUuid,
      '2026-07-14T14:00:00.000Z',
    );

    expect(mockOpenmrsFetch.mock.calls[4][1]?.body).toMatchObject({
      queueEntry: { startedAt: new Date('2026-07-14T16:45:30.250Z') },
    });
  });

  it('blocks an ambiguous visit with multiple active queue entries', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({
      data: {
        results: [
          { uuid: 'first-entry', queue: { uuid: input.queueUuid }, visit: { uuid: input.visitUuid } },
          { uuid: 'second-entry', queue: { uuid: input.queueUuid }, visit: { uuid: input.visitUuid } },
        ],
      },
    } as never);

    const error = await createQueueEntry().catch((reason) => reason);

    expect(error).toBeInstanceOf(MultipleActiveVisitQueueEntriesError);
    expect(error.code).toBe(MULTIPLE_ACTIVE_VISIT_QUEUE_ENTRIES);
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(1);
  });

  it.each([
    { data: {} },
    { data: null },
    {},
  ])('fails closed on a malformed active-entry search response', async (response) => {
    mockOpenmrsFetch.mockResolvedValueOnce(response as never);

    const error = await createQueueEntry().catch((reason) => reason);

    expect(error).toBeInstanceOf(QueueEntrySearchInvalidResponseError);
    expect(error.code).toBe(QUEUE_ENTRY_SEARCH_INVALID_RESPONSE);
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(1);
    expect(mockOpenmrsFetch.mock.calls.some(([url]) => String(url).includes('/visit-queue-entry'))).toBe(false);
  });

  it('blocks creating a second active queue entry for the same visit', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({
      data: {
        results: [
          {
            uuid: 'existing-entry',
            queue: { uuid: 'another-queue', display: 'Triaje' },
            visit: { uuid: input.visitUuid },
          },
        ],
      },
    } as never);

    const error = await createQueueEntry().catch((reason) => reason);

    expect(error).toBeInstanceOf(ActiveVisitQueueConflictError);
    expect(error.code).toBe(ACTIVE_VISIT_QUEUE_CONFLICT);
    expect(error.activeQueueDisplay).toBe('Triaje');
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(1);
    expect(mockOpenmrsFetch.mock.calls.some(([url]) => String(url).includes('/visit-queue-entry'))).toBe(false);
  });

  it('rejects an active entry in the same queue that belongs to another visit', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({ data: { results: [] } } as never).mockResolvedValueOnce({
      data: { results: [{ uuid: 'conflicting-entry', visit: { uuid: 'other-visit' } }] },
    } as never);

    const error = await createQueueEntry().catch((reason) => reason);

    expect(error).toBeInstanceOf(ActiveQueueEntryConflictError);
    expect(error.code).toBe(ACTIVE_QUEUE_ENTRY_CONFLICT);
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(2);
  });

  it('reconciles a concurrent create instead of reporting a false failure', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce({ data: { results: [] } } as never)
      .mockResolvedValueOnce({ data: { results: [] } } as never)
      .mockResolvedValueOnce(visitWithoutQueueTicket)
      .mockResolvedValueOnce({ data: { visitQueueNumber: 'A-01' } } as never)
      .mockRejectedValueOnce(new Error('duplicate'))
      .mockResolvedValueOnce({
        data: {
          results: [{ uuid: 'concurrent-entry', queue: { uuid: input.queueUuid }, visit: { uuid: input.visitUuid } }],
        },
      } as never);

    await expect(createQueueEntry()).resolves.toMatchObject({
      created: false,
      queueEntry: { uuid: 'concurrent-entry' },
    });
  });

  it('fails before mutating data when the queue number attribute is not configured', async () => {
    await expect(
      postQueueEntry(
        input.visitUuid,
        input.queueUuid,
        input.patientUuid,
        input.priorityUuid,
        input.statusUuid,
        input.sortWeight,
        input.locationUuid,
        null,
      ),
    ).rejects.toThrow('visitQueueNumberAttributeUuid');

    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
  });

  it('does not create an entry when ticket generation cannot be verified', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce({ data: { results: [] } } as never)
      .mockResolvedValueOnce({ data: { results: [] } } as never)
      .mockResolvedValueOnce(visitWithoutQueueTicket)
      .mockResolvedValueOnce({ data: { visitQueueNumber: '' } } as never)
      .mockResolvedValueOnce({
        data: { uuid: input.visitUuid, startDatetime: '2026-07-14T14:00:00.000Z', attributes: [] },
      } as never);

    await expect(createQueueEntry()).rejects.toBeInstanceOf(QueueTicketGenerationError);
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(5);
    expect(mockOpenmrsFetch.mock.calls[3][1]).toMatchObject({ method: 'GET' });
    expect(mockOpenmrsFetch.mock.calls[4][0]).toContain(`/visit/${input.visitUuid}?v=`);
    expect(mockOpenmrsFetch.mock.calls.some(([url]) => String(url).includes('/visit-queue-entry'))).toBe(false);
  });

  it('uses a ticket persisted by the queue module when generation returns an empty body', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce({ data: { results: [] } } as never)
      .mockResolvedValueOnce({ data: { results: [] } } as never)
      .mockResolvedValueOnce(visitWithoutQueueTicket)
      .mockResolvedValueOnce({ data: {} } as never)
      .mockResolvedValueOnce({
        data: {
          uuid: input.visitUuid,
          startDatetime: '2026-07-14T14:00:00.000Z',
          attributes: [
            {
              attributeType: { uuid: input.visitQueueNumberAttributeUuid },
              value: 'A-09',
            },
          ],
        },
      } as never)
      .mockResolvedValueOnce({ data: { uuid: 'new-entry' }, status: 201 } as never)
      .mockResolvedValueOnce({ data: { results: [createdActiveEntry] } } as never);

    await expect(createQueueEntry()).resolves.toMatchObject({ created: true });
    expect(mockOpenmrsFetch.mock.calls[4][0]).toContain(`/visit/${input.visitUuid}?v=`);
    expect(mockOpenmrsFetch.mock.calls[5][0]).toContain('/visit-queue-entry');
  });

  it('repairs a missing ticket on an existing active entry', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce({
        data: {
          results: [
            {
              uuid: 'existing-entry',
              queue: { uuid: input.queueUuid },
              visit: { uuid: input.visitUuid, attributes: [] },
            },
          ],
        },
      } as never)
      .mockResolvedValueOnce({ data: { visitQueueNumber: 'A-02' } } as never);

    await expect(createQueueEntry()).resolves.toMatchObject({ created: false });
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(2);
    expect(mockOpenmrsFetch.mock.calls[1][0]).toContain('/queue-entry-number?');
  });

  it('reuses a ticket persisted by an earlier partial attempt instead of generating another one', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce({ data: { results: [] } } as never)
      .mockResolvedValueOnce({ data: { results: [] } } as never)
      .mockResolvedValueOnce({
        data: {
          uuid: input.visitUuid,
          startDatetime: '2026-07-14T15:30:00.750Z',
          attributes: [
            {
              attributeType: { uuid: input.visitQueueNumberAttributeUuid },
              value: 'A-017',
            },
          ],
        },
        headers: new Headers({ Date: 'Tue, 14 Jul 2026 15:30:00 GMT' }),
      } as never)
      .mockResolvedValueOnce({ data: { uuid: 'new-entry' }, status: 201 } as never)
      .mockResolvedValueOnce({ data: { results: [createdActiveEntry] } } as never);

    await expect(createQueueEntry()).resolves.toMatchObject({ created: true });

    expect(mockOpenmrsFetch.mock.calls.some(([url]) => String(url).includes('/queue-entry-number?'))).toBe(false);
    expect(mockOpenmrsFetch.mock.calls[3][1]?.body).toMatchObject({
      queueEntry: { startedAt: new Date('2026-07-14T15:30:00.750Z') },
    });
  });

  it('fails closed when a concurrent create leaves two active entries for the visit', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce({ data: { results: [] } } as never)
      .mockResolvedValueOnce({ data: { results: [] } } as never)
      .mockResolvedValueOnce(visitWithoutQueueTicket)
      .mockResolvedValueOnce({ data: { visitQueueNumber: 'A-01' } } as never)
      .mockResolvedValueOnce({ data: { uuid: 'new-entry' }, status: 201 } as never)
      .mockResolvedValueOnce({
        data: {
          results: [
            createdActiveEntry,
            {
              uuid: 'concurrent-entry',
              queue: { uuid: 'other-queue' },
              visit: { uuid: input.visitUuid },
            },
          ],
        },
      } as never);

    await expect(createQueueEntry()).rejects.toBeInstanceOf(MultipleActiveVisitQueueEntriesError);
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(6);
  });

  it('fails closed when the created active entry cannot be verified', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce({ data: { results: [] } } as never)
      .mockResolvedValueOnce({ data: { results: [] } } as never)
      .mockResolvedValueOnce(visitWithoutQueueTicket)
      .mockResolvedValueOnce({ data: { visitQueueNumber: 'A-01' } } as never)
      .mockResolvedValueOnce({ data: { uuid: 'new-entry' }, status: 201 } as never)
      .mockResolvedValueOnce({ data: { results: [] } } as never);

    const error = await createQueueEntry().catch((reason) => reason);

    expect(error).toBeInstanceOf(QueueEntryCreationVerificationError);
    expect(error.code).toBe(QUEUE_ENTRY_CREATION_UNVERIFIED);
  });

  it('fails closed when only a different queue remains active after creation', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce({ data: { results: [] } } as never)
      .mockResolvedValueOnce({ data: { results: [] } } as never)
      .mockResolvedValueOnce(visitWithoutQueueTicket)
      .mockResolvedValueOnce({ data: { visitQueueNumber: 'A-01' } } as never)
      .mockResolvedValueOnce({ data: { uuid: 'new-entry' }, status: 201 } as never)
      .mockResolvedValueOnce({
        data: {
          results: [{ uuid: 'other-entry', queue: { uuid: 'other-queue' }, visit: { uuid: input.visitUuid } }],
        },
      } as never);

    await expect(createQueueEntry()).rejects.toBeInstanceOf(QueueEntryCreationVerificationError);
  });
});
