import { act, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { SWRConfig, type SWRResponse } from 'swr';

import { useLastSyncStateOfPatient, useMergedSwr, useOfflinePatientsWithEntries } from './offline-patient-data-hooks';

const mocks = vi.hoisted(() => ({
  fetchCurrentPatient: vi.fn(),
  getDynamicOfflineDataEntries: vi.fn(),
  getSynchronizationItems: vi.fn(),
  session: {
    authenticated: true,
    sessionId: 'session-a',
    user: { uuid: 'user-a' },
  } as {
    authenticated: boolean;
    sessionId: string;
    user?: { uuid: string };
  },
}));

vi.mock('@openmrs/esm-framework', () => ({
  fetchCurrentPatient: mocks.fetchCurrentPatient,
  getDynamicOfflineDataEntries: mocks.getDynamicOfflineDataEntries,
  getSynchronizationItems: mocks.getSynchronizationItems,
  useSession: () => mocks.session,
}));

function createDeferred<T>() {
  let reject = (_error: Error) => {};
  let resolve = (_value: T) => {};
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
}

function createWrapper() {
  const cache = new Map();
  const config = { provider: () => cache, dedupingInterval: 0 };

  return function Wrapper({ children }: PropsWithChildren) {
    return <SWRConfig value={config}>{children}</SWRConfig>;
  };
}

describe('offline patient data hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session = {
      authenticated: true,
      sessionId: 'session-a',
      user: { uuid: 'user-a' },
    };
  });

  it('drops the previous owner patient data and exposes the next owner read error', async () => {
    const userBDynamicData = createDeferred<Array<never>>();
    const userBQueue = createDeferred<Array<never>>();
    const lastSyncState = {
      syncedOn: new Date('2026-08-20T10:00:00-05:00'),
      syncedBy: 'user-a',
      succeededHandlers: ['synthetic-handler'],
      erroredHandlers: [],
      errors: [],
    };
    mocks.getDynamicOfflineDataEntries.mockImplementation(() =>
      mocks.session.user?.uuid === 'user-a'
        ? Promise.resolve([{ identifier: 'patient-a', syncState: lastSyncState }])
        : userBDynamicData.promise,
    );
    mocks.getSynchronizationItems.mockImplementation(() =>
      mocks.session.user?.uuid === 'user-a' ? Promise.resolve([]) : userBQueue.promise,
    );
    mocks.fetchCurrentPatient.mockResolvedValue({
      id: 'patient-a',
      name: [{ text: 'Synthetic A' }],
    });

    const { result, rerender } = renderHook(
      () => {
        const lastSyncResponse = useLastSyncStateOfPatient('patient-a');
        return {
          lastSync: {
            data: lastSyncResponse.data,
            error: lastSyncResponse.error,
          },
          patients: useOfflinePatientsWithEntries(),
        };
      },
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.patients.data?.[0]?.patient.id).toBe('patient-a'));
    await waitFor(() => expect(result.current.lastSync.data).toBe(lastSyncState));

    act(() => {
      mocks.session = {
        authenticated: true,
        sessionId: 'session-b',
        user: { uuid: 'user-b' },
      };
      rerender();
    });

    expect(result.current.patients.data).toBeNull();
    expect(result.current.lastSync.data).toBeUndefined();

    const dynamicError = new Error('Offline patient storage is unavailable.');
    const queueError = new Error('Offline queue operation is unavailable.');
    await act(async () => {
      userBDynamicData.reject(dynamicError);
      userBQueue.reject(queueError);
    });

    await waitFor(() => expect(result.current.patients.error).toBe(dynamicError));
    await waitFor(() => expect(result.current.lastSync.error).toBe(dynamicError));
    expect(result.current.patients.data).toBeNull();
    expect(result.current.lastSync.data).toBeUndefined();
  });

  it('waits for every merged refresh and rejects with one fixed error after a child fails', async () => {
    const pendingRefresh = createDeferred<undefined>();
    const sensitiveRefreshError =
      'IndexedDB refresh failed for patient 00000000-0000-0000-0000-000000000001 at https://clinical.example.test';
    const rejectedMutate = vi.fn().mockRejectedValue(new Error(sensitiveRefreshError));
    const pendingMutate = vi.fn(() => pendingRefresh.promise);
    const mergeResponses = vi.fn(() => []);
    const swrResponses = [
      {
        data: [],
        error: undefined,
        isLoading: false,
        isValidating: false,
        mutate: rejectedMutate,
      },
      {
        data: [],
        error: undefined,
        isLoading: false,
        isValidating: false,
        mutate: pendingMutate,
      },
    ] as unknown as Array<SWRResponse>;
    const { result } = renderHook(() => useMergedSwr(mergeResponses, swrResponses));
    mergeResponses.mockClear();

    let refreshSettled = false;
    let refreshOutcome!: Promise<
      | { status: 'fulfilled'; value: unknown }
      | { status: 'rejected'; error: unknown }
    >;
    await act(async () => {
      refreshOutcome = result.current.mutate().then(
        (value) => {
          refreshSettled = true;
          return { status: 'fulfilled' as const, value };
        },
        (error) => {
          refreshSettled = true;
          return { status: 'rejected' as const, error };
        },
      );
      await Promise.resolve();
    });

    await waitFor(() => expect(rejectedMutate).toHaveBeenCalledTimes(1));
    expect(pendingMutate).toHaveBeenCalledTimes(1);
    expect(refreshSettled).toBe(false);
    expect(mergeResponses).not.toHaveBeenCalled();

    await act(async () => {
      pendingRefresh.resolve(undefined);
      await Promise.resolve();
    });

    const outcome = await refreshOutcome;
    expect(outcome.status).toBe('rejected');
    if (outcome.status === 'rejected') {
      expect(outcome.error).toEqual(new Error('Offline patient data could not be refreshed.'));
      expect(String(outcome.error)).not.toContain(sensitiveRefreshError);
    }
  });

  it('waits for every successful refresh without invoking the merge outside render', async () => {
    const pendingRefresh = createDeferred<undefined>();
    const immediateMutate = vi.fn().mockResolvedValue(undefined);
    const pendingMutate = vi.fn(() => pendingRefresh.promise);
    const sensitiveMergeError =
      'Merge failed for patient 00000000-0000-0000-0000-000000000001 at https://clinical.example.test';
    const mergeResponses = vi.fn(() => {
      throw new Error(sensitiveMergeError);
    });
    const swrResponses = [
      {
        data: undefined,
        error: undefined,
        isLoading: false,
        isValidating: false,
        mutate: immediateMutate,
      },
      {
        data: undefined,
        error: undefined,
        isLoading: false,
        isValidating: false,
        mutate: pendingMutate,
      },
    ] as unknown as Array<SWRResponse>;
    const { result } = renderHook(() => useMergedSwr(mergeResponses, swrResponses));

    let refreshSettled = false;
    const refreshOutcome = result.current.mutate().finally(() => {
      refreshSettled = true;
    });

    await waitFor(() => expect(immediateMutate).toHaveBeenCalledTimes(1));
    expect(pendingMutate).toHaveBeenCalledTimes(1);
    expect(refreshSettled).toBe(false);
    expect(mergeResponses).not.toHaveBeenCalled();

    pendingRefresh.resolve(undefined);

    await expect(refreshOutcome).resolves.toBeUndefined();
    expect(mergeResponses).not.toHaveBeenCalled();
  });
});
