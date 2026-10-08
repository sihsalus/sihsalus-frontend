import { usePatient } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';

import type { PatientProgram } from '../types';
import { usePatientEnrollment } from './clinical-view-group.resource';
import { createClinicalDashboardLink } from './createClinicalDashboardLink';

vi.mock('./clinical-view-group.resource', () => ({ usePatientEnrollment: vi.fn() }));
vi.mock('@openmrs/esm-framework', async (original) => ({
  ...(await original<typeof import('@openmrs/esm-framework')>()),
  usePatient: vi.fn(),
}));
vi.mock('../dashboards/createDashboardLink', () => ({
  createDashboardLink:
    ({ path, title }: { path: string; title: string }) =>
    ({ basePath }: { basePath: string }) => <a href={`${basePath}/${path}`}>{title}</a>,
}));

const Link = createClinicalDashboardLink({
  title: 'Gestantes',
  path: 'maternal-care-dashboard',
  icon: 'omrs-icon-mother',
  moduleName: 'synthetic-module',
  showWhenExpression: 'patient.gender === "female" && enrollment.includes("Madre Gestante")',
});
const enrollment = { program: { name: 'Madre Gestante' } } as PatientProgram;

beforeEach(() => {
  vi.mocked(usePatient).mockReturnValue({
    patient: { resourceType: 'Patient', id: 'synthetic-patient', gender: 'female' },
    isLoading: false,
  } as ReturnType<typeof usePatient>);
  vi.mocked(usePatientEnrollment).mockReturnValue({
    activePatientEnrollment: [enrollment],
    isLoading: false,
    error: null,
  } as ReturnType<typeof usePatientEnrollment>);
});

it('delegates the permitted entry to the existing dashboard link', () => {
  render(<Link basePath="/patient/synthetic-patient/chart" />);
  expect(screen.getByRole('link', { name: 'Gestantes' })).toHaveAttribute(
    'href',
    '/patient/synthetic-patient/chart/maternal-care-dashboard',
  );
});

it.each([
  { activePatientEnrollment: [], isLoading: false, error: null },
  { activePatientEnrollment: [enrollment], isLoading: true, error: null },
  { activePatientEnrollment: [enrollment], isLoading: false, error: new Error('synthetic failure') },
])('does not expose the entry without a confirmed eligible enrollment', (state) => {
  vi.mocked(usePatientEnrollment).mockReturnValue(state as ReturnType<typeof usePatientEnrollment>);
  render(<Link basePath="/patient/synthetic-patient/chart" />);
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});

it('rechecks patient criteria on patient change', () => {
  const { rerender } = render(<Link basePath="/patient/synthetic-patient/chart" />);
  vi.mocked(usePatient).mockReturnValue({
    patient: { resourceType: 'Patient', id: 'synthetic-other', gender: 'male' },
    isLoading: false,
  } as ReturnType<typeof usePatient>);
  rerender(<Link basePath="/patient/synthetic-other/chart" />);
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});
