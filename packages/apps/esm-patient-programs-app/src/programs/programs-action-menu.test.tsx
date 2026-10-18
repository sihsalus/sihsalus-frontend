import { showModal, useLayoutType, userHasAccess } from '@openmrs/esm-framework';
import { launchPatientWorkspace } from '@openmrs/esm-patient-common-lib';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockPatient } from 'test-utils';
import { ProgramsActionMenu } from './programs-action-menu.component';

const mockShowModal = vi.mocked(showModal);
const mockUseLayoutType = vi.mocked(useLayoutType);
const mockLaunchPatientWorkspace = vi.mocked(launchPatientWorkspace);

vi.mock('@openmrs/esm-patient-common-lib', async () => {
  const originalModule = await vi.importActual('@openmrs/esm-patient-common-lib');

  return {
    ...originalModule,
    launchPatientWorkspace: vi.fn(),
  };
});

const testProps = {
  programEnrollmentId: '123',
  patientUuid: mockPatient.id,
};

const renderProgramActionsMenu = () => {
  return render(
    <ProgramsActionMenu patientUuid={testProps.patientUuid} programEnrollmentId={testProps.programEnrollmentId} />,
  );
};

describe('ProgramActionsMenu', () => {
  beforeEach(() => {
    mockUseLayoutType.mockReturnValue('small-desktop'); // or 'large-desktop' or 'tablet'
  });

  it('does not show actions without editing privileges', () => {
    vi.mocked(userHasAccess).mockReturnValue(false);
    renderProgramActionsMenu();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it.each(['Edit', 'Delete'])('only offers the authorized %s action', async (action) => {
    vi.mocked(userHasAccess).mockImplementation((privileges) => privileges.includes(`${action} Patient Programs`));
    renderProgramActionsMenu();
    await userEvent.setup().click(screen.getByRole('button'));
    // Carbon's floating-menu position is not laid out in happy-dom. Exercise
    // the permitted action, while asserting the denied item is not mounted.
    expect(screen.getByText(action)).toBeInTheDocument();
    expect(screen.queryByText(action === 'Edit' ? 'Delete' : 'Edit')).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByText(action));
    expect(action === 'Edit' ? mockLaunchPatientWorkspace : mockShowModal).toHaveBeenCalled();
  });

  it('renders an overflow menu with edit and delete actions', async () => {
    const user = userEvent.setup();
    renderProgramActionsMenu();

    const overflowMenuButton = screen.getByRole('button', { name: /options/i });
    await user.click(overflowMenuButton);

    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('Delete')).toBeInTheDocument();
    });
  });

  it('launches edit program form when edit button is clicked', async () => {
    const user = userEvent.setup();
    renderProgramActionsMenu();
    await user.click(screen.getByRole('button'));
    await user.click(screen.getByText('Edit'));

    expect(mockLaunchPatientWorkspace).toHaveBeenCalledWith('programs-form-workspace', {
      programEnrollmentId: testProps.programEnrollmentId,
      workspaceTitle: 'Edit program enrollment',
    });
  });

  it('launches delete program dialog when delete option is clicked', async () => {
    const user = userEvent.setup();
    renderProgramActionsMenu();

    await user.click(screen.getByRole('button'));
    await user.click(screen.getByText('Delete'));

    expect(mockShowModal).toHaveBeenCalledWith('program-delete-confirmation-modal', {
      closeDeleteModal: expect.any(Function),
      patientUuid: testProps.patientUuid,
      programEnrollmentId: testProps.programEnrollmentId,
      size: 'sm',
    });
  });
});

beforeEach(() => {
  vi.mocked(userHasAccess).mockReturnValue(true);
});
