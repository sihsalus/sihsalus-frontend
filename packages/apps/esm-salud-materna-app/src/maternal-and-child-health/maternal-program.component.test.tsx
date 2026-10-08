import { navigate, usePatient, userHasAccess, useSession } from '@openmrs/esm-framework';
import { usePatientEnrollment } from '@openmrs/esm-patient-common-lib';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockSession } from 'test-utils';

import en from '../../translations/en.json';
import es from '../../translations/es.json';
import { IntegratedMaternalDashboard } from './maternal-program.component';

const readers = vi.hoisted(() => ({
  prenatal: vi.fn(),
  postpartum: vi.fn(),
  measurements: vi.fn(),
  launchForms: vi.fn(),
  delivery: vi.fn(),
}));
vi.mock('@openmrs/esm-patient-common-lib', async (original) => ({
  ...(await original<typeof import('@openmrs/esm-patient-common-lib')>()),
  usePatientEnrollment: vi.fn(),
  useLaunchWorkspaceRequiringVisit: () => readers.launchForms,
}));
vi.mock('./components/prenatal-care/prenatalCareChart.component', () => ({
  default: ({ patientUuid }) => {
    readers.prenatal(patientUuid);
    return <div>Prenatal reader {patientUuid}</div>;
  },
}));
vi.mock('../ui/alturaCuello-chart/altura-cuello-overview.component', () => ({
  default: () => <div>Measurement chart</div>,
}));
vi.mock('./labour-delivery.component', () => ({
  LabourDelivery: ({ patientUuid }) => {
    readers.delivery(patientUuid);
    return <div>Delivery reader {patientUuid}</div>;
  },
}));
vi.mock('./maternal-form-history.component', () => ({
  default: ({ patientUuid }) => {
    readers.postpartum(patientUuid);
    return <div>Recorded forms {patientUuid}</div>;
  },
}));
vi.mock('../hooks/useCurrentPregnancy', () => ({ useCurrentPregnancy: () => ({ isLoading: false, error: null }) }));
vi.mock('../hooks/usePrenatalMeasurements', () => ({
  usePrenatalMeasurements: (patientUuid) => {
    readers.measurements(patientUuid);
    return { data: [], isLoading: false, error: null };
  },
}));

const patient: fhir.Patient = { resourceType: 'Patient', id: 'synthetic-mother-a', gender: 'female' };
let privileges: string[];

beforeEach(() => {
  privileges = ['app:hoja.clinica', 'app:hoja.clinica.controlPrenatal'];
  vi.mocked(useSession).mockReturnValue(mockSession.data);
  vi.mocked(usePatient).mockReturnValue({ patient, patientUuid: patient.id, isLoading: false } as ReturnType<
    typeof usePatient
  >);
  vi.mocked(userHasAccess).mockImplementation((privilege) => privileges.includes(String(privilege)));
  vi.mocked(usePatientEnrollment).mockReturnValue({
    activePatientEnrollment: [{ program: { name: 'Madre Gestante' } }],
    isLoading: false,
    error: null,
  } as ReturnType<typeof usePatientEnrollment>);
});

it('loads prenatal readers only after the section is selected', async () => {
  const user = userEvent.setup();
  render(<IntegratedMaternalDashboard />);
  expect(screen.getAllByRole('tab')).toHaveLength(6);
  expect(readers.prenatal).not.toHaveBeenCalled();
  expect(readers.postpartum).not.toHaveBeenCalled();
  await user.click(screen.getByRole('tab', { name: 'maternalPrenatalTab' }));
  expect(readers.prenatal).toHaveBeenCalledWith(patient.id);
  expect(screen.queryByRole('tab', { name: 'maternalPostpartumTab' })).not.toBeInTheDocument();
});

it('supports postpartum-only access without loading prenatal information', async () => {
  privileges = ['app:hoja.clinica', 'app:hoja.clinica.atencionPostnatal'];
  const user = userEvent.setup();
  render(<IntegratedMaternalDashboard />);
  expect(screen.getAllByRole('tab')).toHaveLength(3);
  expect(readers.measurements).not.toHaveBeenCalled();
  await user.click(screen.getByRole('tab', { name: 'maternalPostpartumTab' }));
  expect(readers.postpartum).toHaveBeenCalledWith(patient.id);
  expect(readers.prenatal).not.toHaveBeenCalled();
});

it('does not expose forms without edit permission from a readable family', async () => {
  privileges.push('app:hoja.clinica.atencionPostnatal.editar');
  const { rerender } = render(<IntegratedMaternalDashboard />);
  expect(screen.queryByRole('button', { name: 'maternalHealthForms' })).not.toBeInTheDocument();
  privileges.push('app:hoja.clinica.controlPrenatal.editar');
  rerender(<IntegratedMaternalDashboard />);
  await userEvent.click(screen.getByRole('button', { name: 'maternalHealthForms' }));
  expect(readers.launchForms).toHaveBeenCalledWith({ patientUuid: patient.id });
});

it('removes clinical readers when privileges are revoked', async () => {
  const { rerender } = render(<IntegratedMaternalDashboard />);
  await userEvent.click(screen.getByRole('tab', { name: 'maternalPrenatalTab' }));
  privileges = ['app:hoja.clinica'];
  rerender(<IntegratedMaternalDashboard />);
  expect(screen.queryByText(/Prenatal reader/)).not.toBeInTheDocument();
  expect(screen.queryByRole('tab')).not.toBeInTheDocument();
});

it('resets to overview when the patient changes', async () => {
  const { rerender } = render(<IntegratedMaternalDashboard patient={patient} patientUuid={patient.id} />);
  await userEvent.click(screen.getByRole('tab', { name: 'maternalPrenatalTab' }));
  const next: fhir.Patient = { ...patient, id: 'synthetic-mother-b' };
  rerender(<IntegratedMaternalDashboard patient={next} patientUuid={next.id} />);
  expect(screen.getByRole('tab', { name: 'maternalOverview' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.queryByText(/Prenatal reader/)).not.toBeInTheDocument();
});

it('does not load readers for a patient without the required enrollment', () => {
  vi.mocked(usePatientEnrollment).mockReturnValue({
    activePatientEnrollment: [],
    isLoading: false,
    error: null,
  } as ReturnType<typeof usePatientEnrollment>);
  render(<IntegratedMaternalDashboard />);
  expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  expect(readers.measurements).not.toHaveBeenCalled();
});

it('keeps delivery and newborn care in Gestantes for a delivery-only role', async () => {
  privileges = ['app:hoja.clinica', 'app:hoja.clinica.partoPuerperio'];
  render(<IntegratedMaternalDashboard />);
  expect(readers.measurements).not.toHaveBeenCalled();
  expect(readers.delivery).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('tab', { name: /^maternalDeliveryTab/ }));
  expect(readers.delivery).toHaveBeenCalledWith(patient.id);
  expect(screen.queryByRole('tab', { name: 'maternalPrenatalTab' })).not.toBeInTheDocument();
});

it('groups the visible care tasks into the four HCMP sections without bypassing permissions', async () => {
  privileges.push('app:hoja.clinica.partoPuerperio', 'app:hoja.clinica.atencionPostnatal');
  render(<IntegratedMaternalDashboard />);
  for (const name of ['hcmpBaseline', 'hcmpPrenatal', 'hcmpDeliveryPostpartum', 'hcmpDischarge']) {
    expect(screen.getByRole('region', { name })).toBeInTheDocument();
  }
  await userEvent.click(screen.getByRole('button', { name: 'maternalDischargeTab' }));
  expect(screen.getByRole('tab', { name: 'maternalDischargeTab' })).toHaveAttribute('aria-selected', 'true');
});

it('uses translated related-care labels and preserves their patient routes and permissions', async () => {
  const { rerender } = render(<IntegratedMaternalDashboard />);
  expect(screen.queryByRole('button', { name: 'family-planningLabel' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'cancer-preventionLabel' })).not.toBeInTheDocument();

  privileges.push('app:hoja.clinica.planificacionFamiliar', 'app:hoja.clinica.prevencionCancer');
  rerender(<IntegratedMaternalDashboard />);

  for (const [label, path] of [
    ['family-planningLabel', 'family-planning-dashboard'],
    ['cancer-preventionLabel', 'cancer-prevention-dashboard'],
  ] as const) {
    expect(en[label]).toBeTruthy();
    expect(es[label]).toBeTruthy();
    expect(en[label]).not.toBe(label);
    expect(es[label]).not.toBe(label);
    await userEvent.click(screen.getByRole('button', { name: label }));
    expect(navigate).toHaveBeenLastCalledWith({ to: `\${openmrsSpaBase}/patient/${patient.id}/chart/${path}` });
  }

  privileges = privileges.filter((privilege) => privilege !== 'app:hoja.clinica.planificacionFamiliar');
  rerender(<IntegratedMaternalDashboard />);
  expect(screen.queryByRole('button', { name: 'family-planningLabel' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'cancer-preventionLabel' })).toBeInTheDocument();
});
