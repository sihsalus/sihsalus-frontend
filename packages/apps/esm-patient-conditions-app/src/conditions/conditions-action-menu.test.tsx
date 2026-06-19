import { showModal, useLayoutType, userHasAccess, useSession } from '@openmrs/esm-framework';
import { launchPatientWorkspace } from '@openmrs/esm-patient-common-lib';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type Condition } from './conditions.resource';
import { ConditionsActionMenu } from './conditions-action-menu.component';

vi.mock('@openmrs/esm-patient-common-lib', async () => ({
  ...(await vi.importActual('@openmrs/esm-patient-common-lib')),
  launchPatientWorkspace: vi.fn(),
}));

const mockLaunchPatientWorkspace = vi.mocked(launchPatientWorkspace);
const mockShowModal = vi.mocked(showModal);
const mockUseLayoutType = vi.mocked(useLayoutType);
const mockUserHasAccess = vi.mocked(userHasAccess);
const mockUseSession = vi.mocked(useSession);

vi.mock('@openmrs/esm-framework', async () => {
  const actual = await vi.importActual<typeof import('@openmrs/esm-framework')>('@openmrs/esm-framework');

  return {
    ...actual,
    useLayoutType: vi.fn(),
    useSession: vi.fn(),
    userHasAccess: vi.fn(),
  };
});

const mockCondition: Condition = {
  clinicalStatus: 'active',
  conceptId: 'test-concept-id',
  display: 'Test Condition',
  onsetDateTime: '2023-01-15',
  recordedDate: '2023-01-15',
  id: 'test-condition-id',
};

const defaultProps = {
  condition: mockCondition,
  patientUuid: 'test-patient-uuid',
};

const renderConditionsActionMenu = () => {
  return render(<ConditionsActionMenu {...defaultProps} />);
};

describe('ConditionsActionMenu', () => {
  beforeEach(() => {
    mockUseLayoutType.mockReturnValue('small-desktop');
    mockUseSession.mockReturnValue({
      user: {
        uuid: 'mock-user-uuid',
        display: 'Mock User',
      },
    } as never);
    mockUserHasAccess.mockReturnValue(true);
  });

  it('renders an action menu button', () => {
    renderConditionsActionMenu();

    const menuButton = screen.getByRole('button');
    expect(menuButton).toBeInTheDocument();
  });

  it('shows menu items only when menu is opened', async () => {
    const user = userEvent.setup();
    renderConditionsActionMenu();

    // Menu items should not be visible initially
    expect(screen.queryByText('Edit')).not.toBeInTheDocument();
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();

    // Open menu
    const menuButton = screen.getByRole('button');
    await user.click(menuButton);

    // Menu items should now be visible
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('opens edit form with the specific condition when Edit button is clicked', async () => {
    const user = userEvent.setup();
    const specificCondition: Condition = {
      clinicalStatus: 'active',
      conceptId: 'hypertension-concept-id',
      display: 'Hypertension',
      onsetDateTime: '2022-03-10',
      recordedDate: '2022-03-10',
      id: 'hypertension-condition-id',
    };

    render(<ConditionsActionMenu condition={specificCondition} patientUuid="patient-123" />);

    await user.click(screen.getByRole('button'));
    await user.click(screen.getByText('Edit'));

    expect(mockLaunchPatientWorkspace).toHaveBeenCalledWith('conditions-form-workspace', {
      workspaceTitle: 'Edit antecedent',
      condition: specificCondition,
      formContext: 'editing',
    });
  });

  it('opens delete confirmation modal with condition ID when Delete button is clicked', async () => {
    const user = userEvent.setup();
    renderConditionsActionMenu();

    await user.click(screen.getByRole('button'));
    await user.click(screen.getByText('Delete'));

    expect(mockShowModal).toHaveBeenCalledWith('condition-delete-confirmation-dialog', {
      closeDeleteModal: expect.any(Function),
      conditionId: mockCondition.id,
      patientUuid: defaultProps.patientUuid,
    });
  });
});
