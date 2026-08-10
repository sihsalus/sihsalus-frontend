import { useLaunchWorkspaceRequiringVisit } from '@openmrs/esm-patient-common-lib';
import { UserHasAccess } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';

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
  beforeEach(() => {
    vi.mocked(UserHasAccess).mockImplementation(({ children }: { children?: ReactNode }) => children);
  });

  it('renders as a patient actions menu item and launches the request workspace', async () => {
    const user = userEvent.setup();
    const launchWorkspace = vi.fn();
    mockUseLaunchWorkspaceRequiringVisit.mockReturnValue(launchWorkspace);

    render(<RequestInterconsultaActionButton closeMenu={vi.fn()} />);

    await user.click(screen.getByRole('menuitem', { name: /solicitar interconsulta/i }));

    expect(mockUseLaunchWorkspaceRequiringVisit).toHaveBeenCalledWith('request-interconsulta-workspace');
    expect(launchWorkspace).toHaveBeenCalled();
  });

  it('is hidden without the chart edit privilege', () => {
    vi.mocked(UserHasAccess).mockImplementation(({ fallback }: { fallback?: ReactNode }) => fallback);
    mockUseLaunchWorkspaceRequiringVisit.mockReturnValue(vi.fn());

    render(<RequestInterconsultaActionButton closeMenu={vi.fn()} />);

    expect(screen.queryByRole('menuitem', { name: /solicitar interconsulta/i })).not.toBeInTheDocument();
  });
});
