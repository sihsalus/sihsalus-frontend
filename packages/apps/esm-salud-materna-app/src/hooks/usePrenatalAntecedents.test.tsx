import { openmrsFetch, useConfig } from '@openmrs/esm-framework';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { SWRConfig } from 'swr';
import { usePrenatalAntecedents } from './usePrenatalAntecedents';

vi.mock('@openmrs/esm-framework', async (original) => ({
  ...(await original<typeof import('@openmrs/esm-framework')>()),
  useOpenmrsFetchAll: (await import('../../../../libs/esm-react-utils/src/useOpenmrsFetchAll')).useOpenmrsFetchAll,
}));

type Response = Awaited<ReturnType<typeof openmrsFetch>>;
const response = (results: unknown[], next?: string) =>
  ({ data: { results, links: next ? [{ rel: 'next', uri: next }] : [] } }) as Response;
const wrapper = ({ children }: PropsWithChildren) => (
  <SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false, dedupingInterval: 0 }}>
    {children}
  </SWRConfig>
);
const mother = '10000000-0000-4000-8000-000000000001';
const nextPage = 'https://example.test/openmrs/ws/rest/v1/encounter?startIndex=100';
const form = { name: 'OBST-001-ANTECEDENTES' };
const encounter = (uuid: string, date: string, concept: string, value: unknown) => ({
  uuid,
  encounterDatetime: date,
  form,
  obs: [{ concept: { uuid: 'synthetic-group' }, groupMembers: [{ concept: { uuid: concept }, value }] }],
});

beforeEach(() => {
  vi.mocked(useConfig).mockReturnValue({
    formsList: { maternalHistory: form.name },
    madreGestante: {
      gravidezUuid: 'synthetic-gestas',
      partoAbortoUuid: 'synthetic-abortions',
      partoNacidoVivoUuid: 'synthetic-live',
      partoAlTerminoUuid: 'synthetic-term',
      partosUuid: '',
    },
  });
});

it('waits for all pages, reads grouped zeros and preserves distinct encounters with the same date', async () => {
  let finish!: (value: Response) => void;
  const pending = new Promise<Response>((resolve) => {
    finish = resolve;
  });
  const date = '2026-10-01T12:00:00Z';
  vi.mocked(openmrsFetch).mockImplementation(async (url) =>
    String(url).includes('startIndex=100')
      ? pending
      : response([encounter('synthetic-first', date, 'synthetic-abortions', 0)], nextPage),
  );
  const { result } = renderHook(() => usePrenatalAntecedents(mother), { wrapper });
  await waitFor(() =>
    expect(vi.mocked(openmrsFetch).mock.calls.some(([url]) => String(url).includes('startIndex=100'))).toBe(true),
  );
  expect(result.current.isLoading).toBe(true);
  expect(result.current.data).toEqual([]);
  await act(async () => finish(response([encounter('synthetic-second', date, 'synthetic-live', 2)])));
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.data).toHaveLength(2);
  expect(result.current.data.find((record) => record.id === 'synthetic-first')).toMatchObject({ partoAborto: 0 });
  expect(result.current.data.find((record) => record.id === 'synthetic-first')?.partoNacidoVivo).toBeUndefined();
});

it('does not reinterpret term deliveries as the HCMP total or include other forms', async () => {
  const first = encounter('synthetic-history', '2026-10-01T12:00:00Z', 'synthetic-term', 3);
  vi.mocked(openmrsFetch).mockResolvedValue(
    response([first, { ...first, uuid: 'synthetic-unrelated', form: { name: 'Another form' } }]),
  );
  const { result } = renderHook(() => usePrenatalAntecedents(mother), { wrapper });
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.data).toEqual([{ id: first.uuid, date: first.encounterDatetime }]);
});

it('propagates a later-page failure without exposing an incomplete history', async () => {
  const failure = new Error('Synthetic pagination failure');
  vi.mocked(openmrsFetch).mockImplementation(async (url) => {
    if (String(url).includes('startIndex=100')) throw failure;
    return response([encounter('synthetic-first', '2026-10-01T12:00:00Z', 'synthetic-live', 2)], nextPage);
  });
  const { result } = renderHook(() => usePrenatalAntecedents(mother), { wrapper });
  await waitFor(() => expect(result.current.error).toBe(failure));
  expect(result.current.data).toEqual([]);
});

it('reports invalid numeric values instead of coercing them to a clinical zero', async () => {
  vi.mocked(openmrsFetch).mockResolvedValue(
    response([encounter('synthetic-invalid', '2026-10-01T12:00:00Z', 'synthetic-live', 'not a number')]),
  );
  const { result } = renderHook(() => usePrenatalAntecedents(mother), { wrapper });
  await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
  expect(result.current.data).toEqual([]);
});

it('never assigns today to an encounter with an invalid date', async () => {
  vi.mocked(openmrsFetch).mockResolvedValue(
    response([encounter('synthetic-invalid-date', 'invalid date', 'synthetic-live', 1)]),
  );
  const { result } = renderHook(() => usePrenatalAntecedents(mother), { wrapper });
  await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
  expect(result.current.data).toEqual([]);
});
