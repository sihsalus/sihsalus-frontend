import { type FetchResponse, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';

import { type QueueEntry } from '../types';
import {
  batchEndQueueEntries,
  endQueueEntry,
  isQueueEntryTransitionUnchanged,
  QUEUE_ENTRY_TRANSITION_CONFLICT,
  QueueEntryTransitionConflictError,
  transitionQueueEntry,
  updateActiveQueueEntry,
} from './queue-entry-actions.resource';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

const sourceEntry = {
  uuid: 'source-entry',
  endedAt: null,
  startedAt: '2026-07-14T13:00:00.000Z',
  visit: { uuid: 'visit-uuid' },
  queue: { uuid: 'source-queue' },
  status: { uuid: 'waiting-status' },
  priority: { uuid: 'normal-priority' },
  priorityComment: null,
} as unknown as QueueEntry;

const transitionedEntry = {
  ...sourceEntry,
  uuid: 'new-entry',
  startedAt: '2026-07-14T13:15:00.000Z',
  queueComingFrom: { uuid: 'source-queue' },
  queue: { uuid: 'target-queue' },
  status: { uuid: 'in-service-status' },
  priority: { uuid: 'urgent-priority' },
  priorityComment: 'Requires assistance',
} as unknown as QueueEntry;

const transitionParams = {
  queueEntryToTransition: sourceEntry.uuid,
  newQueue: transitionedEntry.queue.uuid,
  newStatus: transitionedEntry.status.uuid,
  newPriority: transitionedEntry.priority.uuid,
  newPriorityComment: transitionedEntry.priorityComment,
};

function response<T>(data: T, options: { date?: string; status?: number } = {}) {
  return {
    data,
    headers: new Headers(options.date ? { Date: options.date } : {}),
    status: options.status ?? 200,
  } as FetchResponse<T>;
}

describe('isQueueEntryTransitionUnchanged', () => {
  const currentSelection = {
    selectedQueue: sourceEntry.queue.uuid,
    selectedStatus: sourceEntry.status.uuid,
    selectedPriority: sourceEntry.priority.uuid,
    priorityComment: '',
  };

  it('enables a transition for a priority-only change', () => {
    expect(
      isQueueEntryTransitionUnchanged(sourceEntry, {
        ...currentSelection,
        selectedPriority: 'urgent-priority',
      }),
    ).toBe(false);
  });

  it('enables a transition for a comment-only change', () => {
    expect(
      isQueueEntryTransitionUnchanged(sourceEntry, {
        ...currentSelection,
        priorityComment: 'Requires assistance',
      }),
    ).toBe(false);
  });

  it('keeps submit disabled when no lifecycle field changed', () => {
    expect(isQueueEntryTransitionUnchanged(sourceEntry, currentSelection)).toBe(true);
  });
});

describe('transitionQueueEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fresh-reads the entry and lets Queue 3 assign the authoritative transition time', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce(response(sourceEntry)).mockResolvedValueOnce(response(transitionedEntry));

    await transitionQueueEntry(transitionParams);

    expect(mockOpenmrsFetch.mock.calls[0][0]).toContain(`${restBaseUrl}/queue-entry/${sourceEntry.uuid}?v=`);
    expect(mockOpenmrsFetch).toHaveBeenNthCalledWith(2, `${restBaseUrl}/queue-entry/transition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: undefined,
      body: transitionParams,
    });
    expect(mockOpenmrsFetch.mock.calls[1][1]?.body).not.toHaveProperty('transitionDate');
  });

  it('reconciles a retry when the requested successor already exists', async () => {
    const endedSource = { ...sourceEntry, endedAt: transitionedEntry.startedAt } as QueueEntry;
    mockOpenmrsFetch
      .mockResolvedValueOnce(response(endedSource))
      .mockResolvedValueOnce(response({ results: [transitionedEntry] }));

    const result = await transitionQueueEntry(transitionParams);

    expect(result.data.uuid).toBe(transitionedEntry.uuid);
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(2);
    expect(mockOpenmrsFetch.mock.calls.some(([url]) => url === `${restBaseUrl}/queue-entry/transition`)).toBe(false);
  });

  it('reconciles after a successful transition whose response was lost', async () => {
    const endedSource = { ...sourceEntry, endedAt: transitionedEntry.startedAt } as QueueEntry;
    mockOpenmrsFetch
      .mockResolvedValueOnce(response(sourceEntry))
      .mockRejectedValueOnce(new Error('Network connection closed'))
      .mockResolvedValueOnce(response(endedSource))
      .mockResolvedValueOnce(response({ results: [transitionedEntry] }));

    const result = await transitionQueueEntry(transitionParams);

    expect(result.data.uuid).toBe(transitionedEntry.uuid);
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(4);
  });
});

describe('endQueueEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fresh-reads at confirmation and uses the HTTP server date', async () => {
    const serverDate = 'Tue, 14 Jul 2026 13:20:00 GMT';
    const endedEntry = { ...sourceEntry, endedAt: '2026-07-14T13:20:00.000Z' } as QueueEntry;
    mockOpenmrsFetch
      .mockResolvedValueOnce(response(sourceEntry, { date: serverDate }))
      .mockResolvedValueOnce(response(endedEntry))
      .mockResolvedValueOnce(response(endedEntry))
      .mockResolvedValueOnce(response({ results: [] }));

    await endQueueEntry(sourceEntry.uuid);

    expect(mockOpenmrsFetch).toHaveBeenNthCalledWith(2, `${restBaseUrl}/queue-entry/${sourceEntry.uuid}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: undefined,
      body: { endedAt: '2026-07-14T13:20:00.000Z' },
    });
  });

  it('is idempotent and preserves an existing historical end time', async () => {
    const endedEntry = { ...sourceEntry, endedAt: '2026-07-14T13:07:31.000Z' } as QueueEntry;
    mockOpenmrsFetch.mockResolvedValueOnce(response(endedEntry)).mockResolvedValueOnce(response({ results: [] }));

    const result = await endQueueEntry(sourceEntry.uuid);

    expect(result.data.endedAt).toBe('2026-07-14T13:07:31.000Z');
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(2);
    expect(mockOpenmrsFetch.mock.calls[1][0]).toContain('queueComingFrom=source-queue');
  });

  it('reconciles a close whose successful response was lost', async () => {
    const endedEntry = { ...sourceEntry, endedAt: '2026-07-14T13:20:00.000Z' } as QueueEntry;
    mockOpenmrsFetch
      .mockResolvedValueOnce(response(sourceEntry, { date: 'Tue, 14 Jul 2026 13:20:00 GMT' }))
      .mockRejectedValueOnce(new Error('Network connection closed'))
      .mockResolvedValueOnce(response(endedEntry))
      .mockResolvedValueOnce(response({ results: [] }));

    const result = await endQueueEntry(sourceEntry.uuid);

    expect(result.data.endedAt).toBe(endedEntry.endedAt);
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(4);
  });

  it('rejects a successful close response when another user transitioned the entry first', async () => {
    const endedEntry = { ...sourceEntry, endedAt: '2026-07-14T13:20:00.000Z' } as QueueEntry;
    const concurrentSuccessor = {
      ...transitionedEntry,
      startedAt: '2026-07-14T13:15:00.000Z',
    } as QueueEntry;
    mockOpenmrsFetch
      .mockResolvedValueOnce(response(sourceEntry, { date: 'Tue, 14 Jul 2026 13:20:00 GMT' }))
      .mockResolvedValueOnce(response(endedEntry))
      .mockResolvedValueOnce(response(endedEntry))
      .mockResolvedValueOnce(response({ results: [concurrentSuccessor] }));

    const error = await endQueueEntry(sourceEntry.uuid).catch((reason) => reason);

    expect(error).toBeInstanceOf(QueueEntryTransitionConflictError);
    expect(error.code).toBe(QUEUE_ENTRY_TRANSITION_CONFLICT);
  });

  it('preserves a transition conflict when the close response is lost', async () => {
    const endedEntry = { ...sourceEntry, endedAt: transitionedEntry.startedAt } as QueueEntry;
    mockOpenmrsFetch
      .mockResolvedValueOnce(response(sourceEntry))
      .mockRejectedValueOnce(new Error('Network connection closed'))
      .mockResolvedValueOnce(response(endedEntry))
      .mockResolvedValueOnce(response({ results: [transitionedEntry] }));

    await expect(endQueueEntry(sourceEntry.uuid)).rejects.toBeInstanceOf(QueueEntryTransitionConflictError);
  });

  it('does not treat an already-ended transition source as an idempotent close', async () => {
    const endedEntry = { ...sourceEntry, endedAt: transitionedEntry.startedAt } as QueueEntry;
    mockOpenmrsFetch
      .mockResolvedValueOnce(response(endedEntry))
      .mockResolvedValueOnce(response({ results: [transitionedEntry] }));

    await expect(endQueueEntry(sourceEntry.uuid)).rejects.toBeInstanceOf(QueueEntryTransitionConflictError);
    expect(mockOpenmrsFetch.mock.calls.some(([url], index) => index > 0 && url === `${restBaseUrl}/queue-entry/${sourceEntry.uuid}`)).toBe(false);
  });
});

describe('updateActiveQueueEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fresh-reads before editing priority metadata in place', async () => {
    const updatedEntry = { ...sourceEntry, priorityComment: 'Requeued' } as QueueEntry;
    mockOpenmrsFetch
      .mockResolvedValueOnce(response(sourceEntry))
      .mockResolvedValueOnce(response(updatedEntry))
      .mockResolvedValueOnce(response(updatedEntry));

    await updateActiveQueueEntry(sourceEntry.uuid, { priorityComment: 'Requeued' });

    expect(mockOpenmrsFetch).toHaveBeenNthCalledWith(2, `${restBaseUrl}/queue-entry/${sourceEntry.uuid}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: undefined,
      body: { priorityComment: 'Requeued' },
    });
  });

  it('does not alter historical metadata after another user ended the entry', async () => {
    const endedEntry = { ...sourceEntry, endedAt: '2026-07-14T13:20:00.000Z' } as QueueEntry;
    mockOpenmrsFetch.mockResolvedValueOnce(response(endedEntry)).mockResolvedValueOnce(response({ results: [] }));

    await expect(updateActiveQueueEntry(sourceEntry.uuid, { priorityComment: 'Requeued' })).rejects.toThrow(
      /already ended/i,
    );
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(2);
  });

  it('rejects an edit when the entry transitions before post-write verification', async () => {
    const endedEntry = { ...sourceEntry, endedAt: transitionedEntry.startedAt } as QueueEntry;
    mockOpenmrsFetch
      .mockResolvedValueOnce(response(sourceEntry))
      .mockResolvedValueOnce(response({ ...sourceEntry, priorityComment: 'Requeued' }))
      .mockResolvedValueOnce(response(endedEntry))
      .mockResolvedValueOnce(response({ results: [transitionedEntry] }));

    await expect(updateActiveQueueEntry(sourceEntry.uuid, { priorityComment: 'Requeued' })).rejects.toBeInstanceOf(
      QueueEntryTransitionConflictError,
    );
  });

  it('preserves a transition conflict when the edit response is lost', async () => {
    const endedEntry = { ...sourceEntry, endedAt: transitionedEntry.startedAt } as QueueEntry;
    mockOpenmrsFetch
      .mockResolvedValueOnce(response(sourceEntry))
      .mockRejectedValueOnce(new Error('Network connection closed'))
      .mockResolvedValueOnce(response(endedEntry))
      .mockResolvedValueOnce(response({ results: [transitionedEntry] }));

    await expect(updateActiveQueueEntry(sourceEntry.uuid, { priorityComment: 'Requeued' })).rejects.toBeInstanceOf(
      QueueEntryTransitionConflictError,
    );
  });
});

describe('batchEndQueueEntries', () => {
  it('uses a fresh active set, continues after failures, and reports the partial result', async () => {
    const entryA = { ...sourceEntry, uuid: 'entry-a' } as QueueEntry;
    const entryB = { ...sourceEntry, uuid: 'entry-b', endedAt: '2026-07-14T13:10:00.000Z' } as QueueEntry;
    const entryC = { ...sourceEntry, uuid: 'entry-c' } as QueueEntry;

    mockOpenmrsFetch
      // Initial fresh active set.
      .mockResolvedValueOnce(response(entryA))
      .mockResolvedValueOnce(response(entryB))
      .mockResolvedValueOnce(response(entryC))
      // Confirm the already-ended entry was not transitioned.
      .mockResolvedValueOnce(response({ results: [] }))
      // Per-entry confirmation reads.
      .mockResolvedValueOnce(response(entryA, { date: 'Tue, 14 Jul 2026 13:20:00 GMT' }))
      .mockResolvedValueOnce(response(entryC, { date: 'Tue, 14 Jul 2026 13:20:00 GMT' }))
      // End writes.
      .mockResolvedValueOnce(response({ ...entryA, endedAt: '2026-07-14T13:20:00.000Z' }))
      .mockRejectedValueOnce(new Error('write failed'))
      // Post-write verification and failed-write reconciliation.
      .mockResolvedValueOnce(response({ ...entryA, endedAt: '2026-07-14T13:20:00.000Z' }))
      .mockResolvedValueOnce(response(entryC))
      .mockResolvedValueOnce(response({ results: [] }));

    const result = await batchEndQueueEntries([entryA, entryB, entryC]);

    expect(result).toEqual({ total: 3, cleared: 1, alreadyEnded: 1, failed: 1 });
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(11);
  });

  it('counts a transition between the batch preflight and per-entry confirmation as failed', async () => {
    const transitionedSource = { ...sourceEntry, endedAt: transitionedEntry.startedAt } as QueueEntry;
    mockOpenmrsFetch
      .mockResolvedValueOnce(response(sourceEntry))
      .mockResolvedValueOnce(response(transitionedSource))
      .mockResolvedValueOnce(response({ results: [transitionedEntry] }));

    await expect(batchEndQueueEntries([sourceEntry])).resolves.toEqual({
      total: 1,
      cleared: 0,
      alreadyEnded: 0,
      failed: 1,
    });
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(3);
  });
});
