import { useLaunchWorkspaceRequiringVisit } from '@openmrs/esm-patient-common-lib';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import RequestInterconsultaActionButton from './request-interconsulta-action-button.component';

const mockUseLaunchWorkspaceRequiringVisit = vi.mocked(useLaunchWorkspaceRequiringVisit);

vi.mock('@openmrs/esm-patient-common-lib', async () => {
  const originalModule = await vi.importActual('@openmrs/esm-patient-common-lib');

  return {
    ...originalModule,
    useLaunchWorkspaceRequiringVisit: vi.fn(),
  };
});

describe('RequestInterconsultaActionButton', () => {
  it('renders as a patient actions menu item and launches the request workspace', async () => {
    const user = userEvent.setup();
    const launchWorkspace = vi.fn();
    mockUseLaunchWorkspaceRequiringVisit.mockReturnValue(launchWorkspace);

    render(<RequestInterconsultaActionButton closeMenu={vi.fn()} />);

    await user.click(screen.getByRole('menuitem', { name: /solicitar interconsulta/i }));

    expect(mockUseLaunchWorkspaceRequiringVisit).toHaveBeenCalledWith('request-interconsulta-workspace');
    expect(launchWorkspace).toHaveBeenCalled();
  });
});
