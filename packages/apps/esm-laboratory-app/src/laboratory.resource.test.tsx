import { act, renderHook, waitFor } from '@testing-library/react';
import useSWR, { mutate } from 'swr';
import { describe, expect, it, vi } from 'vitest';
import { useInvalidateLabOrders } from './laboratory.resource';

vi.mock('@openmrs/esm-framework', () => ({
  restBaseUrl: '/test/rest/v1',
  useConfig: () => ({ laboratoryOrderTypeUuid: 'lab-type' }),
  openmrsFetch: vi.fn(),
}));

describe('laboratory cache refresh', () => {
  it('keeps existing rows visible until the replacement response arrives', async () => {
    const key = '/test/rest/v1/order?orderTypes=lab-type&test=preserve-rows';
    await mutate(key, ['existing-order'], { revalidate: false });
    let finish: (value: string[]) => void;
    const fetcher = vi.fn(
      () =>
        new Promise<string[]>((resolve) => {
          finish = resolve;
        }),
    );
    const { result, unmount } = renderHook(() => ({
      orders: useSWR(key, fetcher, { revalidateOnMount: false }),
      refresh: useInvalidateLabOrders(),
    }));
    let refreshed: Promise<unknown>;
    act(() => {
      refreshed = result.current.refresh();
    });
    await waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
    expect(result.current.orders.data).toEqual(['existing-order']);
    expect(result.current.orders.isLoading).toBe(false);

    await act(async () => {
      finish(['updated-order']);
      await refreshed;
    });
    expect(result.current.orders.data).toEqual(['updated-order']);
    unmount();
    await mutate(key, undefined, { revalidate: false });
  });
});
