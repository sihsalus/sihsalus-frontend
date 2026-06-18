import { userHasAccess, useSession } from '@openmrs/esm-framework';
import { launchPatientWorkspace } from '@openmrs/esm-patient-common-lib';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockPatient } from 'test-utils';

import StartVisitButton from './start-visit-button.component';

const mockLaunchPatientWorkspace = vi.mocked(launchPatientWorkspace);
const mockUseSession = vi.mocked(useSession);
const mockUserHasAccess = vi.mocked(userHasAccess);

vi.mock('@openmrs/esm-patient-common-lib', async () => ({
  ...(await vi.importActual('@openmrs/esm-patient-common-lib')),
  launchPatientWorkspace: vi.fn(),
}));

describe('StartVisitButton', () => {
  beforeEach(() => {
    mockUseSession.mockReturnValue({
      user: {
        privileges: [{ display: 'app:adt' }],
      },
    } as ReturnType<typeof useSession>);
    mockUserHasAccess.mockImplementation((privilege) => privilege === 'app:adt');
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
    });
  });

  it('does not render the start visit button without ADT or visit edit privileges', () => {
    mockUserHasAccess.mockReturnValue(false);

    render(<StartVisitButton patientUuid={mockPatient.id} />);

    expect(screen.queryByRole('button', { name: /start visit/i })).not.toBeInTheDocument();
  });
});
