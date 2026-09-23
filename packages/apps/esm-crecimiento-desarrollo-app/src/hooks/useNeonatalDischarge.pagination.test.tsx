import { openmrsFetch, useConfig } from '@openmrs/esm-framework';
import { act, renderHook, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { configSchema } from '../config-schema';
import { useNeonatalDischarge } from './useNeonatalDischarge';

vi.mock('@openmrs/esm-framework', async (original) => ({
  ...(await original<typeof import('@openmrs/esm-framework')>()),
  useOpenmrsFetchAll: (await import('../../../../libs/esm-react-utils/src/useOpenmrsFetchAll')).useOpenmrsFetchAll,
}));

type ApiResponse = Awaited<ReturnType<typeof openmrsFetch>>;
const response = (results: unknown[], next?: string) =>
  ({ data: { results, links: next ? [{ rel: 'next', uri: next }] : [] } }) as ApiResponse;
const config = configSchema.neonatalConcepts._default;
const now = new Date();
const birth = new Date(now.getTime() - 5 * 86400000).toISOString();
const discharge = new Date(now.getTime() - 3 * 86400000).toISOString();
const pregnancy = {
  uuid: 'synthetic-setting',
  encounterDatetime: birth,
  form: { uuid: 'synthetic-pregnancy', name: configSchema.formsList._default.pregnancyDetails },
  obs: [{ concept: { uuid: config.birthPlaceUuid }, value: { uuid: config.deliveryRoomPlaceUuid } }],
};
const born = {
  uuid: 'synthetic-birth',
  encounterDatetime: discharge,
  form: { uuid: 'synthetic-birth-form', name: configSchema.formsList._default.birthDetails },
  obs: [{ concept: { uuid: config.dischargeDateTimeUuid }, value: discharge }],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useConfig).mockReturnValue({});
});
const renderContext = (enabled = true) =>
  renderHook(() => useNeonatalDischarge('synthetic-child', birth, enabled), {
    wrapper: ({ children }) => (
      <SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false, dedupingInterval: 0 }}>
        {children}
      </SWRConfig>
    ),
  });

it('waits for the page containing birth discharge before resolving the minimum', async () => {
  let finish!: (value: ApiResponse) => void;
  const pending = new Promise<ApiResponse>((resolve) => {
    finish = resolve;
  });
  vi.mocked(openmrsFetch).mockImplementation(async (url) =>
    String(url).includes('startIndex=1')
      ? pending
      : response([pregnancy], 'https://example.test/openmrs/ws/rest/v1/encounter?startIndex=1'),
  );
  const { result } = renderContext();
  await waitFor(() =>
    expect(vi.mocked(openmrsFetch).mock.calls.some(([url]) => String(url).includes('startIndex=1'))).toBe(true),
  );
  expect(result.current.isLoading).toBe(true);
  expect(result.current.dischargeDate).toBeUndefined();
  await act(async () => finish(response([born])));
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.dischargeDate).toEqual(new Date(discharge));
  expect(result.current.missingDischarge).toBe(false);
});

it('exposes a later page failure and recovers after retry', async () => {
  const failure = new Error('Synthetic page failure');
  let failed = true;
  vi.mocked(openmrsFetch).mockImplementation(async (url) => {
    if (String(url).includes('startIndex=1')) {
      if (failed) throw failure;
      return response([born]);
    }
    return response([pregnancy], 'https://example.test/openmrs/ws/rest/v1/encounter?startIndex=1');
  });
  const { result } = renderContext();
  await waitFor(() => expect(result.current.error).toBe(failure));
  expect(result.current.dischargeDate).toBeUndefined();
  failed = false;
  await act(async () => {
    await result.current.mutate();
  });
  await waitFor(() => expect(result.current.dischargeDate).toEqual(new Date(discharge)));
  expect(result.current.error).toBeUndefined();
});

it('does not request birth context when resuming an existing control', () => {
  const { result } = renderContext(false);
  expect(openmrsFetch).not.toHaveBeenCalled();
  expect(result.current.isLoading).toBe(false);
  expect(result.current.missingDischarge).toBe(false);
});
