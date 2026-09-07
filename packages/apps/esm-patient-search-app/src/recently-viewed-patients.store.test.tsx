import { createGlobalStore, getSessionStore, openmrsFetch, userHasAccess } from '@openmrs/esm-framework';
import { act, renderHook } from '@testing-library/react';
import { useSyncExternalStore } from 'react';
import { mockSession } from 'test-utils';

import { createRecentlyViewedPatientsStore } from './recently-viewed-patients.store';

type SessionState = ReturnType<ReturnType<typeof getSessionStore>['getState']>;

describe('recent chart session store', () => {
  let sessionStore: ReturnType<typeof getSessionStore>;
  let store: ReturnType<typeof createRecentlyViewedPatientsStore>;

  beforeEach(() => {
    vi.mocked(userHasAccess).mockReturnValue(true);
    sessionStore = createGlobalStore<SessionState>('synthetic-recents-test', {
      loaded: true,
      session: {
        ...mockSession.data,
        authenticated: true,
        sessionId: 'synthetic-session',
      },
    });
    store = createRecentlyViewedPatientsStore(sessionStore);
  });

  afterEach(() => store.dispose());

  const record = (uuid: string) => store.record(uuid, store.getSnapshot().generation);

  it('shares the ten latest chart opens, deduplicates and moves a reopened chart to the front', () => {
    const first = renderHook(() => useSyncExternalStore(store.subscribe, store.getSnapshot));
    const second = renderHook(() => useSyncExternalStore(store.subscribe, store.getSnapshot));

    act(() => {
      for (let index = 0; index < 12; index++) record(`synthetic-patient-${index}`);
      record('synthetic-patient-4');
      record('synthetic-patient-4');
    });

    const expected = [4, 11, 10, 9, 8, 7, 6, 5, 3, 2].map((index) => `synthetic-patient-${index}`);
    expect(first.result.current.patientUuids).toEqual(expected);
    expect(second.result.current.patientUuids).toEqual(expected);
    first.unmount();
    second.unmount();
    expect(store.getSnapshot().patientUuids).toEqual(expected);
    expect(openmrsFetch).not.toHaveBeenCalled();
  });

  it('does not import legacy server history or write to browser storage', () => {
    const storageWrite = vi.spyOn(Storage.prototype, 'setItem');
    expect(store.getSnapshot().patientUuids).toEqual([]);
    record('synthetic-patient-a');
    expect(storageWrite).not.toHaveBeenCalled();
    expect(openmrsFetch).not.toHaveBeenCalled();
    storageWrite.mockRestore();
  });

  it.each(['account', 'session', 'location', 'permissions'] as const)('clears immediately on %s change', (change) => {
    record('synthetic-patient-a');
    const generation = store.getSnapshot().generation;
    const session = {
      ...mockSession.data,
      authenticated: true,
      sessionId: 'synthetic-session',
    };
    if (change === 'account') session.user = { ...session.user, uuid: 'synthetic-user-b' };
    if (change === 'session') session.sessionId = 'synthetic-new-session';
    if (change === 'location')
      session.sessionLocation = {
        ...session.sessionLocation,
        uuid: 'synthetic-location-b',
      };
    if (change === 'permissions') session.user = { ...session.user, roles: [] };
    sessionStore.setState({ loaded: true, session });

    expect(store.getSnapshot().patientUuids).toEqual([]);
    store.record('stale-patient-callback', generation);
    expect(store.getSnapshot().patientUuids).toEqual([]);
  });

  it('clears on logout even with no component mounted and does not restore history on login', () => {
    record('synthetic-patient-a');
    const oldGeneration = store.getSnapshot().generation;
    sessionStore.setState({
      loaded: true,
      session: { authenticated: false, sessionId: '' },
    });
    expect(store.getSnapshot().patientUuids).toEqual([]);
    record('synthetic-patient-after-logout');
    sessionStore.setState({
      loaded: true,
      session: {
        ...mockSession.data,
        authenticated: true,
        sessionId: 'synthetic-session',
      },
    });
    expect(store.getSnapshot().patientUuids).toEqual([]);
    expect(store.getSnapshot().generation).not.toBe(oldGeneration);
  });

  it('fails closed when chart access is revoked or session is loading', () => {
    record('synthetic-patient-a');
    vi.mocked(userHasAccess).mockReturnValue(false);
    sessionStore.setState({ ...sessionStore.getState() });
    record('synthetic-patient-b');
    expect(store.getSnapshot().patientUuids).toEqual([]);
    sessionStore.setState({ loaded: false, session: null });
    record('synthetic-patient-c');
    expect(store.getSnapshot().patientUuids).toEqual([]);
  });
});
