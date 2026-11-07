import { useConnectivity, userHasAccess, useSession } from '@openmrs/esm-framework';
import { launchPatientChartWithWorkspaceOpen, launchPatientWorkspace } from '@openmrs/esm-patient-common-lib';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import StartVisitDialog from './start-visit-dialog.component';

const mockNavigate = vi.hoisted(() => vi.fn());

const defaultProps = {
  patientUuid: 'some-uuid',
  closeModal: vi.fn(),
  visitType: null,
};

vi.mock('@openmrs/esm-patient-common-lib', async () => {
  const originalModule = await vi.importActual('@openmrs/esm-patient-common-lib');

  return {
    ...originalModule,
    launchPatientWorkspace: vi.fn(),
    launchPatientChartWithWorkspaceOpen: vi.fn(),
  };
});

vi.mock('@openmrs/esm-framework', async () => {
  const originalModule = await vi.importActual('@openmrs/esm-framework');

  return {
    ...originalModule,
    navigate: mockNavigate,
  };
});

describe('StartVisit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useConnectivity).mockReturnValue(true);
    vi.mocked(useSession).mockReturnValue({ authenticated: true, user: { privileges: [], roles: [] } } as ReturnType<
      typeof useSession
    >);
    vi.mocked(userHasAccess).mockReturnValue(true);
  });

  test('starts a separate visit from obstetric care without offering to edit the closed visit', async () => {
    const user = userEvent.setup();
    renderStartVisitDialog({ newVisitOnly: true, launchPatientChart: true, dashboardName: 'prenatal-care-dashboard' });

    expect(screen.getByText(/La consulta anterior está cerrada/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Edit past visit/i })).not.toBeInTheDocument();
    expect(launchPatientChartWithWorkspaceOpen).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /Start new visit/i }));
    expect(launchPatientChartWithWorkspaceOpen).toHaveBeenCalledWith({
      patientUuid: 'some-uuid',
      workspaceName: 'start-visit-workspace-form',
      dashboardName: 'prenatal-care-dashboard',
      additionalProps: { openedFrom: 'patient-chart-start-visit' },
    });
  });

  test.each(['offline', 'unauthenticated', 'unauthorized'])('blocks new-visit recovery when %s', async (state) => {
    if (state === 'offline') vi.mocked(useConnectivity).mockReturnValue(false);
    if (state === 'unauthenticated')
      vi.mocked(useSession).mockReturnValue({ authenticated: false } as ReturnType<typeof useSession>);
    if (state === 'unauthorized') vi.mocked(userHasAccess).mockReturnValue(false);
    const user = userEvent.setup();
    renderStartVisitDialog({ newVisitOnly: true, launchPatientChart: true });
    const start = screen.getByRole('button', { name: /Start new visit/i });
    expect(start).toBeDisabled();
    await user.click(start);
    expect(launchPatientChartWithWorkspaceOpen).not.toHaveBeenCalled();
  });

  test('should launch start visit form', async () => {
    const user = userEvent.setup();

    renderStartVisitDialog();

    expect(
      screen.getByText(
        `You can't add data to the patient chart without an active visit. Choose from one of the options below to continue.`,
      ),
    ).toBeInTheDocument();

    const startNewVisitButton = screen.getByRole('button', { name: /Start new visit/i });

    await user.click(startNewVisitButton);

    expect(launchPatientWorkspace).toHaveBeenCalledWith('start-visit-workspace-form', {
      openedFrom: 'patient-chart-start-visit',
    });
  });

  test('should launch edit past visit form', async () => {
    const user = userEvent.setup();

    renderStartVisitDialog({ visitType: 'past' });

    expect(
      screen.getByText(
        `You can add a new past visit or update an old one. Choose from one of the options below to continue.`,
      ),
    ).toBeInTheDocument();

    const editPastVisitButton = screen.getByRole('button', { name: /Edit past visit/i });

    await user.click(editPastVisitButton);

    expect(mockNavigate).toHaveBeenCalledWith({ to: '${openmrsSpaBase}/patient/some-uuid/chart/Visits' });
  });
});

function renderStartVisitDialog(props = {}) {
  render(<StartVisitDialog {...defaultProps} {...props} />);
}
