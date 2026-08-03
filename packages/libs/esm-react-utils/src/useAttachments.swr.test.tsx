import { act, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAttachments } from './useAttachments';

const mocks = vi.hoisted(() => ({
  openmrsFetch: vi.fn(),
}));

vi.mock('@openmrs/esm-api', () => ({
  openmrsFetch: mocks.openmrsFetch,
}));

vi.mock('@openmrs/esm-emr-api', () => ({
  attachmentUrl: '/ws/rest/v1/attachment',
}));

function createAttachment(uuid: string) {
  return {
    bytesContentFamily: 'IMAGE',
    bytesMimeType: 'image/png',
    comment: 'Clinical image',
    dateTime: '2026-08-03T12:00:00.000Z',
    filename: `${uuid}.png`,
    uuid,
  };
}

function createWrapper() {
  const cache = new Map();

  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <SWRConfig
        value={{
          dedupingInterval: 0,
          errorRetryCount: 3,
          errorRetryInterval: 1,
          provider: () => cache,
          // Production retries authorization failures unless a hook overrides this policy.
          shouldRetryOnError: () => true,
        }}
      >
        {children}
      </SWRConfig>
    );
  };
}

describe('useAttachments with SWR', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not expose one user cache while the same patient loads for another user', async () => {
    const userAAttachment = createAttachment('user-a-attachment');
    const userBAttachment = createAttachment('user-b-attachment');
    let resolveUserBRequest: (value: unknown) => void = () => {};

    mocks.openmrsFetch.mockResolvedValueOnce({ data: { results: [userAAttachment] } }).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveUserBRequest = resolve;
        }),
    );

    const { result, rerender } = renderHook(
      ({ cacheScope }) => useAttachments('patient-uuid', true, true, cacheScope),
      {
        initialProps: { cacheScope: 'user-a-uuid' },
        wrapper: createWrapper(),
      },
    );

    await waitFor(() => expect(result.current.data).toEqual([userAAttachment]));

    rerender({ cacheScope: 'user-b-uuid' });

    expect(result.current.data).toEqual([]);

    await act(async () => {
      resolveUserBRequest({ data: { results: [userBAttachment] } });
    });
    await waitFor(() => expect(result.current.data).toEqual([userBAttachment]));

    expect(mocks.openmrsFetch).toHaveBeenCalledWith(expect.stringContaining('patient=patient-uuid'), {
      rejectOnAuthFailure: true,
    });
  });

  it.each([401, 403])('keeps cached data hidden after an HTTP %s revalidation failure', async (status) => {
    const cachedAttachment = createAttachment('private-attachment');
    const authorizationError = Object.assign(new Error(`HTTP ${status}`), { response: { status } });
    mocks.openmrsFetch
      .mockResolvedValueOnce({ data: { results: [cachedAttachment] } })
      .mockRejectedValueOnce(authorizationError);

    const { result, rerender } = renderHook(() => useAttachments('patient-uuid', true, true, 'user-uuid'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.data).toEqual([cachedAttachment]));

    await act(async () => {
      await result.current.mutate().catch(() => undefined);
    });
    await waitFor(() => expect(result.current.error).toBe(authorizationError));

    expect(result.current.data).toEqual([]);

    rerender();

    expect(result.current.data).toEqual([]);
    expect(result.current.error).toBe(authorizationError);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(mocks.openmrsFetch).toHaveBeenCalledTimes(2);
  });
});
