import { getDefaultsFromConfigSchema, getSessionStore, openmrsFetch, useConfig } from '@openmrs/esm-framework';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { mockSession } from 'test-utils';

import { configSchema } from './config-schema';
import RecentlyViewedPatientTracker from './recently-viewed-patient-tracker.component';
import { useRecentlyViewedPatients } from './recently-viewed-patients.store';

const sessionStore = getSessionStore();
const patientA = 'synthetic-patient-a';
const patientB = 'synthetic-patient-b';

function NavigationProbe() {
  const navigate = useNavigate();
  const { recentlyViewedPatientUuids } = useRecentlyViewedPatients(true);
  return (
    <>
      <Link to={`/patient/${patientB}/chart/Patient Summary`}>Open chart from a queue</Link>
      <Link to="/home">Home</Link>
      <Link to={`/appointments/${patientB}`}>Select patient for an appointment</Link>
      <button type="button" onClick={() => navigate(-1)}>
        Back
      </button>
      <button type="button" onClick={() => navigate(1)}>
        Forward
      </button>
      <output data-testid="recent-chart-ids">{recentlyViewedPatientUuids.join(',')}</output>
    </>
  );
}

// The synthetic route supplies the chart's loaded-FHIR slot contract. Router,
// tracker, session subscription and history are not mocked. The framework's
// session/privilege fixtures contain only synthetic accounts.
// The production chart's producer contract is covered in its own package.
function LoadedPatientHeader({ isPatientChart }: { isPatientChart?: boolean }) {
  const { patientUuid } = useParams();
  return (
    <RecentlyViewedPatientTracker
      patientUuid={patientUuid}
      patient={{ resourceType: 'Patient', id: patientUuid }}
      isPatientChart={isPatientChart}
    />
  );
}

function renderNavigation() {
  return render(
    <MemoryRouter initialEntries={[`/patient/${patientA}/chart/Patient Summary`]}>
      <NavigationProbe />
      <Routes>
        <Route path="patient/:patientUuid/chart/*" element={<LoadedPatientHeader isPatientChart />} />
        <Route path="appointments/:patientUuid" element={<LoadedPatientHeader />} />
        <Route path="home" element={<div>Home page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  sessionStore.setState({ loaded: false, session: null });
  const restSession = {
    ...mockSession.data,
    authenticated: true,
    user: {
      ...mockSession.data.user,
      roles: [],
      privileges: [
        { uuid: 'synthetic-chart-access', name: 'app:hoja.clinica', display: 'app:hoja.clinica', links: [] },
      ],
    },
  };
  Reflect.deleteProperty(restSession, 'sessionId');
  sessionStore.setState({ loaded: true, session: restSession });
  vi.mocked(useConfig).mockReturnValue(getDefaultsFromConfigSchema(configSchema));
});

afterEach(() => act(() => sessionStore.setState({ loaded: false, session: null })));

it('records direct chart navigation without search and reorders on browser back and forward', async () => {
  const storageWrite = vi.spyOn(Storage.prototype, 'setItem');
  const user = userEvent.setup();
  renderNavigation();
  expect(screen.getByTestId('recent-chart-ids')).toHaveTextContent(patientA);
  await user.click(screen.getByRole('link', { name: 'Open chart from a queue' }));
  expect(screen.getByTestId('recent-chart-ids')).toHaveTextContent(`${patientB},${patientA}`);
  await user.click(screen.getByRole('button', { name: 'Back' }));
  expect(screen.getByTestId('recent-chart-ids')).toHaveTextContent(`${patientA},${patientB}`);
  await user.click(screen.getByRole('button', { name: 'Forward' }));
  expect(screen.getByTestId('recent-chart-ids')).toHaveTextContent(`${patientB},${patientA}`);
  expect(openmrsFetch).not.toHaveBeenCalled();
  expect(storageWrite).not.toHaveBeenCalled();
  storageWrite.mockRestore();
});

it('does not treat contextual patient selection as a chart opening', async () => {
  const user = userEvent.setup();
  renderNavigation();
  await user.click(screen.getByRole('link', { name: 'Select patient for an appointment' }));
  expect(screen.getByTestId('recent-chart-ids')).toHaveTextContent(patientA);
  expect(screen.getByTestId('recent-chart-ids')).not.toHaveTextContent(patientB);
});

it('denies recording when direct navigation has no chart privilege', () => {
  const { session } = sessionStore.getState();
  sessionStore.setState({ loaded: true, session: { ...session, user: { ...session.user, privileges: [] } } });
  renderNavigation();
  expect(screen.getByTestId('recent-chart-ids')).toBeEmptyDOMElement();
});

it('clears history on logout after leaving the chart, without restoring it for the next account', async () => {
  const user = userEvent.setup();
  renderNavigation();
  await user.click(screen.getByRole('link', { name: 'Home' }));
  const { session } = sessionStore.getState();
  act(() => sessionStore.setState({ loaded: true, session: { authenticated: false, sessionId: '' } }));
  expect(screen.getByTestId('recent-chart-ids')).toBeEmptyDOMElement();
  act(() =>
    sessionStore.setState({
      loaded: true,
      session: {
        ...session,
        sessionId: 'synthetic-second-session',
        user: { ...session.user, uuid: 'synthetic-second-user' },
      },
    }),
  );
  expect(screen.getByTestId('recent-chart-ids')).toBeEmptyDOMElement();
});
