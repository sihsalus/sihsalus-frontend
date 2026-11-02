import { openmrsFetch, useConfig } from '@openmrs/esm-framework';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { SWRConfig } from 'swr';

import { useMissedFollowUp } from './missed-follow-up.resource';

const fetchMock = vi.mocked(openmrsFetch);

function isolatedCache() {
  const cache = new Map();
  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <SWRConfig value={{ provider: () => cache, dedupingInterval: 0, shouldRetryOnError: false }}>
        {children}
      </SWRConfig>
    );
  };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.mocked(useConfig).mockReturnValue({ defaulterTracingEncounterUuid: 'synthetic-tracing-type' });
});

it.each([
  { patient: '', type: 'synthetic-tracing-type' },
  { patient: 'synthetic-patient', type: '' },
])('does not query encounters without patient or configured encounter type: %o', async ({ patient, type }) => {
  vi.mocked(useConfig).mockReturnValue({ defaulterTracingEncounterUuid: type });
  const { result } = renderHook(() => useMissedFollowUp(patient), { wrapper: isolatedCache() });
  await act(async () => Promise.resolve());
  expect(fetchMock).not.toHaveBeenCalled();
  expect(result.current.encounters).toEqual([]);
  expect(result.current.isLoading).toBe(false);
});

it('isolates the patient query when moving between charts', async () => {
  const first = { uuid: 'synthetic-encounter-a' };
  const second = { uuid: 'synthetic-encounter-b' };
  fetchMock.mockImplementation(
    async (url) =>
      ({
        data: { results: String(url).includes('patient=patient-b&') ? [second] : [first] },
      }) as never,
  );
  const { result, rerender } = renderHook(({ patient }) => useMissedFollowUp(patient), {
    initialProps: { patient: 'patient-a' },
    wrapper: isolatedCache(),
  });
  await waitFor(() => expect(result.current.encounters).toEqual([first]));
  rerender({ patient: 'patient-b' });
  await waitFor(() => expect(result.current.encounters).toEqual([second]));
  for (const [url] of fetchMock.mock.calls) {
    const query = new URL(String(url), 'https://synthetic.invalid').searchParams;
    expect(query.get('encounterType')).toBe('synthetic-tracing-type');
    expect(['patient-a', 'patient-b']).toContain(query.get('patient'));
  }
});

it('reports a successful empty history separately from a rejected request', async () => {
  fetchMock.mockResolvedValue({ data: { results: [] } } as never);
  const { result } = renderHook(() => useMissedFollowUp('patient-a'), { wrapper: isolatedCache() });
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.encounters).toEqual([]);
  expect(result.current.error).toBeUndefined();
});

it.each([401, 403, 500])('preserves error %s without inventing encounters', async (status) => {
  const error = Object.assign(new Error('Synthetic request failure'), { response: { status } });
  fetchMock.mockRejectedValue(error);
  const { result } = renderHook(() => useMissedFollowUp('patient-a'), { wrapper: isolatedCache() });
  await waitFor(() => expect(result.current.error).toBe(error));
  expect(result.current.isLoading).toBe(false);
  expect(result.current.encounters).toEqual([]);
});
