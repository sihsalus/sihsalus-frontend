import { openmrsFetch, useConfig } from '@openmrs/esm-framework';
import { act, renderHook, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { useSupplementationTracker } from './useSupplementationTracker';

vi.mock('@openmrs/esm-framework', async (original) => ({
  ...(await original<typeof import('@openmrs/esm-framework')>()),
  useOpenmrsFetchAll: (await import('../../../../libs/esm-react-utils/src/useOpenmrsFetchAll')).useOpenmrsFetchAll,
}));

type ApiResponse = Awaited<ReturnType<typeof openmrsFetch>>;
const nextPage = 'https://example.test/openmrs/ws/rest/v1/obs?patient=synthetic-child&startIndex=1';
const response = (value: number, next?: string): ApiResponse =>
  ({
    data: {
      results: [{ uuid: `synthetic-${next ? 'first' : 'last'}-${value}`, value, obsDatetime: '2026-10-01T09:00:00Z' }],
      links: next ? [{ rel: 'next', uri: next }] : [],
    },
  }) as ApiResponse;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useConfig).mockReturnValue({
    supplementation: { mmnConceptUuid: 'synthetic-mmn', mmnTotalTarget: 360 },
  });
});

const renderTracker = () =>
  renderHook(({ patientUuid }) => useSupplementationTracker(patientUuid), {
    initialProps: { patientUuid: 'synthetic-child' },
    wrapper: ({ children }) => (
      <SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false, dedupingInterval: 0 }}>
        {children}
      </SWRConfig>
    ),
  });

it('waits for all delivery pages before showing the full total', async () => {
  let finish!: (value: ApiResponse) => void;
  const pending = new Promise<ApiResponse>((resolve) => {
    finish = resolve;
  });
  vi.mocked(openmrsFetch).mockImplementation(async (url) =>
    String(url).includes('startIndex=1') ? pending : response(180, nextPage),
  );
  const { result } = renderTracker();
  await waitFor(() =>
    expect(vi.mocked(openmrsFetch).mock.calls.some(([url]) => String(url).includes('startIndex=1'))).toBe(true),
  );
  expect(result.current.isLoading).toBe(true);
  expect(result.current.isComplete).toBe(false);
  await act(async () => finish(response(180)));
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current).toMatchObject({ delivered: 360, total: 360, percentage: 100, isComplete: true });
});

it('exposes later page failures and recomputes the complete count on retry', async () => {
  const failure = new Error('Synthetic delivery page failure');
  let failed = true;
  vi.mocked(openmrsFetch).mockImplementation(async (url) => {
    if (String(url).includes('startIndex=1')) {
      if (failed) throw failure;
      return response(120);
    }
    return response(180, nextPage);
  });
  const { result } = renderTracker();
  await waitFor(() => expect(result.current.error).toBe(failure));
  expect(result.current.isComplete).toBe(false);
  failed = false;
  await act(async () => {
    await result.current.mutate();
  });
  await waitFor(() => expect(result.current.error).toBeUndefined());
  expect(result.current).toMatchObject({ delivered: 300, percentage: (300 / 360) * 100, isComplete: false });
});

it('clears the previous patient delivery total while the next patient is loading', async () => {
  let finish!: (value: ApiResponse) => void;
  const pending = new Promise<ApiResponse>((resolve) => {
    finish = resolve;
  });
  vi.mocked(openmrsFetch).mockImplementation(async (url) =>
    String(url).includes('synthetic-other-child') ? pending : response(360),
  );
  const { result, rerender } = renderTracker();
  await waitFor(() => expect(result.current.delivered).toBe(360));
  rerender({ patientUuid: 'synthetic-other-child' });
  expect(result.current.isLoading).toBe(true);
  expect(result.current.isComplete).toBe(false);
  await act(async () => finish(response(90)));
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current).toMatchObject({ delivered: 90, percentage: 25, isComplete: false });
});
