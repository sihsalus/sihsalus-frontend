import { openmrsFetch, useConfig } from '@openmrs/esm-framework';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { SWRConfig } from 'swr';

import { useCurrentPregnancy } from './useCurrentPregnancy';
import { usePrenatalCare } from './usePrenatalCare';

vi.mock('@openmrs/esm-framework', async (original) => ({
  ...(await original<typeof import('@openmrs/esm-framework')>()),
  useOpenmrsFetchAll: (await import('../../../../libs/esm-react-utils/src/useOpenmrsFetchAll')).useOpenmrsFetchAll,
}));
vi.mock('./useCurrentPregnancy', () => ({ useCurrentPregnancy: vi.fn() }));

type ApiResponse = Awaited<ReturnType<typeof openmrsFetch>>;
const response = (results: unknown[], next?: string) =>
  ({ data: { results, links: next ? [{ rel: 'next', uri: next }] : [] } }) as ApiResponse;
const first = {
  uuid: 'synthetic-prenatal-first',
  encounterDatetime: '2026-06-01T12:00:00Z',
  form: { uuid: 'synthetic-prenatal-form' },
  obs: [],
};
const second = { ...first, uuid: 'synthetic-prenatal-second', encounterDatetime: '2026-07-01T12:00:00Z' };
const nextPage = 'https://example.test/openmrs/ws/rest/v1/encounter?startIndex=100';
const wrapper = ({ children }: PropsWithChildren) => (
  <SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false, dedupingInterval: 0 }}>
    {children}
  </SWRConfig>
);

beforeEach(() => {
  vi.mocked(useConfig).mockReturnValue({
    encounterTypes: { prenatalControl: 'synthetic-prenatal-type' },
    formsList: { atencionPrenatal: 'synthetic-prenatal-form' },
  });
  vi.mocked(useCurrentPregnancy).mockReturnValue({
    pregnancyStartDate: '2026-01-01',
    isLoading: false,
    error: null,
  } as ReturnType<typeof useCurrentPregnancy>);
});

it('waits for every page before exposing prenatal controls and excludes previous pregnancies', async () => {
  let finish!: (value: ApiResponse) => void;
  const pending = new Promise<ApiResponse>((resolve) => {
    finish = resolve;
  });
  vi.mocked(openmrsFetch).mockImplementation(async (url) =>
    String(url).includes('startIndex=100')
      ? pending
      : response([first, { ...first, uuid: 'synthetic-old', encounterDatetime: '2024-01-01T12:00:00Z' }], nextPage),
  );
  const { result } = renderHook(() => usePrenatalCare('synthetic-mother'), { wrapper });
  await waitFor(() =>
    expect(vi.mocked(openmrsFetch).mock.calls.some(([url]) => String(url).includes('startIndex=100'))).toBe(true),
  );
  expect(result.current.prenatalEncounters).toEqual([]);
  expect(result.current.isValidating).toBe(true);
  await act(async () => finish(response([second])));
  await waitFor(() => expect(result.current.isValidating).toBe(false));
  expect(result.current.prenatalEncounters.map(({ uuid }) => uuid)).toEqual([first.uuid, second.uuid]);
});

it('does not report an incomplete history as no controls after a later-page failure', async () => {
  const failure = new Error('Synthetic pagination failure');
  vi.mocked(openmrsFetch).mockImplementation(async (url) => {
    if (String(url).includes('startIndex=100')) throw failure;
    return response([first], nextPage);
  });
  const { result } = renderHook(() => usePrenatalCare('synthetic-mother'), { wrapper });
  await waitFor(() => expect(result.current.error).toBe(failure));
  expect(result.current.prenatalEncounters).toEqual([]);
});
