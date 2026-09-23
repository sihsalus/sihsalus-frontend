import { openmrsFetch, useConfig } from '@openmrs/esm-framework';
import { act, renderHook, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import useEncountersCRED from './useEncountersCRED';

vi.mock('@openmrs/esm-framework', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@openmrs/esm-framework')>()),
  useOpenmrsFetchAll: (await import('../../../../libs/esm-react-utils/src/useOpenmrsFetchAll')).useOpenmrsFetchAll,
}));

type ApiResponse = Awaited<ReturnType<typeof openmrsFetch>>;
const response = (results: unknown[], next?: string) =>
  ({ data: { results, links: next ? [{ rel: 'next', uri: next }] : [] } }) as ApiResponse;
const encounters = [
  { uuid: 'control-one', form: { uuid: 'synthetic-cred-form' } },
  { uuid: 'control-two', form: { uuid: 'synthetic-cred-form' } },
];
const numbers = [
  { uuid: 'number-one', value: 1, encounter: { uuid: 'control-one' } },
  { uuid: 'number-two', value: 2, encounter: { uuid: 'control-two' } },
];
let readNextPage: (resource: string) => Promise<ApiResponse>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useConfig).mockReturnValue({
    formsList: { stimulationFollowupForm: 'synthetic-cred-form' },
    CRED: { controlNumber: 'synthetic-control-number' },
  });
  readNextPage = async (resource) => response(resource === 'encounter' ? encounters.slice(1) : numbers.slice(1));
  vi.mocked(openmrsFetch).mockImplementation(async (input) => {
    const url = new URL(String(input), 'http://localhost');
    const resource = url.pathname.split('/').at(-1);
    if (resource !== 'encounter' && resource !== 'obs') throw new Error('Unexpected synthetic request');
    if (url.searchParams.has('startIndex')) return readNextPage(resource);
    url.searchParams.set('startIndex', '1');
    return response(resource === 'encounter' ? encounters.slice(0, 1) : numbers.slice(0, 1), url.toString());
  });
});

function renderHistory(patientUuid = 'synthetic-child') {
  return renderHook(() => useEncountersCRED(patientUuid), {
    wrapper: ({ children }) => (
      <SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false, dedupingInterval: 0 }}>
        {children}
      </SWRConfig>
    ),
  });
}

it.each(['encounter', 'obs'])('waits for the last %s page before completing the control history', async (pending) => {
  let finish!: (value: ApiResponse) => void;
  const nextPage = new Promise<ApiResponse>((resolve) => {
    finish = resolve;
  });
  const readCompletePage = readNextPage;
  readNextPage = (resource) => (resource === pending ? nextPage : readCompletePage(resource));
  const { result } = renderHistory();
  await waitFor(() => expect(openmrsFetch).toHaveBeenCalledWith(expect.stringContaining('startIndex=1')));
  expect(result.current.isLoading).toBe(true);
  await act(async () => finish(response(pending === 'encounter' ? encounters.slice(1) : numbers.slice(1))));
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.encounters?.map(({ uuid, controlNumber }) => ({ uuid, controlNumber }))).toEqual([
    { uuid: 'control-one', controlNumber: 1 },
    { uuid: 'control-two', controlNumber: 2 },
  ]);
});

it.each(['encounter', 'obs'])('exposes a later %s page failure and recovers on retry', async (failed) => {
  const failure = new Error('Synthetic second-page failure');
  const readCompletePage = readNextPage;
  readNextPage = async (resource) => {
    if (resource === failed) throw failure;
    return readCompletePage(resource);
  };
  const { result } = renderHistory();
  const errorKey = failed === 'encounter' ? 'error' : 'controlNumberError';
  await waitFor(() => expect(result.current[errorKey]).toBe(failure));
  readNextPage = readCompletePage;
  await act(async () => result.current.mutate());
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current[errorKey]).toBeNull();
  expect(result.current.encounters?.map(({ controlNumber }) => controlNumber)).toEqual([1, 2]);
});

it('does not read history without a patient', () => {
  renderHistory('');
  expect(openmrsFetch).not.toHaveBeenCalled();
});
