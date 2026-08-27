import { ExtensionSlot } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PropsWithChildren } from 'react';
import ConsultaExternaDashboard from './consulta-externa-dashboard.component';

vi.mock('@sihsalus/esm-rbac', () => ({
  RequirePrivilege: ({ children }: PropsWithChildren) => children,
}));

vi.mock('./anamnesis.component', () => ({
  default: () => <div>Anamnesis panel</div>,
}));
vi.mock('./diagnostico-clasificado.component', () => ({
  default: () => <div>Diagnosis panel</div>,
}));
vi.mock('./notas-soap.component', () => ({
  default: () => <div>SOAP panel</div>,
}));
vi.mock('./outpatient-visit-summary-download.component', () => ({
  default: ({ onNavigateToTab }: { onNavigateToTab?: (tabId: string) => void }) => (
    <button onClick={() => onNavigateToTab?.('treatment')} type="button">
      Download report
    </button>
  ),
}));
vi.mock('./plan-tratamiento.component', () => ({
  default: () => <div>Treatment plan panel</div>,
}));
vi.mock('./referencia-contrarreferencia.component', () => ({
  default: () => <div>Referral and counter-referral panel</div>,
}));
vi.mock('./sis-financing-warning.component', () => ({ default: () => null }));

const mockExtensionSlot = vi.mocked(ExtensionSlot);

describe('ConsultaExternaDashboard', () => {
  beforeEach(() => {
    mockExtensionSlot.mockImplementation(({ name }) =>
      name === 'consulta-externa-pruebas-complementarias-slot' ? (
        <div>Laboratory results card</div>
      ) : (
        <div>Triage panel</div>
      ),
    );
  });

  it('orders the tabs according to the clinical workflow and keeps panels aligned', async () => {
    const user = userEvent.setup();
    render(<ConsultaExternaDashboard patientUuid="synthetic-patient-uuid" />);

    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Triajes previos',
      'Anamnesis',
      'Examen físico / SOAP',
      'Pruebas complementarias',
      'Diagnóstico',
      'Plan de Tratamiento',
      'Referencia / Contrarreferencia',
    ]);
    expect(screen.getByRole('heading', { level: 1, name: 'Consulta Externa' })).toBeVisible();
    expect(screen.queryByText('consultaExterna')).not.toBeInTheDocument();
    expect(screen.getByText('Triage panel')).toBeVisible();

    await user.click(screen.getByRole('tab', { name: 'Examen físico / SOAP' }));
    expect(screen.getByText('SOAP panel')).toBeVisible();
    expect(screen.queryByText('Diagnosis panel')).not.toBeInTheDocument();

    // The clinician reads what the laboratory returned before classifying, so
    // the tab sits between the physical examination and the diagnosis.
    await user.click(screen.getByRole('tab', { name: 'Pruebas complementarias' }));
    expect(screen.getByText('Laboratory results card')).toBeVisible();
    expect(screen.queryByText('SOAP panel')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Diagnóstico' }));
    expect(screen.getByText('Diagnosis panel')).toBeVisible();
    expect(screen.queryByText('Laboratory results card')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Plan de Tratamiento' }));
    expect(screen.getByText('Treatment plan panel')).toBeVisible();
    expect(screen.queryByText('Diagnosis panel')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Referencia / Contrarreferencia' }));
    expect(screen.getByText('Referral and counter-referral panel')).toBeVisible();
    expect(screen.queryByText('Treatment plan panel')).not.toBeInTheDocument();
  });

  it('opens the tab a blocked document points at', async () => {
    const user = userEvent.setup();
    render(<ConsultaExternaDashboard patientUuid="synthetic-patient-uuid" />);

    expect(screen.queryByText('Treatment plan panel')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Download report' }));

    expect(screen.getByText('Treatment plan panel')).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Plan de Tratamiento' })).toHaveAttribute('aria-selected', 'true');
  });
});
