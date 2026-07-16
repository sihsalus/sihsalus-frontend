import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { SWRConfig } from 'swr';

import { useAppointmentMetrics } from './queue-metrics.resource';

const mockGetStartOfDay = vi.hoisted(() => vi.fn());

vi.mock('../constants', async () => ({
  ...(await vi.importActual('../constants')),
  getStartOfDay: mockGetStartOfDay,
}));

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SWRConfig
    value={{
      dedupingInterval: 0,
      provider: () => new Map(),
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    }}
  >
    {children}
  </SWRConfig>
);

describe('useAppointmentMetrics', () => {
  let currentStartOfDay: string;

  beforeEach(() => {
    currentStartOfDay = '2026-07-14T05:00:00.000Z';
    mockGetStartOfDay.mockImplementation(() => currentStartOfDay);
    mockOpenmrsFetch.mockReset();
    mockOpenmrsFetch.mockResolvedValue({ data: [] } as never);
  });

  it('refreshes the appointment count query with the new local date after midnight', async () => {
    const { rerender } = renderHook(() => useAppointmentMetrics(), { wrapper });

    await waitFor(() => expect(mockOpenmrsFetch).toHaveBeenCalledTimes(1));
    expect(mockOpenmrsFetch).toHaveBeenNthCalledWith(
      1,
      `${restBaseUrl}/appointment/all?forDate=2026-07-14T05:00:00.000Z`,
    );

    currentStartOfDay = '2026-07-15T05:00:00.000Z';
    rerender();

    await waitFor(() => expect(mockOpenmrsFetch).toHaveBeenCalledTimes(2));
    expect(mockOpenmrsFetch).toHaveBeenNthCalledWith(
      2,
      `${restBaseUrl}/appointment/all?forDate=2026-07-15T05:00:00.000Z`,
    );
  });
});
