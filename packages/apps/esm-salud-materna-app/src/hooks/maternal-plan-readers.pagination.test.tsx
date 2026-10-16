import { openmrsFetch, useConfig } from '@openmrs/esm-framework';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { SWRConfig } from 'swr';
import { useCurrentPregnancy } from './useCurrentPregnancy';
import { usePrenatalSupplementation } from './usePrenatalSupplementation';
import { usePsychoprophylaxis } from './usePsychoprophylaxis';

vi.mock('@openmrs/esm-framework', async (original) => ({
  ...(await original<typeof import('@openmrs/esm-framework')>()),
  useOpenmrsFetchAll: (await import('../../../../libs/esm-react-utils/src/useOpenmrsFetchAll')).useOpenmrsFetchAll,
}));
vi.mock('./useCurrentPregnancy', () => ({ useCurrentPregnancy: vi.fn() }));

type ApiResponse = Awaited<ReturnType<typeof openmrsFetch>>;
const response = (results: unknown[], next?: string) =>
  ({ data: { results, links: next ? [{ rel: 'next', uri: next }] : [] } }) as ApiResponse;
const nextPage = 'https://example.test/openmrs/ws/rest/v1/encounter?startIndex=100';
const wrapper = ({ children }: PropsWithChildren) => (
  <SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false, dedupingInterval: 0 }}>
    {children}
  </SWRConfig>
);
const session = (uuid: string, date = '2026-06-01T12:00:00Z') => ({ uuid, encounterDatetime: date });
const indication = (uuid: string, value: number, date = '2026-06-01T12:00:00Z') => ({
  uuid,
  value,
  obsDatetime: date,
});

beforeEach(() => {
  vi.mocked(useConfig).mockReturnValue({
    psychoprophylaxis: { encounterTypeUuid: 'synthetic-psychoprophylaxis', totalSessionsRequired: 6 },
    supplementation: {
      folicAcidConceptUuid: 'synthetic-folic-acid',
      ironConceptUuid: 'synthetic-iron-folic-acid',
      calciumConceptUuid: 'synthetic-calcium',
    },
  });
  vi.mocked(useCurrentPregnancy).mockReturnValue({
    pregnancyStartDate: '2026-01-01',
    isLoading: false,
    error: null,
  } as ReturnType<typeof useCurrentPregnancy>);
});

it('waits for every psychoprophylaxis page and excludes previous pregnancies', async () => {
  let finish!: (value: ApiResponse) => void;
  const pending = new Promise<ApiResponse>((resolve) => {
    finish = resolve;
  });
  vi.mocked(openmrsFetch).mockImplementation(async (url) =>
    String(url).includes('startIndex=100')
      ? pending
      : response([session('synthetic-old', '2024-01-01T12:00:00Z')], nextPage),
  );
  const { result } = renderHook(() => usePsychoprophylaxis('synthetic-mother'), { wrapper });
  await waitFor(() =>
    expect(vi.mocked(openmrsFetch).mock.calls.some(([url]) => String(url).includes('startIndex=100'))).toBe(true),
  );
  expect(result.current.isLoading).toBe(true);
  await act(async () => finish(response([session('synthetic-current')])));
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.sessionsCompleted).toBe(1);
  expect(result.current.lastSessionDate).toBe('01/06/2026');
});

it('reports a later psychoprophylaxis page error without a partial count', async () => {
  const failure = new Error('Synthetic later page failure');
  vi.mocked(openmrsFetch).mockImplementation(async (url) => {
    if (String(url).includes('startIndex=100')) throw failure;
    return response([session('synthetic-first')], nextPage);
  });
  const { result } = renderHook(() => usePsychoprophylaxis('synthetic-mother'), { wrapper });
  await waitFor(() => expect(result.current.error).toBe(failure));
  expect(result.current.sessionsCompleted).toBe(0);
});

it('does not expose a previous patient count while the new patient is loading', async () => {
  let finish!: (value: ApiResponse) => void;
  const pending = new Promise<ApiResponse>((resolve) => {
    finish = resolve;
  });
  vi.mocked(openmrsFetch).mockImplementation(async (url) =>
    String(url).includes('patient=synthetic-mother-b') ? pending : response([session('synthetic-mother-a-session')]),
  );
  const { result, rerender } = renderHook(({ patientUuid }) => usePsychoprophylaxis(patientUuid), {
    wrapper,
    initialProps: { patientUuid: 'synthetic-mother-a' },
  });
  await waitFor(() => expect(result.current.sessionsCompleted).toBe(1));
  rerender({ patientUuid: 'synthetic-mother-b' });
  expect(result.current.sessionsCompleted).toBe(0);
  expect(result.current.isLoading).toBe(true);
  await act(async () => finish(response([])));
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.sessionsCompleted).toBe(0);
});

it('refreshes the native non-voided encounter search after a session is voided', async () => {
  let active = true;
  vi.mocked(openmrsFetch).mockImplementation(async (url) => {
    expect(new URL(String(url), 'https://example.test').searchParams.get('includeAll')).not.toBe('true');
    return response(active ? [session('synthetic-active')] : []);
  });
  const { result } = renderHook(() => usePsychoprophylaxis('synthetic-mother'), { wrapper });
  await waitFor(() => expect(result.current.sessionsCompleted).toBe(1));
  active = false;
  await act(async () => {
    await result.current.mutate();
  });
  await waitFor(() => expect(result.current.sessionsCompleted).toBe(0));
});

it('reads all indication pages and keeps iron/folic acid distinct from folic acid', async () => {
  const next =
    'https://example.test/openmrs/ws/rest/v1/obs?patient=synthetic-mother&concept=synthetic-iron-folic-acid&startIndex=100';
  let finish!: (value: ApiResponse) => void;
  const pending = new Promise<ApiResponse>((resolve) => {
    finish = resolve;
  });
  vi.mocked(openmrsFetch).mockImplementation(async (url) => {
    const target = new URL(String(url), 'https://example.test');
    if (target.searchParams.has('startIndex')) return pending;
    if (target.searchParams.get('concept') === 'synthetic-iron-folic-acid') {
      return response([indication('synthetic-first', 30), indication('synthetic-old', 99, '2024-01-01')], next);
    }
    return response(
      target.searchParams.get('concept') === 'synthetic-folic-acid' ? [indication('synthetic-folic', 0)] : [],
    );
  });
  const { result } = renderHook(() => usePrenatalSupplementation('synthetic-mother'), { wrapper });
  await waitFor(() =>
    expect(vi.mocked(openmrsFetch).mock.calls.some(([url]) => String(url).includes('startIndex=100'))).toBe(true),
  );
  expect(result.current.isLoading).toBe(true);
  await act(async () => finish(response([indication('synthetic-second', 20)])));
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.supplements).toEqual([
    { nameKey: 'prenatalFolicAcid', indicatedTablets: 0 },
    { nameKey: 'prenatalIronFolicAcid', indicatedTablets: 50 },
    { nameKey: 'prenatalCalcium', indicatedTablets: null },
  ]);
  expect(result.current).not.toHaveProperty('overallPercentage');
});

it('reports an indication page error instead of a partial total', async () => {
  const failure = new Error('Synthetic indication page failure');
  vi.mocked(openmrsFetch).mockImplementation(async (url) => {
    const target = new URL(String(url), 'https://example.test');
    if (target.searchParams.has('startIndex')) throw failure;
    return response([], `${target.origin}${target.pathname}?startIndex=100`);
  });
  const { result } = renderHook(() => usePrenatalSupplementation('synthetic-mother'), { wrapper });
  await waitFor(() => expect(result.current.error).toBe(failure));
});

it('isolates indication totals when switching patients and after native voiding', async () => {
  let active = true;
  let finish!: (value: ApiResponse) => void;
  const pending = new Promise<ApiResponse>((resolve) => {
    finish = resolve;
  });
  vi.mocked(openmrsFetch).mockImplementation(async (url) => {
    const target = new URL(String(url), 'https://example.test');
    expect(target.searchParams.get('includeAll')).not.toBe('true');
    if (target.searchParams.get('patient') === 'synthetic-mother-b') return pending;
    return response(active ? [indication('synthetic-active', 30)] : []);
  });
  const { result, rerender } = renderHook(({ patientUuid }) => usePrenatalSupplementation(patientUuid), {
    wrapper,
    initialProps: { patientUuid: 'synthetic-mother-a' },
  });
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.supplements[0].indicatedTablets).toBe(30);
  active = false;
  await act(async () => {
    await result.current.mutate();
  });
  await waitFor(() => expect(result.current.supplements[0].indicatedTablets).toBeNull());
  rerender({ patientUuid: 'synthetic-mother-b' });
  expect(result.current.isLoading).toBe(true);
  expect(result.current.supplements.every(({ indicatedTablets }) => indicatedTablets === null)).toBe(true);
  await act(async () => finish(response([indication('synthetic-mother-b', 10)])));
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.supplements[0].indicatedTablets).toBe(10);
  expect(
    vi
      .mocked(openmrsFetch)
      .mock.calls.every(([url]) => new URL(String(url), 'https://example.test').searchParams.has('patient')),
  ).toBe(true);
});
