import { getSessionStore, openmrsFetch } from '@openmrs/esm-framework';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SWRConfig } from 'swr';
import { mockSession } from 'test-utils';

import { patientChartPrivilege } from './patient-chart-access';
import { useRestPatients } from './patient-search.resource';
import { useRecentlyViewedPatients } from './recently-viewed-patients.store';

const sessionStore = getSessionStore();
const patient = (uuid: string) => ({
  uuid,
  identifiers: [],
  person: { personName: { display: `Synthetic ${uuid}` } },
});
const response = (uuid: string) => ({ data: patient(uuid) }) as Awaited<ReturnType<typeof openmrsFetch>>;

function wrapper({ children }: { children: ReactNode }) {
  return (
    <SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false, dedupingInterval: 0 }}>
      {children}
    </SWRConfig>
  );
}

beforeEach(() => {
  sessionStore.setState({ loaded: false, session: null });
  const session = {
    ...mockSession.data,
    authenticated: true,
    user: {
      ...mockSession.data.user,
      uuid: 'synthetic-recents-reader',
      roles: [],
      privileges: [{ uuid: 'synthetic-chart-access', name: patientChartPrivilege, display: patientChartPrivilege }],
    },
  };
  Reflect.deleteProperty(session, 'sessionId');
  sessionStore.setState({ loaded: true, session });
});

afterEach(() => act(() => sessionStore.setState({ loaded: false, session: null })));

function startBatch() {
  const recorder = renderHook(() => useRecentlyViewedPatients(true));
  act(() => {
    recorder.result.current.recordViewedPatient('b');
    recorder.result.current.recordViewedPatient('a');
  });
  recorder.unmount();
  return renderHook(
    () => {
      const history = useRecentlyViewedPatients(true);
      return { ...useRestPatients(history.recentlyViewedPatientUuids), record: history.recordViewedPatient };
    },
    { wrapper },
  );
}

it.each([
  'logout',
  'account',
  'location',
  'privileges',
  'loading',
] as const)('does not start another patient read from an old batch after %s', async (change) => {
  let finishFirst: (value: Awaited<ReturnType<typeof openmrsFetch>>) => void;
  vi.mocked(openmrsFetch).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishFirst = resolve;
      }),
  );
  vi.mocked(openmrsFetch).mockResolvedValue(response('b'));
  const { result } = startBatch();
  await waitFor(() => expect(openmrsFetch).toHaveBeenCalledTimes(1));

  const { session } = sessionStore.getState();
  act(() => {
    if (change === 'logout') sessionStore.setState({ loaded: true, session: { authenticated: false, sessionId: '' } });
    else if (change === 'loading') sessionStore.setState({ loaded: false, session: null });
    else {
      const nextSession = { ...session };
      if (change === 'account') nextSession.user = { ...session.user, uuid: 'synthetic-other-reader' };
      if (change === 'location')
        nextSession.sessionLocation = { ...session.sessionLocation, uuid: 'synthetic-other-location' };
      if (change === 'privileges') nextSession.user = { ...session.user, privileges: [] };
      sessionStore.setState({ loaded: true, session: nextSession });
    }
  });
  await act(async () => {
    finishFirst(response('a'));
  });

  expect(openmrsFetch).toHaveBeenCalledTimes(1);
  expect(result.current.data).toEqual([]);
  if (change === 'account') {
    act(() => result.current.record('b'));
    await waitFor(() => expect(result.current.data).toEqual([patient('b')]));
    expect(openmrsFetch).toHaveBeenCalledTimes(2);
  }
});

it('stops the old batch after logout even when the reader already unmounted', async () => {
  let finishFirst: (value: Awaited<ReturnType<typeof openmrsFetch>>) => void;
  vi.mocked(openmrsFetch).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishFirst = resolve;
      }),
  );
  vi.mocked(openmrsFetch).mockResolvedValue(response('b'));
  const view = startBatch();
  await waitFor(() => expect(openmrsFetch).toHaveBeenCalledTimes(1));
  view.unmount();
  act(() => sessionStore.setState({ loaded: true, session: { authenticated: false, sessionId: '' } }));
  await act(async () => {
    finishFirst(response('a'));
  });
  expect(openmrsFetch).toHaveBeenCalledTimes(1);
});
