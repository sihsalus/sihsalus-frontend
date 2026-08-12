import { type FetchResponse, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';

import {
  ACTIVE_QUEUE_ENTRY_SEARCH_STALLED,
  type ActiveQueueEntrySummary,
  drainActiveQueueEntriesForPatient,
  drainActiveQueueEntriesForVisit,
  endActiveQueueEntries,
  getActiveQueueEntriesForVisit,
} from './active-queue-entries.resource';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  openmrsFetch: vi.fn(),
}));

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

function response<T>(data: T, date?: string) {
  return {
    data,
    headers: new Headers(date ? { Date: date } : {}),
  } as FetchResponse<T>;
}

describe('active queue entry reconciliation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fresh-reads an active entry, ends it using server time, and verifies persistence', async () => {
    const activeEntry = {
      uuid: 'queue-entry-uuid',
      startedAt: '2026-07-14T15:00:00.000Z',
      endedAt: null,
    };
    const endedEntry = { ...activeEntry, endedAt: '2026-07-14T15:30:00.000Z' };
    mockOpenmrsFetch
      .mockResolvedValueOnce(response(activeEntry, 'Tue, 14 Jul 2026 15:30:00 GMT'))
      .mockResolvedValueOnce(response({}))
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

  it('clamps a residual queue end to its already closed visit', async () => {
    const activeEntry = {
      uuid: 'residual-entry',
      startedAt: '2026-07-14T15:00:00.000Z',
      endedAt: null,
      visit: { uuid: 'closed-visit', stopDatetime: '2026-07-14T15:30:00.000Z' },
    };
    const endedEntry = { ...activeEntry, endedAt: '2026-07-14T15:30:00.000Z' };
    mockOpenmrsFetch
      .mockResolvedValueOnce(response(activeEntry, 'Tue, 14 Jul 2026 16:00:00 GMT'))
      .mockResolvedValueOnce(response({}))
      .mockResolvedValueOnce(response(endedEntry));

    await expect(endActiveQueueEntries([activeEntry])).resolves.toEqual([endedEntry]);

    expect(String(mockOpenmrsFetch.mock.calls[0][0])).toContain('visit%3A%28uuid%2CstopDatetime%29');
    expect(mockOpenmrsFetch).toHaveBeenNthCalledWith(2, `${restBaseUrl}/queue-entry/residual-entry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: undefined,
      body: { endedAt: '2026-07-14T15:30:00.000Z' },
    });
  });

  it('fails closed when a residual visit stopped before its queue entry started', async () => {
    const activeEntry = {
      uuid: 'invalid-residual-entry',
      startedAt: '2026-07-14T15:30:00.000Z',
      endedAt: null,
      visit: { uuid: 'closed-visit', stopDatetime: '2026-07-14T15:00:00.000Z' },
    };
    mockOpenmrsFetch.mockResolvedValueOnce(response(activeEntry, 'Tue, 14 Jul 2026 16:00:00 GMT'));

    await expect(endActiveQueueEntries([activeEntry])).rejects.toMatchObject({
      code: 'ACTIVE_QUEUE_ENTRY_END_DATE_INVALID',
    });

    expect(mockOpenmrsFetch).toHaveBeenCalledOnce();
  });

  it('accepts a lost close response only after a fresh read confirms the entry ended', async () => {
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

  it('fails closed when a successful close response was not persisted', async () => {
    const activeEntry = {
      uuid: 'queue-entry-uuid',
      startedAt: '2026-07-14T15:00:00.000Z',
      endedAt: null,
    };
    mockOpenmrsFetch
      .mockResolvedValueOnce(response(activeEntry, 'Tue, 14 Jul 2026 15:30:00 GMT'))
      .mockResolvedValueOnce(response({}))
      .mockResolvedValueOnce(response(activeEntry));

    await expect(endActiveQueueEntries([activeEntry])).rejects.toMatchObject({
      code: 'ACTIVE_QUEUE_ENTRY_CLOSE_UNVERIFIED',
    });
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(3);
  });

  it('preserves a lost-response error when a fresh read still finds the entry active', async () => {
    const activeEntry = {
      uuid: 'queue-entry-uuid',
      startedAt: '2026-07-14T15:00:00.000Z',
      endedAt: null,
    };
    const writeError = new Error('connection closed before response');
    mockOpenmrsFetch
      .mockResolvedValueOnce(response(activeEntry, 'Tue, 14 Jul 2026 15:30:00 GMT'))
      .mockRejectedValueOnce(writeError)
      .mockResolvedValueOnce(response(activeEntry));

    await expect(endActiveQueueEntries([activeEntry])).rejects.toBe(writeError);
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(3);
  });

  it('paginates every active queue entry for an appointment visit', async () => {
    const entries = Array.from({ length: 205 }, (_, index) => ({ uuid: `entry-${index}`, endedAt: null }));
    mockOpenmrsFetch.mockImplementation(async (url) => {
      const parsedUrl = new URL(String(url), 'https://example.test');
      const startIndex = Number(parsedUrl.searchParams.get('startIndex'));
      return response({ results: entries.slice(startIndex, startIndex + 100) });
    });

    await expect(getActiveQueueEntriesForVisit('visit-uuid')).resolves.toMatchObject({
      data: { results: entries },
    });
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(3);
    expect(String(mockOpenmrsFetch.mock.calls[2][0])).toContain('startIndex=200');
  });

  it('drains more than one capped patient page, including visitless and residual entries', async () => {
    const entries = Array.from({ length: 105 }, (_, index) => ({
      uuid: index === 0 ? 'visitless-entry' : index === 1 ? 'closed-visit-residual-entry' : `entry-${index}`,
      startedAt: '2026-08-12T15:00:00.000Z',
      endedAt: null as string | null,
    }));

    mockOpenmrsFetch.mockImplementation(async (url, init) => {
      const requestUrl = String(url);
      if (requestUrl.includes('/queue-entry?')) {
        return response({ results: entries.filter(({ endedAt }) => !endedAt).slice(0, 100) });
      }

      const uuid = requestUrl.match(/\/queue-entry\/([^?]+)/)?.[1];
      const entry = entries.find((candidate) => candidate.uuid === uuid);
      if (!entry) {
        throw new Error(`Unexpected request: ${requestUrl}`);
      }
      if (init?.method === 'POST') {
        entry.endedAt = String((init.body as { endedAt: string }).endedAt);
        return response({});
      }
      return response(entry, 'Wed, 12 Aug 2026 15:30:00 GMT');
    });

    await expect(drainActiveQueueEntriesForPatient('patient-uuid')).resolves.toBe(105);
    const searches = mockOpenmrsFetch.mock.calls.filter(([url]) => String(url).includes('/queue-entry?'));
    expect(searches).toHaveLength(3);
    expect(String(searches[0][0])).toContain('patient=patient-uuid');
    expect(String(searches[0][0])).toContain('isEnded=false');
    expect(String(searches[0][0])).not.toContain('visit=');
  });

  it('fails instead of looping when an active search remains stale', async () => {
    const searchedEntry = { uuid: 'stale-entry', endedAt: null };
    const endedEntry = { ...searchedEntry, endedAt: '2026-08-12T15:30:00.000Z' };
    mockOpenmrsFetch.mockImplementation(async (url) =>
      String(url).includes('/queue-entry?') ? response({ results: [searchedEntry] }) : response(endedEntry),
    );

    await expect(drainActiveQueueEntriesForPatient('patient-uuid')).rejects.toMatchObject({
      code: ACTIVE_QUEUE_ENTRY_SEARCH_STALLED,
    });
    const searches = mockOpenmrsFetch.mock.calls.filter(([url]) => String(url).includes('/queue-entry?'));
    expect(searches).toHaveLength(2);
  });

  it('drains a successor created concurrently while ending a visit queue entry', async () => {
    const entries: Array<ActiveQueueEntrySummary> = [{ uuid: 'source', endedAt: null }];
    mockOpenmrsFetch.mockImplementation(async (url, init) => {
      const requestUrl = String(url);
      if (requestUrl.includes('/queue-entry?')) {
        return response({ results: entries.filter(({ endedAt }) => !endedAt) });
      }
      const uuid = requestUrl.match(/\/queue-entry\/([^?]+)/)?.[1];
      const entry = entries.find((candidate) => candidate.uuid === uuid);
      if (!entry) {
        throw new Error(`Unexpected request: ${requestUrl}`);
      }
      if (init?.method === 'POST') {
        entry.endedAt = '2026-08-12T15:30:00.000Z';
        if (uuid === 'source') {
          entries.push({ uuid: 'successor', endedAt: null });
        }
        return response({});
      }
      return response(entry, 'Wed, 12 Aug 2026 15:30:00 GMT');
    });

    await expect(drainActiveQueueEntriesForVisit('visit-uuid')).resolves.toBe(2);
    const searches = mockOpenmrsFetch.mock.calls.filter(([url]) => String(url).includes('/queue-entry?'));
    expect(searches).toHaveLength(3);
    expect(String(searches[0][0])).toContain('visit=visit-uuid');
  });
});
