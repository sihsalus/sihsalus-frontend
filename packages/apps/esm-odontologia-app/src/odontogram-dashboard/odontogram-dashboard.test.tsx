import { launchWorkspace, userHasAccess, useSession } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useOdontogramEncounter } from '../hooks/useOdontogramEncounter';
import { useOdontogramHistory } from '../hooks/useOdontogramHistory';
import OdontogramDashboard from './odontogram-dashboard.component';

vi.mock('../hooks/useOdontogramEncounter');
vi.mock('../hooks/useOdontogramHistory');
vi.mock('../odontogram/components/Odontogram', () => ({
  default: ({ readOnly }: { readOnly?: boolean }) => (
    <div data-testid="odontogram-canvas" data-read-only={String(Boolean(readOnly))} />
  ),
}));
vi.mock('./odontogram-record-list.component', () => ({
  default: () => <div data-testid="odontogram-record-list" />,
}));

const mockUseSession = vi.mocked(useSession);
const mockUserHasAccess = vi.mocked(userHasAccess);
const mockLaunchWorkspace = vi.mocked(launchWorkspace);
const mockUseOdontogramEncounter = vi.mocked(useOdontogramEncounter);
const mockUseOdontogramHistory = vi.mocked(useOdontogramHistory);

describe('OdontogramDashboard', () => {
  beforeEach(() => {
    mockUseSession.mockReturnValue({ user: { uuid: 'user-uuid' } } as ReturnType<typeof useSession>);
    mockUserHasAccess.mockReturnValue(true);
    mockUseOdontogramEncounter.mockReturnValue({
      error: null,
      isSaving: false,
      save: vi.fn(),
    });
    mockUseOdontogramHistory.mockReturnValue({
      attentionRecords: [],
      baseRecords: [],
      error: null,
      groups: [],
      isLoading: false,
      mutate: vi.fn(),
    });
  });

  it('opens the editable canvas when registering the first odontogram', async () => {
    const user = userEvent.setup();
    render(<OdontogramDashboard patientUuid="patient-uuid" />);

    await user.click(screen.getByRole('button', { name: /registrar odontograma inicial/i }));

    expect(screen.getByTestId('odontogram-canvas')).toHaveAttribute('data-read-only', 'false');
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeEnabled();
    expect(screen.queryByText(/no hay odontograma inicial registrado/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /editar en pantalla completa/i }));

    expect(mockLaunchWorkspace).toHaveBeenCalledWith(
      'odontologia-odontogram-form-workspace',
      expect.objectContaining({ patientUuid: 'patient-uuid', workspaceMode: 'base' }),
    );
  });
});
