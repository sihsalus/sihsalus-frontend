import { getDefaultsFromConfigSchema, getSessionStore, openmrsFetch, useConfig } from '@openmrs/esm-framework';
import { act, render, renderHook } from '@testing-library/react';
import { mockSession } from 'test-utils';

import { configSchema } from './config-schema';
import RecentlyViewedPatientTracker from './recently-viewed-patient-tracker.component';
import { useRecentlyViewedPatients } from './recently-viewed-patients.store';

const patientUuid = 'synthetic-chart-patient';
const patient: fhir.Patient = { resourceType: 'Patient', id: patientUuid };
const sessionStore = getSessionStore();
const chartPrivileges = [
  { uuid: 'synthetic-chart-privilege', name: 'app:hoja.clinica', display: 'app:hoja.clinica', links: [] },
];

beforeEach(() => {
  sessionStore.setState({ loaded: false, session: null });
  sessionStore.setState({
    loaded: true,
    session: {
      ...mockSession.data,
      authenticated: true,
      sessionId: 'synthetic-chart-session',
      user: { ...mockSession.data.user, privileges: chartPrivileges, roles: [] },
    },
  });
  vi.mocked(useConfig).mockReturnValue(getDefaultsFromConfigSchema(configSchema));
});

afterEach(() => {
  act(() => sessionStore.setState({ loaded: false, session: null }));
});

// Compose the real tracker with the real session-scoped history hook. Contextual
// headers (including the appointment form) supply these patient props without a
// chart-open marker; loading a patient is not itself an opening of their chart.
it.each([undefined, false])('does not record a contextual patient header, isPatientChart=%s', (isPatientChart) => {
  const history = renderHook(() => useRecentlyViewedPatients(true));
  const headerState = { patient, patientUuid, hideActionsOverflow: true, isPatientChart };
  render(<RecentlyViewedPatientTracker {...headerState} />);

  expect(history.result.current.recentlyViewedPatientUuids).toEqual([]);
  expect(openmrsFetch).not.toHaveBeenCalled();
});

it.each([true, false])('records an explicit chart opening only with chart access, allowed=%s', (allowed) => {
  const currentState = sessionStore.getState();
  if (!currentState.loaded) throw new Error('Synthetic session must be loaded');
  sessionStore.setState({
    loaded: true,
    session: {
      ...currentState.session,
      user: {
        ...currentState.session.user,
        privileges: allowed ? chartPrivileges : [],
        roles: [],
      },
    },
  });
  const history = renderHook(() => useRecentlyViewedPatients(true));
  const headerState = { patient, patientUuid, isPatientChart: true };
  render(<RecentlyViewedPatientTracker {...headerState} />);

  expect(history.result.current.recentlyViewedPatientUuids).toEqual(allowed ? [patientUuid] : []);
  expect(openmrsFetch).not.toHaveBeenCalled();
});

it('keeps a marked chart out of recent history while its FHIR patient is missing or mismatched', () => {
  const history = renderHook(() => useRecentlyViewedPatients(true));
  const headerState = { patientUuid, isPatientChart: true };
  const { rerender } = render(<RecentlyViewedPatientTracker {...headerState} />);
  expect(history.result.current.recentlyViewedPatientUuids).toEqual([]);

  rerender(<RecentlyViewedPatientTracker {...headerState} patient={{ ...patient, id: 'synthetic-other-patient' }} />);
  expect(history.result.current.recentlyViewedPatientUuids).toEqual([]);

  rerender(<RecentlyViewedPatientTracker {...headerState} patient={patient} />);
  expect(history.result.current.recentlyViewedPatientUuids).toEqual([patientUuid]);
});
