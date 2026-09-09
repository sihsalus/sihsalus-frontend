import {
  type FetchResponse,
  getDefaultsFromConfigSchema,
  openmrsFetch,
  restBaseUrl,
  useConfig,
} from '@openmrs/esm-framework';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { SWRConfig, useSWRConfig } from 'swr';
import { type Config, configSchema } from '../config-schema';
import { useEmergencyQueueEntries } from './emergency.resource';

vi.mock('../utils/service-queues-integration', () => ({ useServiceQueuesFilters: () => ({}) }));

const mockFetch = vi.mocked(openmrsFetch);
const location = '11111111-1111-4111-8111-111111111111';
const queue = '22222222-2222-4222-8222-222222222222';
const config = { ...getDefaultsFromConfigSchema(configSchema), autoRefreshInterval: 0 } as Config;

function wrapper({ children }: PropsWithChildren) {
  return (
    <SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false, dedupingInterval: 0 }}>
      {children}
    </SWRConfig>
  );
}

function response<T>(data: T): FetchResponse<T> {
  return { data, status: 200, headers: new Headers() } as FetchResponse<T>;
}

const catalogResponse = response({ results: [{ uuid: queue, display: 'Synthetic queue' }] });
const entriesResponse = response({ results: [{ uuid: 'synthetic-entry' }], totalCount: 1 });
const isCatalog = (url: unknown) => String(url).startsWith(`${restBaseUrl}/queue?`);

beforeEach(() => {
  mockFetch.mockReset();
  vi.mocked(useConfig).mockReturnValue(config);
});

it.each([401, 403, 503])('reports catalog HTTP %s as a loading error rather than an empty queue', async (status) => {
  const error = Object.assign(new Error('Synthetic catalog failure'), { status });
  mockFetch.mockImplementation(async (url) => {
    if (isCatalog(url)) throw error;
    return entriesResponse;
  });

  const { result } = renderHook(() => useEmergencyQueueEntries(undefined, undefined, location, queue), { wrapper });

  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.error).toBe(error);
  expect(result.current.queueEntries).toEqual([]);
  expect(mockFetch.mock.calls.every(([url]) => isCatalog(url))).toBe(true);
});

it('recovers after the catalog becomes available without fetching another queue', async () => {
  let available = false;
  mockFetch.mockImplementation(async (url) => {
    if (isCatalog(url)) {
      if (!available) throw new Error('Synthetic offline catalog');
      return catalogResponse;
    }
    return entriesResponse;
  });
  const { result } = renderHook(
    () => ({
      entries: useEmergencyQueueEntries(undefined, undefined, location, queue),
      revalidate: useSWRConfig().mutate,
    }),
    { wrapper },
  );
  await waitFor(() => expect(result.current.entries.error).toBeDefined());

  available = true;
  await act(async () => {
    await result.current.revalidate((key) => isCatalog(key));
  });

  await waitFor(() => expect(result.current.entries.queueEntries).toEqual(entriesResponse.data.results));
  expect(result.current.entries.error).toBeUndefined();
  const entryCalls = mockFetch.mock.calls.filter(([url]) => !isCatalog(url));
  expect(entryCalls.length).toBeGreaterThan(0);
  expect(
    entryCalls.every(([url]) => new URL(String(url), 'https://synthetic.invalid').searchParams.get('queue') === queue),
  ).toBe(true);
});

it('keeps a validated absent queue empty without broadening the query', async () => {
  mockFetch.mockResolvedValue(response({ results: [] }));
  const { result } = renderHook(() => useEmergencyQueueEntries(undefined, undefined, location, queue), { wrapper });

  await waitFor(() => expect(result.current.isLoading).toBe(false));

  expect(result.current.error).toBeUndefined();
  expect(result.current.queueEntries).toEqual([]);
  expect(mockFetch.mock.calls.every(([url]) => isCatalog(url))).toBe(true);
});

it('loads all-queue data independently when no queue validation was requested', async () => {
  mockFetch.mockImplementation(async (url) => {
    if (isCatalog(url)) throw new Error('Synthetic unused catalog failure');
    return entriesResponse;
  });
  const { result } = renderHook(() => useEmergencyQueueEntries(undefined, undefined, location), { wrapper });

  await waitFor(() => expect(result.current.queueEntries).toEqual(entriesResponse.data.results));
  expect(result.current.error).toBeUndefined();
});

it('does not fetch other queues when the requested queue has no location to validate against', () => {
  const { result } = renderHook(() => useEmergencyQueueEntries(undefined, undefined, '', queue), { wrapper });

  expect(result.current.queueEntries).toEqual([]);
  expect(result.current.isLoading).toBe(false);
  expect(mockFetch).not.toHaveBeenCalled();
});
