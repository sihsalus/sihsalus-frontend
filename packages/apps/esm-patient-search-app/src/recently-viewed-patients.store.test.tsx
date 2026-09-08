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

  it('records an authenticated REST session without a server sessionId', () => {
    const { session } = sessionStore.getState();
    const restSession = { ...session };
    Reflect.deleteProperty(restSession, 'sessionId');
    sessionStore.setState({ loaded: true, session: restSession });
    record('synthetic-direct-chart');
    expect(store.getSnapshot().patientUuids).toEqual(['synthetic-direct-chart']);
  });

  it('preserves history across equivalent refreshes without a server ID, but not logout and login of the same user', () => {
    const restSession = { ...mockSession.data, authenticated: true };
    Reflect.deleteProperty(restSession, 'sessionId');
    sessionStore.setState({ loaded: true, session: restSession });
    record('synthetic-before-refresh');
    const generation = store.getSnapshot().generation;
    sessionStore.setState({
      loaded: true,
      session: {
        ...restSession,
        user: {
          ...restSession.user,
          roles: [...restSession.user.roles].reverse(),
          privileges: [...restSession.user.privileges].reverse(),
        },
      },
    });
    expect(store.getSnapshot()).toEqual({ generation, patientUuids: ['synthetic-before-refresh'] });

    sessionStore.setState({ loaded: true, session: { authenticated: false, sessionId: '' } });
    expect(store.getSnapshot().patientUuids).toEqual([]);
    sessionStore.setState({ loaded: true, session: restSession });
    store.record('synthetic-stale-before-logout', generation);
    expect(store.getSnapshot().patientUuids).toEqual([]);
    record('synthetic-after-login');
    expect(store.getSnapshot().patientUuids).toEqual(['synthetic-after-login']);
  });

  it.each(['roles', 'privileges'] as const)('fails closed when the REST user has no %s array', (field) => {
    record('synthetic-before-incomplete-session');
    const { session } = sessionStore.getState();
    const user = { ...session.user };
    Reflect.deleteProperty(user, field);
    sessionStore.setState({ loaded: true, session: { ...session, user } });
    record('synthetic-incomplete-session');
    expect(store.getSnapshot().patientUuids).toEqual([]);
  });

  it('does not retain a previous authenticated payload while session loading is false', () => {
    record('synthetic-before-loading');
    const loadingState = { ...sessionStore.getState() };
    // Deliberately model an inconsistent runtime payload outside the typed union.
    Reflect.set(loadingState, 'loaded', false);
    sessionStore.setState(loadingState);
    record('synthetic-during-loading');
    expect(store.getSnapshot().patientUuids).toEqual([]);
  });

  it.each([
    'account',
    'location',
    'permissions',
    'loading',
    'logout',
  ] as const)('clears a session without server ID on observed %s and rejects old callbacks', (change) => {
    const restSession = { ...mockSession.data, authenticated: true };
    Reflect.deleteProperty(restSession, 'sessionId');
    sessionStore.setState({ loaded: true, session: restSession });
    record('synthetic-patient-before-change');
    expect(store.getSnapshot().patientUuids).toEqual(['synthetic-patient-before-change']);
    const oldGeneration = store.getSnapshot().generation;

    if (change === 'loading') sessionStore.setState({ loaded: false, session: null });
    else if (change === 'logout')
      sessionStore.setState({ loaded: true, session: { authenticated: false, sessionId: '' } });
    else {
      const nextSession = { ...restSession };
      if (change === 'account') nextSession.user = { ...restSession.user, uuid: 'synthetic-other-account' };
      if (change === 'location')
        nextSession.sessionLocation = { ...restSession.sessionLocation, uuid: 'synthetic-other-location' };
      if (change === 'permissions') nextSession.user = { ...restSession.user, roles: [] };
      sessionStore.setState({ loaded: true, session: nextSession });
    }
    expect(store.getSnapshot().patientUuids).toEqual([]);
    store.record('synthetic-late-callback', oldGeneration);
    expect(store.getSnapshot().patientUuids).toEqual([]);
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
