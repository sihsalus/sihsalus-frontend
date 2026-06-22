import { showSnackbar, useConfig, userHasAccess, useSession } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockPatient } from 'test-utils';
import { type ImmunizationConfigObject } from '../config-schema';
import { immunizationEditPrivilege, immunizationPrivilege } from '../constants';
import { deletePatientImmunization } from '../hooks/useImmunizations';
import DeleteImmunizationModal from './delete-immunization.modal';

const mockUseConfig = vi.mocked(useConfig<ImmunizationConfigObject>);
const mockUseSession = vi.mocked(useSession);
const mockUserHasAccess = vi.mocked(userHasAccess);

const sessionWithEditPrivilege = {
  authenticated: true,
  user: {
    privileges: [{ display: immunizationPrivilege }, { display: immunizationEditPrivilege }],
  },
} as unknown as ReturnType<typeof useSession>;

const sessionWithoutPrivileges = {
  authenticated: true,
  user: { privileges: [] },
} as unknown as ReturnType<typeof useSession>;

vi.mock('../hooks/useImmunizations', async () => ({
  ...(await vi.importActual('../hooks/useImmunizations')),
  deletePatientImmunization: vi.fn(),
  useImmunizations: vi.fn().mockReturnValue({ mutate: vi.fn() }),
}));

vi.mock('../hooks/useImmunizationsConceptSet', async () => ({
  useImmunizationsConceptSet: () => ({
    immunizationsConceptSet: {
      answers: [
        {
          uuid: '886AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
          display: 'Bacillus Calmette–Guérin vaccine',
        },
      ],
    },
  }),
}));

beforeEach(() => {
  mockUseSession.mockReturnValue(sessionWithEditPrivilege);
  mockUserHasAccess.mockReturnValue(true);
  return mockUseConfig.mockReturnValue({
    immunizationConceptSet: '',
    fhirConceptMappings: {
      immunizationResourceConcept: 'CIEL:1421',
    },
    sequenceDefinitions: [],
  });
});

const mockDeleteImmunization = vi.mocked(deletePatientImmunization);
const mockShowSnackbar = vi.mocked(showSnackbar);

const defaultProps = {
  close: vi.fn(),
  doseNumber: 1,
  immunizationId: 'de195ad6-0887-4b09-bd4a-6e37d7d8db63',
  patientUuid: mockPatient.uuid,
  vaccineUuid: '886AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
};

describe('DeleteImmunizationModal', () => {
  it('renders modal with correct elements', () => {
    render(<DeleteImmunizationModal {...defaultProps} />);
    expect(screen.getByRole('heading', { name: /delete immunization/i })).toBeInTheDocument();
    expect(
      screen.getByText(/are you sure you want to delete dose 1 of Bacillus Calmette–Guérin vaccine/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
  });

  it('clicking Cancel button closes modal', async () => {
    const user = userEvent.setup();
    render(<DeleteImmunizationModal {...defaultProps} />);
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);
    expect(defaultProps.close).toHaveBeenCalled();
  });

  it('clicking Delete button deletes immunization and shows success', async () => {
    const user = userEvent.setup();
    mockDeleteImmunization.mockResolvedValue();
    render(<DeleteImmunizationModal {...defaultProps} />);
    const deleteButton = screen.getByRole('button', { name: /delete/i });
    await user.click(deleteButton);

    expect(mockDeleteImmunization).toHaveBeenCalledWith(defaultProps.immunizationId, undefined);
    expect(mockDeleteImmunization).toHaveBeenCalledTimes(1);
    expect(mockShowSnackbar).toHaveBeenCalledWith({
      subtitle: 'Immunization dose deleted successfully',
      title: 'Immunization dose deleted',
    });
  });

  it('shows error when deletion fails', async () => {
    const user = userEvent.setup();
    const error = { message: 'Server error' };
    mockDeleteImmunization.mockRejectedValue(error);

    render(<DeleteImmunizationModal {...defaultProps} />);
    const deleteButton = screen.getByRole('button', { name: /delete/i });
    await user.click(deleteButton);

    expect(mockDeleteImmunization).toHaveBeenCalledWith(defaultProps.immunizationId, undefined);
    expect(mockShowSnackbar).toHaveBeenCalledWith({
      title: 'Error',
      subtitle: 'Failed to delete immunization: Server error',
      kind: 'error',
    });
  });

  it('closes without rendering when the user lacks the edit privilege', () => {
    mockUseSession.mockReturnValue(sessionWithoutPrivileges);
    mockUserHasAccess.mockReturnValue(false);
    const close = vi.fn();

    render(<DeleteImmunizationModal {...defaultProps} close={close} />);

    expect(screen.queryByRole('heading', { name: /delete immunization/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    expect(close).toHaveBeenCalled();
  });
});
