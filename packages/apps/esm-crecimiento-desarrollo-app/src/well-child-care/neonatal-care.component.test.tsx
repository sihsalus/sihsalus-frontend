import { Extension, ExtensionSlot, UserHasAccess, usePatient, userHasAccess, useSession } from '@openmrs/esm-framework';
import { usePatientEnrollment } from '@openmrs/esm-patient-common-lib';
import { fireEvent, render, screen } from '@testing-library/react';
import { credCourseLifePrivilege, credNeonatalPrivilege, neonatalFluidBalanceSlot } from '../constants';
import routes from '../routes.json';
import { NeonatalCare } from './neonatal-care.component';
import NeonatalCareLink from './neonatal-care-link.component';

vi.mock('../../../../libs/esm-patient-common-lib/src/clinical-view-group/clinical-view-group.resource', () => ({
  usePatientEnrollment: vi.fn(),
}));
vi.mock('react-i18next', async () => {
  const { default: catalog } = await import('../../translations/es.json');
  return {
    useTranslation: () => ({ t: (key: string) => catalog[key] ?? key }),
  };
});

const patient = {
  id: 'synthetic-child',
  birthDate: '2026-10-01',
} as fhir.Patient;

function setPrivileges(privileges: string[], authenticated = true) {
  vi.mocked(useSession).mockReturnValue({
    authenticated,
    user: {
      uuid: 'synthetic-user',
      privileges: privileges.map((display) => ({ display })),
    },
  } as ReturnType<typeof useSession>);
}

beforeEach(() => {
  vi.clearAllMocks();
  setPrivileges([credCourseLifePrivilege, credNeonatalPrivilege]);
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
  vi.mocked(ExtensionSlot).mockImplementation(({ name, children }) => (
    <section data-testid={name}>
      {typeof children === 'function' ? children({ id: 'synthetic-extension' } as never) : children}
    </section>
  ));
  vi.mocked(Extension).mockImplementation(({ state }) => <span>{String(state?.patientUuid ?? '')}</span>);
  vi.mocked(usePatientEnrollment).mockReturnValue({
    activePatientEnrollment: [{ program: { name: 'Control de Niño Sano' } }],
    isLoading: false,
    error: null,
  } as ReturnType<typeof usePatientEnrollment>);
});

it('gives fluid balance its own tab and mounts only the selected neonatal section', () => {
  render(<NeonatalCare />);
  expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
    'Signos vitales del recién nacido',
    'Balance de líquidos',
    'Registro perinatal',
    'Atención inmediata',
    'Evaluación cefalocaudal',
    'Alojamiento conjunto',
    'Lactancia',
  ]);
  expect(screen.getByTestId('neonatal-vitals-slot')).toBeVisible();
  expect(screen.queryByTestId(neonatalFluidBalanceSlot)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: 'Balance de líquidos' }));
  expect(screen.getByTestId(neonatalFluidBalanceSlot)).toHaveTextContent(patient.id);
  expect(screen.queryByTestId('neonatal-vitals-slot')).not.toBeInTheDocument();
  expect(routes.extensions.find(({ name }) => name === 'newborn-balance-overview-chart')?.slot).toBe(
    neonatalFluidBalanceSlot,
  );
});

it('resets selection on patient change and never shows a previous patient under another UUID', () => {
  const { rerender } = render(<NeonatalCare patient={patient} patientUuid={patient.id} />);
  fireEvent.click(screen.getByRole('tab', { name: 'Balance de líquidos' }));
  const next = { ...patient, id: 'synthetic-next-child' };
  rerender(<NeonatalCare patient={next} patientUuid={next.id} />);
  expect(screen.getByRole('tab', { name: 'Signos vitales del recién nacido' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  expect(screen.queryByText(patient.id)).not.toBeInTheDocument();
  expect(screen.getByTestId('neonatal-vitals-slot')).toHaveTextContent(next.id);
  rerender(<NeonatalCare patient={patient} patientUuid={next.id} />);
  expect(screen.queryByRole('tab')).not.toBeInTheDocument();
});

it('unmounts the neonatal panels when read permission is revoked', () => {
  const { rerender } = render(<NeonatalCare />);
  fireEvent.click(screen.getByRole('tab', { name: 'Balance de líquidos' }));
  setPrivileges([credCourseLifePrivilege]);
  rerender(<NeonatalCare />);
  expect(screen.queryByTestId(neonatalFluidBalanceSlot)).not.toBeInTheDocument();
});

it('links to the existing neonatal route without requiring edit privileges', () => {
  render(<NeonatalCareLink basePath="/patient/synthetic-child/chart" />);
  expect(screen.getByRole('link', { name: 'Atención neonatal' })).toHaveAttribute(
    'href',
    '/patient/synthetic-child/chart/neonatal-care-dashboard',
  );
  expect(routes.extensions.find(({ name }) => name === 'neonatal-care-dashboard-route')).toEqual(
    expect.objectContaining({
      component: 'neonatalCareSidebarLink',
      privileges: credNeonatalPrivilege,
    }),
  );
});

it.each([
  [[credCourseLifePrivilege], true],
  [[credNeonatalPrivilege], true],
  [[credCourseLifePrivilege, credNeonatalPrivilege], false],
])('hides the link without the previous group permissions or authentication (%j, %s)', (privileges, authenticated) => {
  setPrivileges(privileges, authenticated);
  render(<NeonatalCareLink basePath="/patient/synthetic-child/chart" />);
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
  expect(usePatientEnrollment).not.toHaveBeenCalled();
});

it.each([
  { activePatientEnrollment: [], isLoading: false, error: null },
  { activePatientEnrollment: [], isLoading: true, error: null },
  {
    activePatientEnrollment: [],
    isLoading: false,
    error: new Error('private-error'),
  },
])('keeps the enrollment visibility policy when enrollment is unavailable (%j)', (enrollment) => {
  vi.mocked(usePatientEnrollment).mockReturnValue(enrollment as ReturnType<typeof usePatientEnrollment>);
  render(<NeonatalCareLink basePath="/patient/synthetic-child/chart" />);
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
  expect(screen.queryByText('private-error')).not.toBeInTheDocument();
});
