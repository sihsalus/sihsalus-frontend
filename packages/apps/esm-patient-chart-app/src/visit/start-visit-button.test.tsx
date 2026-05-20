import { launchPatientWorkspace } from '@openmrs/esm-patient-common-lib';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockPatient } from 'test-utils';

import StartVisitButton from './start-visit-button.component';

const mockLaunchPatientWorkspace = vi.mocked(launchPatientWorkspace);

vi.mock('@openmrs/esm-patient-common-lib', async () => ({
  ...(await vi.importActual('@openmrs/esm-patient-common-lib')),
  launchPatientWorkspace: vi.fn(),
}));

describe('StartVisitButton', () => {
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
});
