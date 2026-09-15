import { openmrsFetch } from '@openmrs/esm-framework';
import { act, renderHook } from '@testing-library/react';
import React from 'react';
import { SWRConfig } from 'swr';
import { useQueueEntries } from './useQueueEntries';

const fetchMock = vi.mocked(openmrsFetch);
const response = (uuids: string[], next?: string) =>
  ({
    data: {
      results: uuids.map((uuid) => ({ uuid })),
      totalCount: uuids.length,
      links: next ? [{ rel: 'next', uri: next }] : [],
    },
  }) as Awaited<ReturnType<typeof openmrsFetch>>;

function wrapper({ children }: { children: React.ReactNode }) {
  return <SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false }}>{children}</SWRConfig>;
}

async function advance(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock.mockReset();
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it('refreshes all pages and removes stale rows when the queue shrinks, keeping filters', async () => {
  fetchMock.mockResolvedValueOnce(response(['first'], `${location.origin}/ws/rest/v1/queue-entry?startIndex=1`));
  fetchMock.mockResolvedValueOnce(response(['second']));
  const { result } = renderHook(() => useQueueEntries({ status: 'waiting', service: 'service-a', isEnded: false }), {
    wrapper,
  });
  await advance();
  expect(result.current.queueEntries.map(({ uuid }) => uuid)).toEqual(['first', 'second']);
  fetchMock.mockResolvedValue(response(['new-arrival']));
  await advance(15_000);
  expect(result.current.queueEntries.map(({ uuid }) => uuid)).toEqual(['new-arrival']);
  expect(result.current.totalCount).toBe(1);
  const url = new URL(String(fetchMock.mock.calls.at(-1)?.[0]), location.origin);
  expect(url.searchParams.get('status')).toBe('waiting');
  expect(url.searchParams.get('service')).toBe('service-a');
});

it('retains the complete list during refresh and after a failed later page', async () => {
  fetchMock.mockResolvedValueOnce(response(['original']));
  const { result } = renderHook(() => useQueueEntries(), { wrapper });
  await advance();
  fetchMock.mockResolvedValueOnce(response(['partial'], `${location.origin}/ws/rest/v1/queue-entry?startIndex=1`));
  fetchMock.mockRejectedValueOnce(new Error('Synthetic request failure'));
  await advance(15_000);
  expect(result.current.queueEntries.map(({ uuid }) => uuid)).toEqual(['original']);
  expect(result.current.error).toBeDefined();
  expect(result.current.isLoading).toBe(false);
  fetchMock.mockResolvedValue(response(['recovered']));
  await act(async () => {
    await result.current.mutate();
  });
  expect(result.current.queueEntries.map(({ uuid }) => uuid)).toEqual(['recovered']);
  expect(result.current.error).toBeUndefined();
  expect(fetchMock).toHaveBeenCalledTimes(4);
});

it('pauses polling while hidden and stops after unmounting', async () => {
  fetchMock.mockResolvedValue(response([]));
  const { unmount } = renderHook(() => useQueueEntries(), { wrapper });
  await advance();
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
  await advance(30_000);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  await advance(15_000);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  unmount();
  await advance(30_000);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it('shares refresh requests between consumers of the same queue', async () => {
  fetchMock.mockResolvedValue(response(['entry']));
  renderHook(
    () => {
      useQueueEntries();
      useQueueEntries();
    },
    { wrapper },
  );
  await advance();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  await advance(15_000);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it('pauses offline and refreshes after reconnecting', async () => {
  fetchMock.mockResolvedValue(response(['before']));
  const { result, unmount } = renderHook(() => useQueueEntries(), { wrapper });
  await advance();
  act(() => window.dispatchEvent(new Event('offline')));
  await advance(30_000);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  fetchMock.mockResolvedValue(response(['after']));
  act(() => window.dispatchEvent(new Event('online')));
  await advance();
  expect(result.current.queueEntries.map(({ uuid }) => uuid)).toEqual(['after']);
  unmount();
});

it('does not expose rows from the previous service after changing filters', async () => {
  fetchMock.mockResolvedValueOnce(response(['service-a-entry']));
  const { result, rerender } = renderHook(({ service }) => useQueueEntries({ service, isEnded: false }), {
    wrapper,
    initialProps: { service: 'service-a' },
  });
  await advance();
  expect(result.current.queueEntries.map(({ uuid }) => uuid)).toEqual(['service-a-entry']);
  fetchMock.mockResolvedValue(response(['service-b-entry']));
  rerender({ service: 'service-b' });
  expect(result.current.queueEntries).toEqual([]);
  await advance();
  expect(result.current.queueEntries.map(({ uuid }) => uuid)).toEqual(['service-b-entry']);
});
