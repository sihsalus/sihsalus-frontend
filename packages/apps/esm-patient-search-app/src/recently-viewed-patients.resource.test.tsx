import { openmrsFetch } from '@openmrs/esm-framework';
import { act, renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { SWRConfig } from 'swr';

import { useRestPatients } from './patient-search.resource';
import { useRecentlyViewedPatients } from './recently-viewed-patients.store';

vi.mock('./recently-viewed-patients.store', () => ({
  useRecentlyViewedPatients: vi.fn(),
}));

const patient = (uuid: string) => ({
  uuid,
  identifiers: [],
  person: { personName: { display: `Synthetic ${uuid}` } },
});
const response = (uuid: string) => ({ data: patient(uuid) }) as Awaited<ReturnType<typeof openmrsFetch>>;
function wrapper({ children }: { children: React.ReactNode }) {
  return (
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
}

beforeEach(() => {
  vi.mocked(useRecentlyViewedPatients).mockReturnValue({
    cacheGeneration: 1,
    recentlyViewedPatientUuids: [],
    recordViewedPatient: vi.fn(),
  });
});

it('loads a newly populated list after an empty first render and respects reorder', async () => {
  vi.mocked(openmrsFetch).mockImplementation(async (url) => response(String(url).includes('/patient/a?') ? 'a' : 'b'));
  const { result, rerender } = renderHook(({ ids }) => useRestPatients(ids), {
    initialProps: { ids: [] as string[] },
    wrapper,
  });
  expect(result.current.data).toEqual([]);
  rerender({ ids: ['a', 'b'] });
  await waitFor(() => expect(result.current.data?.map(({ uuid }) => uuid)).toEqual(['a', 'b']));
  rerender({ ids: ['b', 'a'] });
  await waitFor(() => expect(result.current.data?.map(({ uuid }) => uuid)).toEqual(['b', 'a']));
});

it('does not retain previous results or a late response across session generations', async () => {
  let resolveOldRequest: (value: Awaited<ReturnType<typeof openmrsFetch>>) => void;
  vi.mocked(openmrsFetch).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveOldRequest = resolve;
      }),
  );
  const { result, rerender } = renderHook(({ ids }) => useRestPatients(ids), {
    initialProps: { ids: ['a'] },
    wrapper,
  });
  await waitFor(() => expect(openmrsFetch).toHaveBeenCalledTimes(1));
  vi.mocked(useRecentlyViewedPatients).mockReturnValue({
    cacheGeneration: 2,
    recentlyViewedPatientUuids: [],
    recordViewedPatient: vi.fn(),
  });
  rerender({ ids: [] });
  await act(async () => resolveOldRequest(response('a')));
  expect(result.current.data).toEqual([]);
  vi.mocked(openmrsFetch).mockResolvedValue(response('b'));
  rerender({ ids: ['b'] });
  expect(result.current.data?.some(({ uuid }) => uuid === 'a')).not.toBe(true);
  await waitFor(() => expect(result.current.data).toEqual([patient('b')]));
});

it('refetches the same patient under a new account and hides cached data when access is denied', async () => {
  vi.mocked(openmrsFetch).mockResolvedValue(response('a'));
  const { result, rerender } = renderHook(() => useRestPatients(['a']), {
    wrapper,
  });
  await waitFor(() => expect(result.current.data).toEqual([patient('a')]));
  vi.mocked(openmrsFetch).mockRejectedValue({ response: { status: 403 } });
  vi.mocked(useRecentlyViewedPatients).mockReturnValue({
    cacheGeneration: 2,
    recentlyViewedPatientUuids: [],
    recordViewedPatient: vi.fn(),
  });
  rerender();
  expect(result.current.data).not.toEqual([patient('a')]);
  await waitFor(() => expect(result.current.data).toEqual([]));
});

it.each([401, 500])('surfaces a %s response and hides patient details', async (status) => {
  vi.mocked(openmrsFetch).mockRejectedValue({ response: { status } });
  const { result } = renderHook(() => useRestPatients(['a']), { wrapper });
  await waitFor(() => expect(result.current.fetchError).toEqual({ response: { status } }));
  expect(result.current.data).toEqual([]);
});
