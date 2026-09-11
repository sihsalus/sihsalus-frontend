import { showSnackbar } from '@openmrs/esm-framework';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as api from '../../api';
import DeleteSeriesModal from './delete-series.modal';

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

describe('DeleteSeriesModal', () => {
  const closeDeleteModal = vi.fn();
  const mutateMock = vi.fn();
  const studyId = 1;
  const patientUuid = 'patient-uuid-123';

  const setup = () => {
    (api.useStudySeries as vi.Mock).mockReturnValue({
      mutate: mutateMock,
    });
    render(
      <DeleteSeriesModal
        closeDeleteModal={closeDeleteModal}
        studyId={studyId}
        orthancSeriesUID="series-123"
        patientUuid={patientUuid}
      />,
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal with confirmation text and buttons', () => {
    setup();
    expect(screen.getByText('Delete study series')).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to delete this study series?')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('closes modal when cancel button is clicked', () => {
    setup();
    fireEvent.click(screen.getByText('Cancel'));
    expect(closeDeleteModal).toHaveBeenCalled();
  });

  it('calls deleteSeries and shows success snackbar on success', async () => {
    (api.deleteSeries as vi.Mock).mockResolvedValueOnce({ ok: true });
    (api.useStudySeries as vi.Mock).mockReturnValue({ mutate: mutateMock });

    setup();
    fireEvent.click(screen.getByText('Delete'));

    await waitFor(() => {
      expect(api.deleteSeries).toHaveBeenCalledWith('series-123', 1, expect.any(AbortController));
      expect(mutateMock).toHaveBeenCalled();
      expect(closeDeleteModal).toHaveBeenCalled();
      expect(showSnackbar).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' }));
    });
  });

  it('shows error snackbar when delete fails', async () => {
    (api.deleteSeries as vi.Mock).mockRejectedValueOnce(new Error('An error occurred while deleting the study series'));

    setup();
    fireEvent.click(screen.getByText('Delete'));

    await waitFor(() => {
      expect(showSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'error',
          subtitle: 'The operation could not be completed. Refresh and check the result before trying again.',
        }),
      );
    });
  });

  it('disables delete button and shows loading while deleting', async () => {
    let resolveFn: (val: { ok: boolean }) => void;
    (api.deleteSeries as vi.Mock).mockImplementationOnce(() => new Promise((resolve) => (resolveFn = resolve)));

    setup();
    fireEvent.click(screen.getByText('Delete'));

    // Delete button should now show inline loader
    expect(screen.getByText('Deleting...')).toBeInTheDocument();

    // The button may now be labeled differently (with loader)
    const deleteButton = screen.getByRole('button', { name: /deleting/i });
    expect(deleteButton).toBeDisabled();

    // Resolve the promise so the flow continues
    resolveFn!({ ok: true });

    await waitFor(() => {
      expect(showSnackbar).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' }));
    });
  });
  it('allows a retry after a failed delete and does not expose the exception', async () => {
    vi.mocked(api.deleteSeries).mockRejectedValueOnce(new Error('sensitive-backend-detail'));
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled());
    expect(showSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'error',
        subtitle: 'The operation could not be completed. Refresh and check the result before trying again.',
      }),
    );
  });
});

vi.mock('../utils/use-imaging-access', () => ({ useImagingAccess: vi.fn(() => ({ canWrite: true, isOnline: true })) }));
