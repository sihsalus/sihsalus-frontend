import { showSnackbar } from '@openmrs/esm-framework';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as api from '../../api';
import DeleteStudyModal from './delete-study.modal';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, defaultValue: string) => defaultValue,
  }),
}));

vi.mock('../../api');

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  showSnackbar: vi.fn(),
}));

describe('DeleteStudyModal', () => {
  const closeDeleteModal = vi.fn();
  const mutateMock = vi.fn();
  const patientUuid = 'patient-uuid-123';
  const studyId = 42;

  beforeEach(() => {
    vi.clearAllMocks();
    (api.useStudiesByPatient as vi.Mock).mockReturnValue({
      mutate: mutateMock,
    });
  });

  it('renders modal with default selected radio button', () => {
    render(<DeleteStudyModal closeDeleteModal={closeDeleteModal} studyId={studyId} patientUuid={patientUuid} />);

    expect(screen.getByText(/Delete the image study/i)).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to delete this study?/i)).toBeInTheDocument();
    const openmrsRadio = screen.getByLabelText(/From SIHSALUS/i) as HTMLInputElement;
    const bothRadio = screen.getByLabelText(/From Orthanc & SIHSALUS/i) as HTMLInputElement;

    expect(openmrsRadio.checked).toBe(true);
    expect(bothRadio.checked).toBe(false);
  });

  it('Calls deleteStudy, mutate, close modal and shows success snackbar on delete', async () => {
    (api.deleteStudy as vi.Mock).mockResolvedValue({ ok: true });

    render(<DeleteStudyModal closeDeleteModal={closeDeleteModal} studyId={studyId} patientUuid={patientUuid} />);
    fireEvent.click(screen.getByRole('button', { name: /Delete/i }));

    await waitFor(() => {
      expect(api.deleteStudy).toHaveBeenCalledWith(studyId, 'openmrs', expect.any(AbortController));
      expect(mutateMock).toHaveBeenCalled();
      expect(closeDeleteModal).toHaveBeenCalled();
      expect(showSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({
          isLowContrast: true,
          kind: 'success',
          title: 'Study is deleted',
        }),
      );
    });
  });

  it('shows error snackbar on delete failure', async () => {
    const errorMessage = 'Something went wrong';
    (api.deleteStudy as vi.Mock).mockRejectedValueOnce(new Error(errorMessage));

    render(<DeleteStudyModal closeDeleteModal={closeDeleteModal} studyId={studyId} patientUuid={patientUuid} />);
    fireEvent.click(screen.getByRole('button', { name: /Delete/i }));

    await waitFor(() => {
      expect(showSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({
          isLowContrast: false,
          kind: 'error',
          title: 'An error occurred while deleting the study',
          subtitle: errorMessage,
        }),
      );
    });
    expect(closeDeleteModal).not.toHaveBeenCalled();
  });

  it('updates selectedOption when radio button is changed', async () => {
    (api.deleteStudy as vi.Mock).mockResolvedValue({ ok: true });
    render(<DeleteStudyModal closeDeleteModal={closeDeleteModal} studyId={studyId} patientUuid={patientUuid} />);
    const bothRadio = screen.getByLabelText(/From Orthanc & SIHSALUS/i) as HTMLInputElement;
    fireEvent.click(bothRadio);
    expect(bothRadio.checked).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /Delete/i }));

    await waitFor(() => {
      expect(api.deleteStudy).toHaveBeenCalledWith(studyId, 'openmrsOrthanc', expect.any(AbortController));
    });
  });
});
