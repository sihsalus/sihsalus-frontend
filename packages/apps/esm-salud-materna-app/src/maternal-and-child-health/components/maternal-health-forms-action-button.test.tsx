import { ActionMenuButton } from '@openmrs/esm-framework';
import { useLaunchWorkspaceRequiringVisit } from '@openmrs/esm-patient-common-lib';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import MaternalHealthFormsActionButton from './maternal-health-forms-action-button.component';

const mockActionMenuButton = vi.mocked(ActionMenuButton);
const mockUseLaunchWorkspaceRequiringVisit = useLaunchWorkspaceRequiringVisit as vi.Mock;

mockActionMenuButton.mockImplementation(({ handler, label }) => (
  <button type="button" onClick={handler}>
    {label}
  </button>
));

vi.mock('@openmrs/esm-patient-common-lib', async () => {
  const originalModule = await vi.importActual('@openmrs/esm-patient-common-lib');

  return {
    ...originalModule,
    useLaunchWorkspaceRequiringVisit: vi.fn(),
  };
});

describe('MaternalHealthFormsActionButton', () => {
  it('launches the maternal health forms selector', async () => {
    const user = userEvent.setup();
    const launchWorkspace = vi.fn();
    mockUseLaunchWorkspaceRequiringVisit.mockReturnValue(launchWorkspace);

    render(<MaternalHealthFormsActionButton />);

    await user.click(screen.getByRole('button', { name: /formularios de salud materna/i }));

    expect(mockUseLaunchWorkspaceRequiringVisit).toHaveBeenCalledWith('maternal-health-forms-selector-workspace');
    expect(launchWorkspace).toHaveBeenCalled();
  });
});
