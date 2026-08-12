import {
  getUserFacingErrorMessage,
  showSnackbar,
  userHasAccess,
  useConnectivity,
  useSession,
} from '@openmrs/esm-framework';
import { fetchFreshPatientVitalStatus, launchPatientWorkspace } from '@openmrs/esm-patient-common-lib';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockPatient } from 'test-utils';

import StartVisitButton from './start-visit-button.component';

const mockLaunchPatientWorkspace = vi.mocked(launchPatientWorkspace);
const mockFetchFreshPatientVitalStatus = vi.mocked(fetchFreshPatientVitalStatus);
const mockGetUserFacingErrorMessage = vi.mocked(getUserFacingErrorMessage);
const mockUseSession = vi.mocked(useSession);
const mockUseConnectivity = vi.mocked(useConnectivity);
const mockUserHasAccess = vi.mocked(userHasAccess);

vi.mock('@openmrs/esm-patient-common-lib', async () => ({
  ...(await vi.importActual('@openmrs/esm-patient-common-lib')),
  fetchFreshPatientVitalStatus: vi.fn(),
  launchPatientWorkspace: vi.fn(),
}));

describe('StartVisitButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseConnectivity.mockReturnValue(true);
    mockFetchFreshPatientVitalStatus.mockResolvedValue({ dead: false, deathDate: null, isDeceased: false });
    mockUseSession.mockReturnValue({
      user: {
        privileges: [{ display: 'app:hoja.clinica' }, { display: 'Add Visits' }],
      },
    } as ReturnType<typeof useSession>);
    mockUserHasAccess.mockImplementation(
      (privilege) => typeof privilege === 'string' && ['app:hoja.clinica', 'Add Visits'].includes(privilege),
    );
  });

  it('renders the start visit button', () => {
    render(<StartVisitButton patientUuid={mockPatient.id} />);

    expect(screen.getByRole('button', { name: /start visit/i })).toBeInTheDocument();
  });

  it('clicking the button launches the start visit form', async () => {
    const user = userEvent.setup();

    render(<StartVisitButton patientUuid={mockPatient.id} />);

    const startVisitButton = screen.getByRole('button', { name: /start visit/i });
    await user.click(startVisitButton);

    expect(mockLaunchPatientWorkspace).toHaveBeenCalledTimes(1);
    expect(mockLaunchPatientWorkspace).toHaveBeenCalledWith('start-visit-workspace-form', {
      patientUuid: mockPatient.id,
      openedFrom: 'patient-chart-start-visit',
      showPatientHeader: true,
    });
  });

  it('does not launch the patient-search visit form when a fresh check says the patient died', async () => {
    const user = userEvent.setup();
    mockFetchFreshPatientVitalStatus.mockResolvedValue({
      dead: true,
      deathDate: '2026-08-12T15:41:28.000Z',
      isDeceased: true,
    });

    render(<StartVisitButton patientUuid={mockPatient.id} />);
    await user.click(screen.getByRole('button', { name: /start visit/i }));

    expect(mockFetchFreshPatientVitalStatus).toHaveBeenCalledWith(mockPatient.id);
    expect(mockLaunchPatientWorkspace).not.toHaveBeenCalled();
    expect(mockGetUserFacingErrorMessage).not.toHaveBeenCalled();
    expect(showSnackbar).toHaveBeenCalledWith({
      isLowContrast: false,
      kind: 'error',
      title: 'Error starting visit',
      subtitle: 'No se puede iniciar una consulta para un paciente fallecido.',
    });
  });

  it('shows a safe fallback and does not launch when the fresh vital-status check fails', async () => {
    const user = userEvent.setup();
    const technicalError = new Error('backend implementation details');
    mockFetchFreshPatientVitalStatus.mockRejectedValue(technicalError);

    render(<StartVisitButton patientUuid={mockPatient.id} />);
    await user.click(screen.getByRole('button', { name: /start visit/i }));

    expect(mockLaunchPatientWorkspace).not.toHaveBeenCalled();
    expect(mockGetUserFacingErrorMessage).toHaveBeenCalledWith(
      technicalError,
      'No se pudo verificar el estado vital. Intente nuevamente antes de iniciar la consulta.',
      { logContext: 'Launch start visit workspace' },
    );
    expect(showSnackbar).toHaveBeenCalledWith({
      isLowContrast: false,
      kind: 'error',
      title: 'Error starting visit',
      subtitle: 'No se pudo verificar el estado vital. Intente nuevamente antes de iniciar la consulta.',
    });
  });

  it('keeps the existing offline form launch so cached death status can be evaluated in the form', async () => {
    const user = userEvent.setup();
    mockUseConnectivity.mockReturnValue(false);

    render(<StartVisitButton patientUuid={mockPatient.id} />);
    await user.click(screen.getByRole('button', { name: /start visit/i }));

    expect(mockFetchFreshPatientVitalStatus).not.toHaveBeenCalled();
    expect(mockLaunchPatientWorkspace).toHaveBeenCalledOnce();
  });

  it('does not render the start visit button without ADT or visit edit privileges', () => {
    mockUserHasAccess.mockReturnValue(false);

    render(<StartVisitButton patientUuid={mockPatient.id} />);

    expect(screen.queryByRole('button', { name: /start visit/i })).not.toBeInTheDocument();
  });

  it('does not render the manual start action for admission', () => {
    mockUserHasAccess.mockImplementation(
      (privilege) => typeof privilege === 'string' && ['app:home.admision', 'Add Visits'].includes(privilege),
    );

    render(<StartVisitButton patientUuid={mockPatient.id} />);

    expect(screen.queryByRole('button', { name: /start visit/i })).not.toBeInTheDocument();
  });
});
