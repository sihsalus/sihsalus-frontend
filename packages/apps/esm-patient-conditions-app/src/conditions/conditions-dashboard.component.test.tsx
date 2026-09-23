import { ExtensionSlot, useAssignedExtensions } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import ConditionsDashboard from './conditions-dashboard.component';

vi.mock('./conditions-detailed-summary.component', () => ({
  default: ({ patient }: { patient: fhir.Patient }) => <div>Conditions for {patient.id}</div>,
}));

const patient: fhir.Patient = { resourceType: 'Patient', id: 'synthetic-patient' };

it('opens the shared history with the same patient context', () => {
  vi.mocked(useAssignedExtensions).mockReturnValue([
    { id: 'antecedents-dashboard' } as ReturnType<typeof useAssignedExtensions>[number],
  ]);
  render(<ConditionsDashboard patient={patient} />);
  expect(ExtensionSlot).toHaveBeenLastCalledWith(
    expect.objectContaining({
      name: 'patient-chart-antecedents-slot',
      state: { patient, patientUuid: patient.id },
    }),
    expect.anything(),
  );
});

it('keeps conditions available when the outpatient composition is unavailable', () => {
  vi.mocked(useAssignedExtensions).mockReturnValue([]);
  render(<ConditionsDashboard patient={patient} />);
  expect(screen.getByText('Conditions for synthetic-patient')).toBeInTheDocument();
});
