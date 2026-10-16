import { openmrsFetch } from '@openmrs/esm-framework';
import { act, renderHook, waitFor } from '@testing-library/react';
import { type PropsWithChildren } from 'react';
import { SWRConfig } from 'swr';
import { mockQueueEntries } from 'test-utils';
import { getQueueEntryDateCriteria } from '../store/queue-entry-date';
import { useQueueEntries } from './useQueueEntries';
import { useQueues } from './useQueues';

const mockFetch = vi.mocked(openmrsFetch);
const firstEntry = mockQueueEntries[0];
const secondEntry = mockQueueEntries[1];
const nextPage = 'http://localhost/openmrs/ws/rest/v1/queue-entry?startIndex=1';

function page(entries = [firstEntry], next?: string) {
  return {
    data: {
      results: entries,
      totalCount: next ? 2 : entries.length,
      links: next ? [{ rel: 'next', uri: next }] : [],
    },
  };
}

function createWrapper() {
  const cache = new Map();
  return ({ children }: PropsWithChildren) => (
    <SWRConfig value={{ provider: () => cache, dedupingInterval: 0, shouldRetryOnError: false }}>{children}</SWRConfig>
  );
}

beforeEach(() => {
  mockFetch.mockReset();
});

it('requeries the server by entry day, loads all pages, and separates empty and failed dates', async () => {
  mockFetch.mockImplementation(async (url) => {
    const query = new URL(String(url), 'http://localhost').searchParams;
    if (!query.has('startedOnOrAfter')) return page([firstEntry]) as never;
    if (query.get('startIndex')) return page([secondEntry]) as never;
    // The native next link retains its search criteria.
    const next = new URL(String(url), 'http://localhost');
    next.searchParams.set('startIndex', '1');
    return page([firstEntry], next.href) as never;
  });
  const { result, rerender } = renderHook(
    ({ date }: { date: string | null }) =>
      useQueueEntries({
        service: 'synthetic-service',
        status: 'synthetic-waiting',
        isEnded: false,
        ...getQueueEntryDateCriteria(date),
      }),
    { initialProps: { date: null as string | null }, wrapper: createWrapper() },
  );
  await waitFor(() => expect(result.current.queueEntries).toEqual([firstEntry]));
  rerender({ date: '2026-10-11' });
  await waitFor(() => expect(result.current.queueEntries).toEqual([firstEntry, secondEntry]));
  const selectedDateRequests = mockFetch.mock.calls.filter(([url]) => String(url).includes('startedOnOrAfter'));
  expect(selectedDateRequests).toHaveLength(2);
  for (const [url, options] of selectedDateRequests) {
    const query = new URL(String(url), 'http://localhost').searchParams;
    expect(query.get('startedOnOrAfter')).toBe(getQueueEntryDateCriteria('2026-10-11').startedOnOrAfter);
    expect(query.get('startedOnOrBefore')).toBe(getQueueEntryDateCriteria('2026-10-11').startedOnOrBefore);
    expect(query.get('service')).toBe('synthetic-service');
    expect(query.get('status')).toBe('synthetic-waiting');
    expect(query.get('isEnded')).toBe('false');
    expect(options).toEqual(expect.objectContaining({ cache: 'no-store' }));
  }
  mockFetch.mockResolvedValue(page([]) as never);
  rerender({ date: '2026-10-12' });
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.queueEntries).toEqual([]);
  expect(result.current.error).toBeUndefined();
  mockFetch.mockRejectedValue(new Error('Synthetic date query failure'));
  rerender({ date: '2026-10-13' });
  await waitFor(() => expect(result.current.error).toBeDefined());
  expect(result.current.queueEntries).toEqual([]);
  mockFetch.mockResolvedValue(page([firstEntry]) as never);
  rerender({ date: null });
  await waitFor(() => expect(result.current.queueEntries).toEqual([firstEntry]));
  const lastQuery = new URL(String(mockFetch.mock.calls.at(-1)[0]), 'http://localhost').searchParams;
  expect(lastQuery.has('startedOnOrAfter')).toBe(false);
  expect(lastQuery.has('startedOnOrBefore')).toBe(false);
});

it('keeps the first load pending until every page succeeds, without displaying a partial queue', async () => {
  let finishLastPage: (value: unknown) => void;
  mockFetch.mockImplementation(async (url) => {
    if (String(url).includes('startIndex')) {
      return new Promise((resolve) => {
        finishLastPage = resolve;
      }) as never;
    }
    return page([firstEntry], nextPage) as never;
  });
  const { result } = renderHook(() => useQueueEntries(), { wrapper: createWrapper() });

  expect(result.current.isLoading).toBeTruthy();
  await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
  expect(result.current.queueEntries).toEqual([]);
  expect(result.current.isLoading).toBeTruthy();

  await act(async () => finishLastPage(page([secondEntry])));
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.queueEntries).toEqual([firstEntry, secondEntry]);
});

it('refreshes a completed queue automatically when the browser reconnects', async () => {
  let entries = [firstEntry];
  mockFetch.mockImplementation(async () => page(entries) as never);
  const { result } = renderHook(() => useQueueEntries(), { wrapper: createWrapper() });
  await waitFor(() => expect(result.current.queueEntries).toEqual([firstEntry]));

  act(() => window.dispatchEvent(new Event('offline')));
  entries = [secondEntry];
  act(() => window.dispatchEvent(new Event('online')));

  await waitFor(() => expect(result.current.queueEntries).toEqual([secondEntry]));
  expect(result.current.error).toBeUndefined();
});

it('clears a connection error after a successful retry', async () => {
  mockFetch.mockRejectedValueOnce(new Error('Synthetic connection failure'));
  const { result } = renderHook(() => useQueueEntries(), { wrapper: createWrapper() });
  await waitFor(() => expect(result.current.error).toBeDefined());

  mockFetch.mockResolvedValue(page() as never);
  await act(async () => {
    await result.current.mutate();
  });

  await waitFor(() => expect(result.current.queueEntries).toEqual([firstEntry]));
  expect(result.current.error).toBeUndefined();
  expect(result.current.isLoading).toBe(false);
});

it('retains only the last complete result if a later page fails during refresh', async () => {
  let refreshing = false;
  mockFetch.mockImplementation(async (url) => {
    if (!refreshing) return page([firstEntry, secondEntry]) as never;
    if (String(url).includes('startIndex')) throw new Error('Synthetic connection failure');
    return page([{ ...firstEntry, uuid: 'synthetic-new-entry' }], nextPage) as never;
  });
  const { result } = renderHook(() => useQueueEntries(), { wrapper: createWrapper() });
  await waitFor(() => expect(result.current.queueEntries).toEqual([firstEntry, secondEntry]));

  refreshing = true;
  await act(async () => {
    await result.current.mutate();
  });

  await waitFor(() => expect(result.current.error).toBeDefined());
  expect(result.current.queueEntries).toEqual([firstEntry, secondEntry]);
  expect(result.current.isValidating).toBe(false);
});

it('does not show another service’s entries while a changed filter is loading or fails', async () => {
  mockFetch.mockResolvedValueOnce(page() as never);
  const { result, rerender } = renderHook(({ service }) => useQueueEntries({ service, isEnded: false }), {
    initialProps: { service: 'synthetic-service-a' },
    wrapper: createWrapper(),
  });
  await waitFor(() => expect(result.current.queueEntries).toEqual([firstEntry]));

  mockFetch.mockRejectedValue(new Error('Synthetic connection failure'));
  rerender({ service: 'synthetic-service-b' });

  expect(result.current.queueEntries).toEqual([]);
  await waitFor(() => expect(result.current.error).toBeDefined());
  expect(result.current.queueEntries).toEqual([]);
});

it('replaces all old pages when the refreshed queue is shorter and requests fresh network reads', async () => {
  let refreshing = false;
  mockFetch.mockImplementation(async (url) => {
    if (refreshing) return page([secondEntry]) as never;
    return (String(url).includes('startIndex') ? page([secondEntry]) : page([firstEntry], nextPage)) as never;
  });
  const { result } = renderHook(() => useQueueEntries(), { wrapper: createWrapper() });
  await waitFor(() => expect(result.current.queueEntries).toEqual([firstEntry, secondEntry]));

  refreshing = true;
  await act(async () => {
    await result.current.mutate();
  });

  await waitFor(() => expect(result.current.queueEntries).toEqual([secondEntry]));
  expect(result.current.totalCount).toBe(1);
  for (const [, options] of mockFetch.mock.calls) {
    expect(options).toEqual(expect.objectContaining({ cache: 'no-store' }));
  }
});

it('refreshes entries when another queue screen announces an update', async () => {
  let entries = [firstEntry];
  mockFetch.mockImplementation(async () => page(entries) as never);
  const { result } = renderHook(() => useQueueEntries(), { wrapper: createWrapper() });
  await waitFor(() => expect(result.current.queueEntries).toEqual([firstEntry]));

  entries = [secondEntry];
  act(() => window.dispatchEvent(new CustomEvent('queue-entry-updated')));

  await waitFor(() => expect(result.current.queueEntries).toEqual([secondEntry]));
});

it('reports a repeated pagination link instead of fetching indefinitely or publishing partial results', async () => {
  mockFetch.mockResolvedValue(page([firstEntry], nextPage) as never);
  const { result } = renderHook(() => useQueueEntries(), { wrapper: createWrapper() });

  await waitFor(() => expect(result.current.error).toBeDefined());
  expect(mockFetch).toHaveBeenCalledTimes(2);
  expect(result.current.queueEntries).toEqual([]);
  expect(result.current.isValidating).toBe(false);
});

it('recovers service and status metadata after an initial connection failure', async () => {
  mockFetch.mockRejectedValue(new Error('Synthetic connection failure'));
  const { result } = renderHook(() => useQueues(), { wrapper: createWrapper() });
  await waitFor(() => expect(result.current.error).toBeDefined());

  act(() => window.dispatchEvent(new Event('offline')));
  mockFetch.mockResolvedValue({ data: { results: [firstEntry.queue] } } as never);
  act(() => window.dispatchEvent(new Event('online')));

  await waitFor(() => expect(result.current.queues).toEqual([firstEntry.queue]));
  expect(result.current.error).toBeUndefined();
});
