import { openmrsFetch, useConfig } from '@openmrs/esm-framework';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { SWRConfig } from 'swr';
import { useCurrentPregnancy } from './useCurrentPregnancy';

vi.mock('@openmrs/esm-framework', async (original) => ({
  ...(await original<typeof import('@openmrs/esm-framework')>()),
  useOpenmrsFetchAll: (await import('../../../../libs/esm-react-utils/src/useOpenmrsFetchAll')).useOpenmrsFetchAll,
}));

type ApiResponse = Awaited<ReturnType<typeof openmrsFetch>>;
const response = (results: unknown[], next?: string) =>
  ({
    data: { results, links: next ? [{ rel: 'next', uri: next }] : [] },
  }) as ApiResponse;

const previousPregnancy = {
  uuid: 'synthetic-previous-pregnancy',
  encounterDatetime: '2024-01-02T12:00:00Z',
  form: { uuid: 'synthetic-current-pregnancy-form' },
};
const currentPregnancy = {
  uuid: 'synthetic-current-pregnancy',
  encounterDatetime: '2026-02-02T12:00:00Z',
  form: { uuid: 'synthetic-current-pregnancy-form' },
  obs: [
    {
      concept: { uuid: 'synthetic-last-menstrual-period' },
      value: '2026-01-01',
    },
  ],
};
const nextPage = 'https://example.test/openmrs/ws/rest/v1/encounter?startIndex=100';
const wrapper = ({ children }: PropsWithChildren) => (
  <SWRConfig
    value={{
      provider: () => new Map(),
      shouldRetryOnError: false,
      dedupingInterval: 0,
    }}
  >
    {children}
  </SWRConfig>
);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useConfig).mockReturnValue({
    encounterTypes: { prenatalControl: 'synthetic-prenatal-type' },
    formsList: { currentPregnancy: 'synthetic-current-pregnancy-form' },
    pregnancyEpisode: {
      lastMenstrualPeriodConceptUuid: 'synthetic-last-menstrual-period',
    },
  });
});

it('waits for the complete encounter history before selecting the current pregnancy', async () => {
  let finish!: (value: ApiResponse) => void;
  const pending = new Promise<ApiResponse>((resolve) => {
    finish = resolve;
  });
  vi.mocked(openmrsFetch).mockImplementation(async (url) =>
    String(url).includes('startIndex=100') ? pending : response([previousPregnancy], nextPage),
  );

  const { result } = renderHook(() => useCurrentPregnancy('synthetic-mother'), {
    wrapper,
  });
  await waitFor(() =>
    expect(vi.mocked(openmrsFetch).mock.calls.some(([url]) => String(url).includes('startIndex=100'))).toBe(true),
  );
  expect(result.current.isLoading).toBe(true);
  expect(result.current.currentPregnancyEncounter).toBeUndefined();

  await act(async () => finish(response([currentPregnancy])));
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.currentPregnancyEncounter?.uuid).toBe('synthetic-current-pregnancy');
  expect(result.current.pregnancyStartDate).toBe('2026-01-01');
});

it('exposes a later page error instead of selecting an incomplete pregnancy history', async () => {
  const failure = new Error('Synthetic second page failure');
  vi.mocked(openmrsFetch).mockImplementation(async (url) => {
    if (String(url).includes('startIndex=100')) throw failure;
    return response([previousPregnancy], nextPage);
  });

  const { result } = renderHook(() => useCurrentPregnancy('synthetic-mother'), {
    wrapper,
  });
  await waitFor(() => expect(result.current.error).toBe(failure));
  expect(result.current.currentPregnancyEncounter).toBeUndefined();
  expect(result.current.pregnancyStartDate).toBeUndefined();
});
