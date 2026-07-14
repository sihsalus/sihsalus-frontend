import { type FetchResponse, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';

import { type ActiveQueueEntrySummary, endActiveQueueEntries } from './batch-change-appointment-statuses.resources';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

function response(data: ActiveQueueEntrySummary, date?: string) {
  return {
    data,
    headers: new Headers(date ? { Date: date } : {}),
  } as FetchResponse<ActiveQueueEntrySummary>;
}

describe('endActiveQueueEntries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fresh-reads an active entry and ends it using the server time', async () => {
    const activeEntry = {
      uuid: 'queue-entry-uuid',
      startedAt: '2026-07-14T15:00:00.000Z',
      endedAt: null,
    };
    const endedEntry = { ...activeEntry, endedAt: '2026-07-14T15:30:00.000Z' };
    mockOpenmrsFetch
      .mockResolvedValueOnce(response(activeEntry, 'Tue, 14 Jul 2026 15:30:00 GMT'))
      .mockResolvedValueOnce(response(endedEntry));

    await expect(endActiveQueueEntries([activeEntry])).resolves.toEqual([endedEntry]);

    expect(mockOpenmrsFetch.mock.calls[0][0]).toContain(`${restBaseUrl}/queue-entry/${activeEntry.uuid}?`);
    expect(mockOpenmrsFetch).toHaveBeenNthCalledWith(2, `${restBaseUrl}/queue-entry/${activeEntry.uuid}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: undefined,
      body: { endedAt: '2026-07-14T15:30:00.000Z' },
    });
  });

  it('preserves an end time already written by another operator', async () => {
    const endedEntry = {
      uuid: 'queue-entry-uuid',
      startedAt: '2026-07-14T15:00:00.000Z',
      endedAt: '2026-07-14T15:12:34.000Z',
    };
    mockOpenmrsFetch.mockResolvedValueOnce(response(endedEntry));

    await expect(endActiveQueueEntries([endedEntry])).resolves.toEqual([endedEntry]);

    expect(mockOpenmrsFetch).toHaveBeenCalledOnce();
  });

  it('reconciles a successful close whose response was lost', async () => {
    const activeEntry = {
      uuid: 'queue-entry-uuid',
      startedAt: '2026-07-14T15:00:00.000Z',
      endedAt: null,
    };
    const endedEntry = { ...activeEntry, endedAt: '2026-07-14T15:30:00.000Z' };
    mockOpenmrsFetch
      .mockResolvedValueOnce(response(activeEntry, 'Tue, 14 Jul 2026 15:30:00 GMT'))
      .mockRejectedValueOnce(new Error('connection closed before response'))
      .mockResolvedValueOnce(response(endedEntry));

    await expect(endActiveQueueEntries([activeEntry])).resolves.toEqual([endedEntry]);

    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(3);
  });
});
