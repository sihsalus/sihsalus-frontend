import { ExtensionSlot, navigate } from '@openmrs/esm-framework';
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
vi.mock('./consulta-externa-antecedents.component', () => ({
  default: ({ patientUuid }: { patientUuid: string }) => <div data-patient-uuid={patientUuid}>Antecedents panel</div>,
}));
vi.mock('./diagnostico-clasificado.component', () => ({
  default: () => <div>Diagnosis panel</div>,
}));
vi.mock('./notas-soap.component', () => ({
  default: () => <div>Physical exam panel</div>,
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
    mockExtensionSlot.mockImplementation(({ name, state }) => {
      const patientUuid = (state as { patientUuid?: string } | undefined)?.patientUuid;

      return name === 'consulta-externa-pruebas-complementarias-slot' ? (
        <div data-patient-uuid={patientUuid}>Complementary tests panel</div>
      ) : (
        <div>Triage panel</div>
      );
    });
  });

  it('orders the tabs according to the clinical workflow and keeps panels aligned', async () => {
    const user = userEvent.setup();
    render(<ConsultaExternaDashboard patientUuid="synthetic-patient-uuid" />);

    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Triajes previos',
      'Antecedents',
      'Anamnesis',
      'Examen físico',
      'Pruebas complementarias',
      'Diagnóstico',
      'Plan de Tratamiento',
      'Referencia / Contrarreferencia',
    ]);
    expect(screen.getByRole('heading', { level: 1, name: 'Consulta Externa' })).toBeVisible();
    expect(screen.queryByText('consultaExterna')).not.toBeInTheDocument();
    expect(screen.getByText('Triage panel')).toBeVisible();

    await user.click(screen.getByRole('tab', { name: 'Antecedents' }));
    expect(screen.getByText('Antecedents panel')).toHaveAttribute('data-patient-uuid', 'synthetic-patient-uuid');

    await user.click(screen.getByRole('tab', { name: 'Anamnesis' }));
    expect(screen.getByText('Anamnesis panel')).toBeVisible();

    await user.click(screen.getByRole('tab', { name: 'Examen físico' }));
    expect(screen.getByText('Physical exam panel')).toBeVisible();
    expect(screen.queryByText('Diagnosis panel')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Pruebas complementarias' }));
    expect(screen.getByText('Complementary tests panel')).toHaveAttribute(
      'data-patient-uuid',
      'synthetic-patient-uuid',
    );
    expect(screen.queryByText('Physical exam panel')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Diagnóstico' }));
    expect(screen.getByText('Diagnosis panel')).toBeVisible();
    expect(screen.queryByText('Complementary tests panel')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Plan de Tratamiento' }));
    expect(screen.getByText('Treatment plan panel')).toBeVisible();
    expect(screen.queryByText('Diagnosis panel')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Referencia / Contrarreferencia' }));
    expect(screen.getByText('Referral and counter-referral panel')).toBeVisible();
    expect(screen.queryByText('Treatment plan panel')).not.toBeInTheDocument();
  });

  it('opens the existing patient visit history from the dashboard header', async () => {
    const user = userEvent.setup();
    render(<ConsultaExternaDashboard patientUuid="synthetic-patient-uuid" />);

    await user.click(screen.getByRole('button', { name: 'Previous consultations' }));

    expect(navigate).toHaveBeenCalledWith({
      to: `\${openmrsSpaBase}/patient/synthetic-patient-uuid/chart/Visits`,
    });
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
