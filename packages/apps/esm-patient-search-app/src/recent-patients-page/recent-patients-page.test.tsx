import {
  getDefaultsFromConfigSchema,
  getSessionStore,
  openmrsFetch,
  useConfig,
  useLayoutType,
  useSession,
} from '@openmrs/esm-framework';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { navigateToUrl } from 'single-spa';
import { SWRConfig } from 'swr';
import { mockSession } from 'test-utils';

import { configSchema } from '../config-schema';
import { patientChartPrivilege } from '../patient-chart-access';
import { recentPatientsRoute } from '../patient-search-constants';
import { PatientSearchContext } from '../patient-search-context';
import { useRestPatients } from '../patient-search.resource';
import { useRecentlyViewedPatients } from '../recently-viewed-patients.store';
import Root from '../root.component';
import routes from '../routes.json';
import type { SearchedPatient } from '../types';

const access = vi.hoisted(() => ({ denied: '' }));

// Exercise the real router, recent store, resource hook and links, with only
// synthetic privilege decisions and HTTP responses at the framework boundary.
vi.mock('@sihsalus/esm-rbac', () => ({
  AppErrorBoundary: ({ children }: { children: ReactNode }) => <>{children}</>,
  RequirePrivilege: ({ privilege, children }: { privilege: string; children: ReactNode }) =>
    access.denied === privilege ? <p>Access denied</p> : <>{children}</>,
}));
vi.mock('../patient-search-page/patient-search-page.component', () => ({
  default: () => <p>Patient search page</p>,
}));
vi.mock('../patient-search.resource', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../patient-search.resource')>();
  return { ...actual, useRestPatients: vi.fn(actual.useRestPatients) };
});
vi.mock('../recently-viewed-patients.store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../recently-viewed-patients.store')>();
  return { ...actual, useRecentlyViewedPatients: vi.fn(actual.useRecentlyViewedPatients) };
});

const sessionStore = getSessionStore();
const patient = (uuid: string): SearchedPatient => ({
  uuid,
  attributes: [],
  identifiers: [],
  person: {
    addresses: [],
    age: 36,
    birthdate: '1990-01-01',
    dead: false,
    deathDate: null,
    gender: 'U',
    personName: {
      display: `Synthetic ${uuid}`,
      givenName: 'Synthetic',
      familyName: uuid,
      middleName: '',
      familyName2: '',
    },
  },
});

beforeEach(() => {
  access.denied = '';
  sessionStore.setState({ loaded: false, session: null });
  const session = {
    ...mockSession.data,
    authenticated: true,
    user: {
      ...mockSession.data.user,
      roles: [],
      privileges: [
        { uuid: 'synthetic-chart-access', name: patientChartPrivilege, display: patientChartPrivilege, links: [] },
      ],
    },
  };
  Reflect.deleteProperty(session, 'sessionId');
  sessionStore.setState({ loaded: true, session });
  vi.mocked(useSession).mockReturnValue(session);
  vi.mocked(useConfig).mockReturnValue(getDefaultsFromConfigSchema(configSchema));
  vi.stubGlobal('getOpenmrsSpaBase', () => '/openmrs/spa');
  vi.stubGlobal('spaBase', '/openmrs/spa');
  window.history.replaceState({}, '', `/openmrs/spa/${recentPatientsRoute}`);
  vi.mocked(openmrsFetch).mockImplementation(async (url) => {
    const uuid = new URL(String(url), 'http://localhost').pathname.split('/').at(-1);
    return { data: patient(uuid) } as Awaited<ReturnType<typeof openmrsFetch>>;
  });
});

afterEach(() => act(() => sessionStore.setState({ loaded: false, session: null })));

function seedHistory() {
  const recorder = renderHook(() => useRecentlyViewedPatients(true));
  act(() => {
    recorder.result.current.recordViewedPatient('patient-a');
    recorder.result.current.recordViewedPatient('patient-b');
  });
  recorder.unmount();
  vi.mocked(useRecentlyViewedPatients).mockClear();
}

function renderPage(context = {}) {
  return render(
    <SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false, dedupingInterval: 0 }}>
      <PatientSearchContext.Provider value={context}>
        <Root />
      </PatientSearchContext.Provider>
    </SWRConfig>,
  );
}

it('registers the canonical independent page with the existing root lifecycle', () => {
  expect(routes.pages).toContainEqual({ component: 'root', route: recentPatientsRoute });
  expect(routes.pages).toContainEqual({ component: 'root', route: 'search' });
});

it.each([
  'large-desktop',
  'tablet',
] as const)('opens its own page directly on %s without search controls', async (layout) => {
  vi.mocked(useLayoutType).mockReturnValue(layout);
  seedHistory();
  renderPage();
  expect(screen.getByRole('heading', { level: 1, name: 'Recently viewed patients' })).toBeInTheDocument();
  expect(screen.getByText(/The last 10 patient charts opened in this tab, from any entry point/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Search patient' })).toHaveAttribute('href', '/openmrs/spa/search');
  expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  expect(screen.queryByText('Patient search page')).not.toBeInTheDocument();
  const patientLinks = await screen.findAllByRole('link', { name: /^Synthetic/ });
  expect(patientLinks.map((link) => link.getAttribute('href'))).toEqual([
    '/openmrs/spa/patient/patient-b/chart/',
    '/openmrs/spa/patient/patient-a/chart/',
  ]);
});

it.each([
  'app:opciones.busquedaPaciente',
  patientChartPrivilege,
])('does not mount recent hooks or read patients when %s is denied', (privilege) => {
  seedHistory();
  access.denied = privilege;
  renderPage();
  expect(screen.getByText('Access denied')).toBeInTheDocument();
  expect(useRecentlyViewedPatients).not.toHaveBeenCalled();
  expect(useRestPatients).not.toHaveBeenCalled();
  expect(openmrsFetch).not.toHaveBeenCalled();
});

it('shows a disabled explanation and a search link without mounting recent hooks or reading patients', () => {
  seedHistory();
  const config = getDefaultsFromConfigSchema(configSchema);
  config.search.showRecentlySearchedPatients = false;
  vi.mocked(useConfig).mockReturnValue(config);
  renderPage();
  expect(screen.getByText(/Recent patients are disabled in this installation/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Search patient' })).toBeInTheDocument();
  expect(useRecentlyViewedPatients).not.toHaveBeenCalled();
  expect(useRestPatients).not.toHaveBeenCalled();
  expect(openmrsFetch).not.toHaveBeenCalled();
});

it('does not render or read recent patients for an unknown route', () => {
  seedHistory();
  window.history.replaceState({}, '', '/openmrs/spa/synthetic-unknown-route');
  renderPage();
  expect(screen.queryByRole('heading', { name: 'Recently viewed patients' })).not.toBeInTheDocument();
  expect(useRecentlyViewedPatients).not.toHaveBeenCalled();
  expect(useRestPatients).not.toHaveBeenCalled();
  expect(openmrsFetch).not.toHaveBeenCalled();
});

it('explains the empty history without issuing patient reads', () => {
  renderPage();
  expect(screen.getByText('No recently viewed patient charts are available in this session.')).toBeInTheDocument();
  expect(screen.getByText(/Open a patient chart from search, a queue, a visit or a direct link/)).toBeInTheDocument();
  expect(openmrsFetch).not.toHaveBeenCalled();
});

it('shows loading without stale patient rows', () => {
  seedHistory();
  vi.mocked(openmrsFetch).mockImplementation(() => new Promise(() => {}));
  renderPage();
  expect(screen.getByRole('progressbar')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /^Synthetic/ })).not.toBeInTheDocument();
});

it('shows a safe error without patient details or raw server messages', async () => {
  seedHistory();
  vi.mocked(openmrsFetch).mockRejectedValue(new Error('Synthetic private server diagnostic'));
  renderPage();
  expect(await screen.findByText(/Sorry, there was an error/)).toBeInTheDocument();
  expect(screen.queryByText('Synthetic private server diagnostic')).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /^Synthetic/ })).not.toBeInTheDocument();
});

it.each([
  'click',
  'keyboard',
])('reopens the selected chart with %s and ignores contextual-selection callbacks', async (activation) => {
  seedHistory();
  const user = userEvent.setup();
  const nonNavigationSelectPatientAction = vi.fn();
  const patientClickSideEffect = vi.fn();
  renderPage({ nonNavigationSelectPatientAction, patientClickSideEffect });
  const link = await screen.findByRole('link', { name: 'Synthetic Patient-A' });
  expect(link).toHaveAttribute('href', '/openmrs/spa/patient/patient-a/chart/');
  if (activation === 'click') await user.click(link);
  else {
    link.focus();
    await user.keyboard('{Enter}');
  }
  await waitFor(() => expect(navigateToUrl).toHaveBeenCalledWith('/openmrs/spa/patient/patient-a/chart/'));
  expect(nonNavigationSelectPatientAction).not.toHaveBeenCalled();
  expect(patientClickSideEffect).not.toHaveBeenCalled();
});
