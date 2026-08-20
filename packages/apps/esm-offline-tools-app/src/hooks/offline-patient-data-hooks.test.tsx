import { act, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { SWRConfig } from 'swr';

import { useLastSyncStateOfPatient, useOfflinePatientsWithEntries } from './offline-patient-data-hooks';

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
});
