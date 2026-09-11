import { showSnackbar } from '@openmrs/esm-framework';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as api from '../../api';
import DeleteRequestModal from './delete-request.modal';

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

describe('DeleteRequestModal', () => {
  const closeDeleteModal = vi.fn();
  const mutateMock = vi.fn();
  const requestId = 1;
  const patientUuid = 'patient-uuid-123';

  const setup = () => {
    (api.useRequestsByPatient as vi.Mock).mockReturnValue({
      mutate: mutateMock,
    });
    render(<DeleteRequestModal closeDeleteModal={closeDeleteModal} requestId={requestId} patientUuid={patientUuid} />);
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal with confirmation text and buttons', () => {
    setup();
    expect(screen.getByText(/Delete requested procedure/i)).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to delete this requested procdure?/i)).toBeInTheDocument();

    // check buttons using role (avoids text collision)
    expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Delete/i })).toBeInTheDocument();
  });

  it('closes modal when cancel button is clicked', () => {
    setup();
    fireEvent.click(screen.getByText(/Cancel/i));
    expect(closeDeleteModal).toHaveBeenCalled();
  });

  it('calls deleteRequest and shows success snackbar on success', async () => {
    (api.deleteRequest as vi.Mock).mockResolvedValueOnce({ ok: true });

    setup();

    const deleteButton = screen.getByRole('button', { name: /Delete/i });
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(api.deleteRequest).toHaveBeenCalledWith(requestId, expect.any(AbortController));
      expect(mutateMock).toHaveBeenCalled();
      expect(closeDeleteModal).toHaveBeenCalled();
      expect(showSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({
          isLowContrast: true,
          kind: 'success',
          title: 'Request deleted',
        }),
      );
    });
  });

  it('shows error snackbar on delete failure', async () => {
    const errorMessage = 'An error occurred while deleting the requested procedure';
    (api.deleteRequest as vi.Mock).mockRejectedValueOnce(new Error(errorMessage));

    setup();

    const deleteButton = screen.getByRole('button', { name: /Delete/i });
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(api.deleteRequest).toHaveBeenCalledWith(requestId, expect.any(AbortController));
      expect(mutateMock).not.toHaveBeenCalled();
      expect(closeDeleteModal).not.toHaveBeenCalled();
      expect(showSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({
          isLowContrast: false,
          kind: 'error',
          title: 'An error occurred while deleting the requested procedure',
          subtitle: 'The operation could not be completed. Refresh and check the result before trying again.',
        }),
      );
    });
  });

  it('shows loading state while deleting', async () => {
    let resolveDelete: ((val: { ok: boolean }) => void) | undefined;

    (api.deleteRequest as vi.Mock).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveDelete = resolve; // capture resolver
        }),
    );

    setup();

    const deleteButton = screen.getByRole('button', { name: /Delete/i });
    fireEvent.click(deleteButton);

    expect(await screen.findByText(/Deleting/i)).toBeInTheDocument();
    expect(deleteButton).toBeDisabled();

    await act(async () => {
      resolveDelete?.({ ok: true });
    });
  });
  it('allows a retry after a failed delete and does not expose the exception', async () => {
    vi.mocked(api.deleteRequest).mockRejectedValueOnce(new Error('sensitive-backend-detail'));
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
