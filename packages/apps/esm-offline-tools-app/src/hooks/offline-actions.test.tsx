import type { SyncItem } from '@openmrs/esm-framework/src/internal';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { SWRConfig } from 'swr';

import { usePendingSyncItems, useSyncItemPatients } from './offline-actions';

const mocks = vi.hoisted(() => ({
  fetchCurrentPatient: vi.fn(),
  getFullSynchronizationItems: vi.fn(),
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
  useSession: () => mocks.session,
}));

vi.mock('@openmrs/esm-framework/src/internal', () => ({
  fetchCurrentPatient: mocks.fetchCurrentPatient,
  getFullSynchronizationItems: mocks.getFullSynchronizationItems,
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
  const config = {
    provider: () => cache,
    dedupingInterval: 0,
    shouldRetryOnError: false,
  };

  return function Wrapper({ children }: PropsWithChildren) {
    return <SWRConfig value={config}>{children}</SWRConfig>;
  };
}

describe('offline action hooks', () => {
  beforeEach(() => {
    mocks.fetchCurrentPatient.mockReset();
    mocks.getFullSynchronizationItems.mockReset();
    mocks.session = {
      authenticated: true,
      sessionId: 'session-a',
      user: { uuid: 'user-a' },
    };
  });

  it('drops the previous owner queue while the next owner read rejects', async () => {
    const userBQueue = createDeferred<Array<never>>();
    mocks.getFullSynchronizationItems.mockImplementation(() =>
      mocks.session.user?.uuid === 'user-a'
        ? Promise.resolve([{ id: 1, descriptor: { patientUuid: 'patient-a' }, type: 'test' }])
        : userBQueue.promise,
    );

    const { result, rerender } = renderHook(
      () => {
        const { data, error } = usePendingSyncItems();
        return { data, error };
      },
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.data?.[0]?.descriptor.patientUuid).toBe('patient-a'));

    act(() => {
      mocks.session = {
        authenticated: true,
        sessionId: 'session-b',
        user: { uuid: 'user-b' },
      };
      rerender();
    });

    expect(result.current.data).toBeUndefined();
    await waitFor(() =>
      expect(mocks.getFullSynchronizationItems.mock.results.some((result) => result.value === userBQueue.promise)).toBe(
        true,
      ),
    );

    const queueError = new Error('Offline queue operation is unavailable.');
    await act(async () => userBQueue.reject(queueError));

    await waitFor(() => expect(result.current.error).toBe(queueError));
    expect(result.current.data).toBeUndefined();
  });

  it('drops previous-owner patient hydration while the next owner read rejects', async () => {
    const userBPatient = createDeferred<fhir.Patient | null>();
    const syncItems = [
      {
        content: {},
        createdOn: new Date('2026-08-20T10:00:00-05:00'),
        descriptor: { patientUuid: 'patient-a' },
        type: 'test',
        userId: 'user-a',
      },
    ] satisfies Array<SyncItem>;
    mocks.fetchCurrentPatient.mockImplementation(() =>
      mocks.session.user?.uuid === 'user-a'
        ? Promise.resolve({ id: 'patient-a', name: [{ text: 'Synthetic A' }] })
        : userBPatient.promise,
    );

    const { result, rerender } = renderHook(
      () => {
        const { data, error } = useSyncItemPatients(syncItems);
        return { data, error };
      },
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.data?.[0]?.id).toBe('patient-a'));

    act(() => {
      mocks.session = {
        authenticated: true,
        sessionId: 'session-b',
        user: { uuid: 'user-b' },
      };
      rerender();
    });

    expect(result.current.data).toBeUndefined();
    await waitFor(() =>
      expect(mocks.fetchCurrentPatient.mock.results.some((result) => result.value === userBPatient.promise)).toBe(true),
    );

    const patientError = new Error('Patient hydration is unavailable.');
    await act(async () => userBPatient.reject(patientError));

    await waitFor(() => expect(result.current.error).toBe(patientError));
    expect(result.current.data).toBeUndefined();
  });

  it('does not read owner data while the session is unauthenticated', () => {
    mocks.session = { authenticated: false, sessionId: '' };

    const { result } = renderHook(
      () => {
        const { data } = usePendingSyncItems();
        return { data };
      },
      { wrapper: createWrapper() },
    );

    expect(result.current.data).toBeUndefined();
    expect(mocks.getFullSynchronizationItems).not.toHaveBeenCalled();
  });
});
