import { openmrsFetch } from '@openmrs/esm-framework';

import { ACTIVE_QUEUE_ENTRY_CONFLICT, ActiveQueueEntryConflictError, postQueueEntry } from './queue-fields.resource';

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

describe('postQueueEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reuses an active entry for the same visit and queue', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({
      data: { results: [{ uuid: 'existing-entry', visit: { uuid: input.visitUuid } }] },
    } as never);

    await expect(createQueueEntry()).resolves.toMatchObject({
      created: false,
      queueEntry: { uuid: 'existing-entry' },
    });

    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(1);
    expect(mockOpenmrsFetch.mock.calls[0][0]).toContain('/queue-entry?');
    expect(mockOpenmrsFetch.mock.calls[0][0]).toContain(`visit=${input.visitUuid}`);
    expect(mockOpenmrsFetch.mock.calls[0][0]).toContain(`queue=${input.queueUuid}`);
  });

  it('generates the ticket before creating a new queue entry', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce({ data: { results: [] } } as never)
      .mockResolvedValueOnce({ data: { results: [] } } as never)
      .mockResolvedValueOnce({ data: { value: 'A-01' } } as never)
      .mockResolvedValueOnce({ data: { uuid: 'new-entry' }, status: 201 } as never);

    await expect(createQueueEntry()).resolves.toMatchObject({ created: true });

    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(4);
    expect(mockOpenmrsFetch.mock.calls[2][0]).toContain('/queue-entry-number?');
    expect(mockOpenmrsFetch.mock.calls[3][0]).toContain('/visit-queue-entry');
    expect(mockOpenmrsFetch.mock.calls[3][1]).toMatchObject({ method: 'POST' });
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
      .mockResolvedValueOnce({ data: { value: 'A-01' } } as never)
      .mockRejectedValueOnce(new Error('duplicate'))
      .mockResolvedValueOnce({
        data: { results: [{ uuid: 'concurrent-entry', visit: { uuid: input.visitUuid } }] },
      } as never);

    await expect(createQueueEntry()).resolves.toMatchObject({
      created: false,
      queueEntry: { uuid: 'concurrent-entry' },
    });
  });

  it('fails before mutating data when the queue number attribute is not configured', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce({ data: { results: [] } } as never)
      .mockResolvedValueOnce({ data: { results: [] } } as never);

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

    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(2);
  });
});
