import {
  ExtensionSlot,
  formatDate,
  navigate,
  UserHasAccess,
  usePatient,
  userHasAccess,
  useSession,
} from '@openmrs/esm-framework';
import {
  MotherChildRelationships,
  useLaunchWorkspaceRequiringVisit,
  usePatientEnrollment,
} from '@openmrs/esm-patient-common-lib';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  credAntecedentsPrivilege,
  credCourseLifeEditPrivilege,
  credCourseLifePrivilege,
  credEarlyStimulationPrivilege,
  credImmunizationPrivilege,
  credNeonatalPrivilege,
  credNutritionPrivilege,
  credWellChildPrivilege,
} from '../constants';
import useEncountersCRED from '../hooks/useEncountersCRED';
import routes from '../routes.json';
import ChildMedicalHistory from '../ui/conditions-filter/conditions-overview.component';
import GrowthChartOverview from '../ui/growth-chart/growth-chart-overview.component';
import IntegratedCredDashboard from './integrated-cred-dashboard.component';
import IntegratedCredLink from './integrated-cred-link.component';

vi.mock('@openmrs/esm-patient-common-lib', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@openmrs/esm-patient-common-lib')>()),
  useLaunchWorkspaceRequiringVisit: vi.fn(),
  MotherChildRelationships: vi.fn((props) =>
    props.canView ? <div>Child relationship reader {props.patientUuid}</div> : null,
  ),
}));
vi.mock('../../../../libs/esm-patient-common-lib/src/clinical-view-group/clinical-view-group.resource', () => ({
  usePatientEnrollment: vi.fn(),
}));
vi.mock('../hooks/useEncountersCRED', () => ({ default: vi.fn() }));
vi.mock('../ui/conditions-filter/conditions-overview.component', () => ({
  default: vi.fn(({ patientUuid }) => <div>Antecedentes: {patientUuid}</div>),
}));
vi.mock('../ui/growth-chart/growth-chart-overview.component', () => ({
  default: vi.fn(({ patientUuid }) => <div>Curvas: {patientUuid}</div>),
}));
vi.mock('./components/cred-controls-timeline/cred-matrix.component', () => ({
  default: vi.fn(({ patientUuid }) => <div>Controles: {patientUuid}</div>),
}));
vi.mock('./components/neonatal-register/detalles-nacimiento/birth-date.component', () => ({
  default: vi.fn(({ patientUuid }) => <div>Nacimiento: {patientUuid}</div>),
}));
vi.mock('./components/neonatal-register/detalles-embarazo/pregnancy-table.component', () => ({
  default: vi.fn(({ patientUuid }) => <div>Embarazo y parto: {patientUuid}</div>),
}));
vi.mock('./components/anemia-screening/anemia-screening.component', () => ({
  default: vi.fn(() => <div>Anemia</div>),
}));
vi.mock('./components/supplementation/supplementation-tracker.component', () => ({
  default: vi.fn(() => <div>Suplementación</div>),
}));
vi.mock('./components/screening/screening-indicators.component', () => ({
  default: vi.fn(() => <div>Tamizajes</div>),
}));
vi.mock('react-i18next', async () => {
  const { default: catalog } = await import('../../translations/es.json');
  return {
    useTranslation: () => ({
      t: (key: string, fallback?: string | Record<string, unknown>, options?: Record<string, unknown>) => {
        let value = (catalog as Record<string, string>)[key] ?? (typeof fallback === 'string' ? fallback : key);
        for (const [name, replacement] of Object.entries(typeof fallback === 'object' ? fallback : (options ?? {}))) {
          value = value.replace(`{{${name}}}`, String(replacement));
        }
        return value;
      },
    }),
  };
});

const patient = {
  id: 'synthetic-child',
  gender: 'female',
  birthDate: '2025-04-01',
} as fhir.Patient;
const launchControl = vi.fn();
const allFamilies = [
  credAntecedentsPrivilege,
  credWellChildPrivilege,
  credNeonatalPrivilege,
  credNutritionPrivilege,
  credEarlyStimulationPrivilege,
  credImmunizationPrivilege,
];

it('reads the child’s linked mother with chart and neonatal view permission without relationship editing', () => {
  setPrivileges(['app:hoja.clinica', credCourseLifePrivilege, credNeonatalPrivilege]);
  render(<IntegratedCredDashboard />);
  expect(MotherChildRelationships).toHaveBeenCalledWith(
    expect.objectContaining({
      patientUuid: patient.id,
      patientRole: 'child',
      canView: true,
      translationNamespace: '@sihsalus/esm-cred-app',
    }),
    expect.anything(),
  );
  expect(screen.getByText(`Child relationship reader ${patient.id}`)).toBeInTheDocument();
});

it('removes the linked mother reader when neonatal view or global chart access is missing', () => {
  setPrivileges(['app:hoja.clinica', credCourseLifePrivilege, credNeonatalPrivilege, credWellChildPrivilege]);
  const { rerender } = render(<IntegratedCredDashboard />);
  expect(screen.getByText(`Child relationship reader ${patient.id}`)).toBeInTheDocument();
  setPrivileges(['app:hoja.clinica', credCourseLifePrivilege, credWellChildPrivilege]);
  rerender(<IntegratedCredDashboard />);
  expect(screen.queryByText(/Child relationship reader/)).not.toBeInTheDocument();
  setPrivileges([credCourseLifePrivilege, credNeonatalPrivilege]);
  rerender(<IntegratedCredDashboard />);
  expect(screen.queryByText(/Child relationship reader/)).not.toBeInTheDocument();
});

function setPrivileges(privileges: string[], authenticated = true) {
  vi.mocked(useSession).mockReturnValue({
    authenticated,
    user: {
      uuid: 'synthetic-clinician',
      privileges: privileges.map((display) => ({ display })),
    },
  } as ReturnType<typeof useSession>);
}

beforeEach(() => {
  vi.clearAllMocks();
  setPrivileges([credCourseLifePrivilege, ...allFamilies]);
  vi.mocked(usePatient).mockReturnValue({
    patient,
    patientUuid: patient.id,
  } as ReturnType<typeof usePatient>);
  vi.mocked(userHasAccess).mockImplementation((privilege, user) =>
    (Array.isArray(privilege) ? privilege : [privilege]).every((required) =>
      user?.privileges?.some(({ display }) => display === required),
    ),
  );
  vi.mocked(UserHasAccess).mockImplementation(({ privilege, children, fallback }) => (
    <>{userHasAccess(privilege, useSession()?.user) ? children : fallback}</>
  ));
  vi.mocked(ExtensionSlot).mockImplementation(({ name, state }) => (
    <div data-testid={name}>{String(state?.patientUuid ?? '')}</div>
  ));
  vi.mocked(usePatientEnrollment).mockReturnValue({
    activePatientEnrollment: [{ program: { name: 'Control de Niño Sano' } }],
    isLoading: false,
    error: null,
  } as ReturnType<typeof usePatientEnrollment>);
  vi.mocked(useLaunchWorkspaceRequiringVisit).mockReturnValue(launchControl);
  vi.mocked(useEncountersCRED).mockReturnValue({
    encounters: [],
    isLoading: false,
    error: null,
    controlNumberError: null,
    mutate: vi.fn(),
  } as ReturnType<typeof useEncountersCRED>);
});

it('mounts the seven sections and reads clinical panels only after selection', async () => {
  render(<IntegratedCredDashboard />);
  expect(screen.getAllByRole('tab')).toHaveLength(7);
  expect(screen.getByRole('tab', { name: 'Resumen' })).toHaveAttribute('aria-selected', 'true');
  expect(GrowthChartOverview).not.toHaveBeenCalled();
  expect(ChildMedicalHistory).not.toHaveBeenCalled();
  expect(ExtensionSlot).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: 'Abrir Crecimiento y nutrición' }));
  expect(screen.getByRole('tab', { name: 'Crecimiento y nutrición' })).toHaveAttribute('aria-selected', 'true');
  expect(await screen.findByText('Curvas: synthetic-child')).toBeVisible();
  expect(ChildMedicalHistory).not.toHaveBeenCalled();
  expect(screen.queryByText('Atenciones de crecimiento y desarrollo registradas')).not.toBeInTheDocument();
});

it('permits a nutrition reader without granting child-checkup, neonatal or immunization access', () => {
  setPrivileges([credCourseLifePrivilege, credNutritionPrivilege]);
  render(<IntegratedCredDashboard />);
  expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
    'Resumen',
    'Crecimiento y nutrición',
    'Seguimiento',
  ]);
  expect(useEncountersCRED).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'Abrir formularios del control' })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('tab', { name: 'Crecimiento y nutrición' }));
  expect(screen.getByTestId('child-nutrition-assessment-slot')).toHaveTextContent(patient.id ?? '');
  expect(GrowthChartOverview).not.toHaveBeenCalled();
});

it('opens neonatal history with its own read permission without mounting pathological antecedents', () => {
  setPrivileges([credCourseLifePrivilege, credNeonatalPrivilege]);
  render(<IntegratedCredDashboard />);
  fireEvent.click(screen.getByRole('tab', { name: 'Antecedentes y nacimiento' }));
  expect(screen.getByText('Nacimiento: synthetic-child')).toBeVisible();
  expect(ChildMedicalHistory).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Ver atención neonatal' }));
  expect(navigate).toHaveBeenCalledWith({ to: '/openmrs/spa/patient/synthetic-child/chart/neonatal-care-dashboard' });
});

it.each([
  ['without course-of-life permission', [credWellChildPrivilege], true],
  ['without a readable family', [credCourseLifePrivilege], true],
  ['without authentication', [credCourseLifePrivilege, credWellChildPrivilege], false],
])('does not mount enrollment or clinical readers %s', (_name, privileges, authenticated) => {
  setPrivileges(privileges, authenticated);
  render(<IntegratedCredDashboard />);
  expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  expect(usePatientEnrollment).not.toHaveBeenCalled();
  expect(useEncountersCRED).not.toHaveBeenCalled();
});

it('waits for enrollment and blocks direct access when the program is absent', () => {
  vi.mocked(usePatientEnrollment).mockReturnValue({
    activePatientEnrollment: [],
    isLoading: true,
    error: null,
  } as ReturnType<typeof usePatientEnrollment>);
  const { rerender } = render(<IntegratedCredDashboard />);
  expect(screen.getByText('Comprobando inscripción al programa de crecimiento y desarrollo…')).toBeVisible();
  expect(useEncountersCRED).not.toHaveBeenCalled();
  vi.mocked(usePatientEnrollment).mockReturnValue({
    activePatientEnrollment: [],
    isLoading: false,
    error: null,
  } as ReturnType<typeof usePatientEnrollment>);
  rerender(<IntegratedCredDashboard />);
  expect(screen.getByText('El programa de crecimiento y desarrollo no está activo')).toBeVisible();
  expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  expect(useEncountersCRED).not.toHaveBeenCalled();
});

it('blocks readers on enrollment failure without showing the technical error', () => {
  vi.mocked(usePatientEnrollment).mockReturnValue({
    activePatientEnrollment: [],
    isLoading: false,
    error: new Error('private-server-trace'),
  } as ReturnType<typeof usePatientEnrollment>);
  render(<IntegratedCredDashboard />);
  expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  expect(screen.queryByText(/private-server-trace/)).not.toBeInTheDocument();
  expect(useEncountersCRED).not.toHaveBeenCalled();
});

it('shows dates of recorded care without declaring clinical completion from its forms', () => {
  vi.mocked(useEncountersCRED).mockReturnValue({
    encounters: [
      {
        uuid: 'synthetic-exam',
        visit: { uuid: 'synthetic-visit' },
        encounterDatetime: '2026-10-01T15:10:00Z',
        controlNumber: 1,
      },
      {
        uuid: 'synthetic-nutrition',
        visit: { uuid: 'synthetic-visit' },
        encounterDatetime: '2026-10-01T15:15:00Z',
        controlNumber: 1,
      },
      {
        uuid: 'synthetic-next-encounter',
        visit: { uuid: 'synthetic-next-visit' },
        encounterDatetime: '2026-10-08T15:10:00Z',
        controlNumber: 2,
      },
    ],
    isLoading: false,
    error: null,
    controlNumberError: null,
    mutate: vi.fn(),
  } as ReturnType<typeof useEncountersCRED>);
  render(<IntegratedCredDashboard />);
  const records = screen.getAllByRole('listitem');
  expect(records).toHaveLength(2);
  expect(records[0]).toHaveTextContent(formatDate(new Date('2026-10-08T15:10:00Z'), { time: true }));
  expect(records[1]).toHaveTextContent(formatDate(new Date('2026-10-01T15:10:00Z'), { time: true }));
  expect(screen.queryByText(/complet[oa]|cumplimiento|%/i)).not.toBeInTheDocument();
});

it('returns to Overview and uses the new identity when switching patients', () => {
  const { rerender } = render(<IntegratedCredDashboard patient={patient} patientUuid={patient.id} />);
  fireEvent.click(screen.getByRole('tab', { name: 'Antecedentes y nacimiento' }));
  expect(screen.getByText('Antecedentes: synthetic-child')).toBeVisible();
  const nextPatient = { ...patient, id: 'synthetic-next-child' };
  rerender(<IntegratedCredDashboard patient={nextPatient} patientUuid={nextPatient.id} />);
  expect(screen.getByRole('tab', { name: 'Resumen' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.queryByText('Antecedentes: synthetic-child')).not.toBeInTheDocument();
  expect(usePatientEnrollment).toHaveBeenLastCalledWith(nextPatient.id);
  expect(useEncountersCRED).toHaveBeenLastCalledWith(nextPatient.id);
  fireEvent.click(screen.getByRole('tab', { name: 'Crecimiento y nutrición' }));
  expect(screen.getByText('Curvas: synthetic-next-child')).toBeVisible();
});

it('unmounts a selected family when its permission is revoked', () => {
  const { rerender } = render(<IntegratedCredDashboard />);
  fireEvent.click(screen.getByRole('tab', { name: 'Crecimiento y nutrición' }));
  expect(screen.getByText('Curvas: synthetic-child')).toBeVisible();
  setPrivileges([credCourseLifePrivilege, credImmunizationPrivilege]);
  rerender(<IntegratedCredDashboard />);
  expect(screen.queryByRole('tab', { name: 'Crecimiento y nutrición' })).not.toBeInTheDocument();
  expect(screen.queryByText('Curvas: synthetic-child')).not.toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Resumen' })).toHaveAttribute('aria-selected', 'true');
});

it('uses the existing visit-guarded launcher and preserves the current patient in history navigation', () => {
  setPrivileges([
    credCourseLifePrivilege,
    credWellChildPrivilege,
    credCourseLifeEditPrivilege,
    'app:hoja.clinica.visitas',
  ]);
  render(<IntegratedCredDashboard />);
  fireEvent.click(screen.getByRole('button', { name: 'Abrir formularios del control' }));
  expect(useLaunchWorkspaceRequiringVisit).toHaveBeenCalledWith(patient.id, 'wellchild-control-form');
  expect(launchControl).toHaveBeenCalledWith({ patientUuid: patient.id });
  fireEvent.click(screen.getByRole('button', { name: 'Consultas anteriores' }));
  expect(navigate).toHaveBeenCalledWith({ to: '/openmrs/spa/patient/synthetic-child/chart/Visits' });
});

it('does not render a previous patient under a different patient UUID', () => {
  render(<IntegratedCredDashboard patient={patient} patientUuid="synthetic-other-child" />);
  expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  expect(usePatientEnrollment).not.toHaveBeenCalled();
});

it('keeps the same program and read-permission conditions on the new navigation link', () => {
  setPrivileges([credCourseLifePrivilege, credImmunizationPrivilege]);
  const { rerender } = render(<IntegratedCredLink basePath="/patient/synthetic-child/chart" />);
  expect(screen.getByRole('link', { name: 'Crecimiento y desarrollo' })).toHaveAttribute(
    'href',
    '/patient/synthetic-child/chart/cred-dashboard',
  );
  setPrivileges([credCourseLifePrivilege]);
  rerender(<IntegratedCredLink basePath="/patient/synthetic-child/chart" />);
  expect(screen.queryByRole('link', { name: 'Crecimiento y desarrollo' })).not.toBeInTheDocument();
});

it.each([
  ['well-child-care-dashboard', credWellChildPrivilege],
  ['neonatal-care-dashboard', credNeonatalPrivilege],
  ['child-immunization-schedule-dashboard', credImmunizationPrivilege],
  ['early-stimulation-dashboard', credEarlyStimulationPrivilege],
  ['child-nutrition-dashboard', credNutritionPrivilege],
])('preserves the original route privilege for %s', (name, privilege) => {
  expect(routes.extensions.find((extension) => extension.name === name)?.privileges).toBe(privilege);
  expect(routes.extensions.find((extension) => extension.name === `${name}-route`)?.privileges).toBe(privilege);
});
