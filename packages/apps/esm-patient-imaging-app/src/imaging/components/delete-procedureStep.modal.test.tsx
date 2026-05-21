import { showSnackbar } from '@openmrs/esm-framework';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as api from '../../api';
import DeleteProcedureStepModal from './delete-procedureStep.modal';

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

describe('DeleteProcedureStepModal', () => {
  const closeDeleteModal = vi.fn();
  const mutateMock = vi.fn();
  const requestId = 1;
  const stepId = 1;

  const setup = () => {
    render(<DeleteProcedureStepModal closeDeleteModal={closeDeleteModal} requestId={requestId} stepId={stepId} />);
  };
  beforeEach(() => {
    vi.clearAllMocks();
    (api.useProcedureStep as vi.Mock).mockReturnValue({
      mutate: mutateMock,
    });
  });

  it('renders modal with correct text', () => {
    setup();

    expect(screen.getByText('Are you sure you want to delete this procedure step?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Delete/i })).toBeInTheDocument();
  });

  it('calls closeDeleteModal when cancel button is clicked', () => {
    setup();

    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(closeDeleteModal).toHaveBeenCalled();
  });

  it('calls deleteProcedureStep and shows success snackbar', async () => {
    (api.deleteProcedureStep as vi.Mock).mockResolvedValue({ ok: true });

    setup();

    fireEvent.click(screen.getByRole('button', { name: /Delete/i }));

    await waitFor(() => {
      expect(api.deleteProcedureStep).toHaveBeenCalledWith(stepId, expect.any(AbortController));
      expect(mutateMock).toHaveBeenCalled();
      expect(closeDeleteModal).toHaveBeenCalled();
      expect(showSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'success',
          title: 'Procedure step is deleted',
        }),
      );
    });
  });

  it('shows error snackbar when deleteProcedureStep fails', async () => {
    const errorMessage = new Error('An error occurred while deleting the procedure step');
    (api.deleteProcedureStep as vi.Mock).mockRejectedValueOnce(errorMessage);

    setup();

    fireEvent.click(screen.getByRole('button', { name: /Delete/i }));

    await waitFor(() => {
      expect(api.deleteProcedureStep).toHaveBeenCalledWith(stepId, expect.any(AbortController));
      expect(showSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({
          isLowContrast: false,
          kind: 'error',
          title: 'An error occurred while deleting the procedure step',
          subtitle: 'An error occurred while deleting the procedure step',
        }),
      );
      expect(closeDeleteModal).not.toHaveBeenCalled();
      expect(mutateMock).not.toHaveBeenCalled();
    });
  });

  it('disables delete button and shows loading state while deleting', async () => {
    let resolveDelete: (value?: unknown) => void;

    (api.deleteProcedureStep as vi.Mock).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveDelete = resolve;
      }),
    );

    setup();

    const deleteButton = screen.getByRole('button', { name: /Delete/i });
    fireEvent.click(deleteButton);

    expect(deleteButton).toBeDisabled();
    expect(screen.getByText('Deleting...')).toBeInTheDocument();

    act(() => {
      resolveDelete?.({ ok: true });
    });
  });
});
