import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { SWRConfig } from 'swr';

import { processCommunityReferral, pullFacilityReferrals, useCommunityReferrals } from './referrals.resource';

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
});

describe('community referral queries', () => {
  it('keeps loading distinct from a successful empty response', async () => {
    let finish: (value: unknown) => void;
    fetchMock.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }) as never,
    );
    const { result } = renderHook(() => useCommunityReferrals('active'), { wrapper: isolatedCache() });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.referrals).toEqual([]);
    await act(async () => finish({ data: [] }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeUndefined();
    expect(result.current.referrals).toEqual([]);
    expect(fetchMock).toHaveBeenCalledWith(`${restBaseUrl}/kenyaemril/communityReferrals?status=active`);
  });

  it('changes the query and results when the selected referral status changes', async () => {
    const active = { id: 7, uuid: 'synthetic-active', givenName: 'Synthetic active' };
    const completed = { id: 8, uuid: 'synthetic-completed', givenName: 'Synthetic completed' };
    fetchMock.mockImplementation(
      async (url) =>
        ({
          data: String(url).endsWith('status=completed') ? [completed] : [active],
        }) as never,
    );
    const { result, rerender } = renderHook(({ status }) => useCommunityReferrals(status), {
      initialProps: { status: 'active' },
      wrapper: isolatedCache(),
    });
    await waitFor(() => expect(result.current.referrals).toEqual([active]));
    rerender({ status: 'completed' });
    await waitFor(() => expect(result.current.referrals).toEqual([completed]));
    expect(fetchMock).toHaveBeenCalledWith(`${restBaseUrl}/kenyaemril/communityReferrals?status=completed`);
  });

  it.each([401, 403, 500])('preserves a failed %s response for the caller', async (status) => {
    const error = Object.assign(new Error('Synthetic request failure'), { response: { status } });
    fetchMock.mockRejectedValue(error);
    const { result } = renderHook(() => useCommunityReferrals('active'), { wrapper: isolatedCache() });
    await waitFor(() => expect(result.current.error).toBe(error));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.referrals).toEqual([]);
  });
});

describe('referral actions at the API boundary', () => {
  it('sends the selected message id and returns the registered patient identity', async () => {
    fetchMock.mockResolvedValue({ data: { uuid: 'synthetic-patient' } } as never);
    await expect(processCommunityReferral(27)).resolves.toMatchObject({ data: { uuid: 'synthetic-patient' } });
    expect(fetchMock).toHaveBeenCalledWith(`${restBaseUrl}/kenyaemril/serveReferredClient`, {
      method: 'POST',
      body: { referralMessageId: 27 },
      headers: { 'Content-Type': 'application/json' },
    });
  });

  it('does not turn a failed facility synchronization into success', async () => {
    const error = new Error('Synthetic unavailable interoperability backend');
    fetchMock.mockRejectedValue(error);
    await expect(pullFacilityReferrals()).rejects.toBe(error);
    expect(fetchMock).toHaveBeenCalledWith(`${restBaseUrl}/kenyaemril/pullShrReferrals`, {
      headers: { 'Content-Type': 'application/json' },
    });
  });
});
