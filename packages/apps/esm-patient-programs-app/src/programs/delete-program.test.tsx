import { type FetchResponse, showSnackbar } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockPatient } from 'test-utils';
import DeleteProgramModal from './delete-program.modal';
import { mutatePatientProgramEnrollments } from './program-enrollment-cache';
import { deleteProgramEnrollment } from './programs.resource';

vi.mock('./programs.resource', () => ({
  deleteProgramEnrollment: vi.fn(),
}));

vi.mock('./program-enrollment-cache', () => ({
  mutatePatientProgramEnrollments: vi.fn(),
}));

const mockDeleteProgramEnrollment = vi.mocked(deleteProgramEnrollment);
const mockMutatePatientProgramEnrollments = vi.mocked(mutatePatientProgramEnrollments);
const mockShowSnackbar = vi.mocked(showSnackbar);

const testProps = {
  programEnrollmentId: '123',
  patientUuid: mockPatient.id,
};

const closeDeleteModalMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
});

const renderDeleteProgramModal = () => {
  return render(
    <DeleteProgramModal
      closeDeleteModal={closeDeleteModalMock}
      programEnrollmentId={testProps.programEnrollmentId}
      patientUuid={testProps.patientUuid}
    />,
  );
};

describe('DeleteProgramModal', () => {
  it('renders modal with delete confirmation text ', () => {
    renderDeleteProgramModal();

    expect(screen.getByRole('heading', { name: /delete program enrollment/i })).toBeInTheDocument();
    expect(screen.getByText(/are you sure you want to delete this program enrollment?/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
  });

  it('Calls closeDeleteModal when cancel button is clicked', async () => {
    const user = userEvent.setup();

    renderDeleteProgramModal();

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(closeDeleteModalMock).toHaveBeenCalled();
  });

  it('clicking the delete button deletes the program enrollment', async () => {
    const user = userEvent.setup();
    mockDeleteProgramEnrollment.mockResolvedValue({ ok: true } as unknown as FetchResponse);

    renderDeleteProgramModal();

    await user.click(screen.getByRole('button', { name: /confirm/i }));

    expect(mockDeleteProgramEnrollment).toHaveBeenCalledTimes(1);
    expect(mockDeleteProgramEnrollment).toHaveBeenCalledWith(testProps.programEnrollmentId);
    expect(mockMutatePatientProgramEnrollments).toHaveBeenCalledWith(mockPatient.id);
    expect(mockShowSnackbar).toHaveBeenCalledWith({
      isLowContrast: true,
      kind: 'success',
      title: expect.stringMatching(/program enrollment deleted/i),
    });
  });

  it('renders an error notification when the delete action fails', async () => {
    const user = userEvent.setup();
    mockDeleteProgramEnrollment.mockRejectedValue(new Error('Internal server error'));

    renderDeleteProgramModal();

    await user.click(screen.getByRole('button', { name: /confirm/i }));

    expect(mockDeleteProgramEnrollment).toHaveBeenCalledTimes(1);
    expect(mockDeleteProgramEnrollment).toHaveBeenCalledWith(testProps.programEnrollmentId);
    expect(mockMutatePatientProgramEnrollments).not.toHaveBeenCalled();
    expect(mockShowSnackbar).toHaveBeenCalledWith({
      isLowContrast: false,
      kind: 'error',
      title: expect.stringMatching(/error deleting program enrollment/i),
      subtitle: 'Internal server error',
    });
  });
});
