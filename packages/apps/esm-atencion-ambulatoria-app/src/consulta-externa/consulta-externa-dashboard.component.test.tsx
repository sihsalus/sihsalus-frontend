import { ExtensionSlot } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PropsWithChildren } from 'react';
import ConsultaExternaDashboard from './consulta-externa-dashboard.component';

vi.mock('@sihsalus/esm-rbac', () => ({
  RequirePrivilege: ({ children }: PropsWithChildren) => children,
}));

vi.mock('./anamnesis.component', () => ({ default: () => <div>Anamnesis panel</div> }));
vi.mock('./diagnostico-clasificado.component', () => ({ default: () => <div>Diagnosis panel</div> }));
vi.mock('./notas-soap.component', () => ({ default: () => <div>SOAP panel</div> }));
vi.mock('./plan-tratamiento.component', () => ({ default: () => <div>Treatment plan panel</div> }));
vi.mock('./referencia-contrarreferencia.component', () => ({ default: () => <div>Referral panel</div> }));
vi.mock('./sis-financing-warning.component', () => ({ default: () => null }));

const mockExtensionSlot = vi.mocked(ExtensionSlot);

describe('ConsultaExternaDashboard', () => {
  beforeEach(() => {
    mockExtensionSlot.mockImplementation(() => <div>Triage panel</div>);
  });

  it('orders the tabs according to the clinical workflow and keeps panels aligned', async () => {
    const user = userEvent.setup();
    render(<ConsultaExternaDashboard patientUuid="synthetic-patient-uuid" />);

    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Triajes previos',
      'Anamnesis',
      'Examen físico / SOAP',
      'Diagnóstico',
      'Plan de Tratamiento',
      'Referencia / Contrarreferencia',
    ]);
    expect(screen.getByText('Triage panel')).toBeVisible();

    await user.click(screen.getByRole('tab', { name: 'Examen físico / SOAP' }));
    expect(screen.getByText('SOAP panel')).toBeVisible();
    expect(screen.queryByText('Diagnosis panel')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Diagnóstico' }));
    expect(screen.getByText('Diagnosis panel')).toBeVisible();
    expect(screen.queryByText('SOAP panel')).not.toBeInTheDocument();
  });
});
