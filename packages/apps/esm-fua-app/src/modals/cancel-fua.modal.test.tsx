import { showSnackbar } from '@openmrs/esm-framework';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { cancelFuaRequest } from '../hooks/useFuaRequests';

import CancelFuaModal from './cancel-fua.modal';

vi.mock('../hooks/useFuaRequests', () => ({
  cancelFuaRequest: vi.fn(),
}));
vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  showSnackbar: vi.fn(),
}));

const mockFua = {
  uuid: 'fua-uuid',
  id: 5,
  visitUuid: 'visit-uuid',
  name: 'FUA Pediatría',
  payload: '{}',
  fuaEstado: { uuid: 'e-1', id: 1, nombre: 'Pendiente' },
  fechaCreacion: Date.now(),
  fechaActualizacion: Date.now(),
};

describe('CancelFuaModal', () => {
  const closeModal = vi.fn();
  const onCancelled = vi.fn();

  beforeEach(() => vi.clearAllMocks());

  it('renders the FUA name', () => {
    render(<CancelFuaModal closeModal={closeModal} fuaRequest={mockFua} onCancelled={onCancelled} />);
    expect(screen.getByText('FUA Pediatría')).toBeInTheDocument();
  });

  it('disables confirm button until comment is entered', () => {
    render(<CancelFuaModal closeModal={closeModal} fuaRequest={mockFua} onCancelled={onCancelled} />);
    expect(screen.getByRole('button', { name: /confirmar cancelación/i })).toBeDisabled();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Registro duplicado' } });
    expect(screen.getByRole('button', { name: /confirmar cancelación/i })).toBeEnabled();
  });

  it('calls cancelFuaRequest with fuaId and comment', async () => {
    (cancelFuaRequest as vi.Mock).mockResolvedValueOnce({});
    render(<CancelFuaModal closeModal={closeModal} fuaRequest={mockFua} onCancelled={onCancelled} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Registro duplicado' } });
    fireEvent.click(screen.getByRole('button', { name: /confirmar cancelación/i }));

    await waitFor(() =>
      expect(cancelFuaRequest).toHaveBeenCalledWith(5, 'Registro duplicado', expect.any(AbortController)),
    );
    await waitFor(() => expect(onCancelled).toHaveBeenCalled());
    await waitFor(() => expect(closeModal).toHaveBeenCalled());
  });

  it('shows error snackbar when cancelFuaRequest fails', async () => {
    (cancelFuaRequest as vi.Mock).mockRejectedValueOnce(new Error('Error'));
    render(<CancelFuaModal closeModal={closeModal} fuaRequest={mockFua} onCancelled={onCancelled} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Motivo' } });
    fireEvent.click(screen.getByRole('button', { name: /confirmar cancelación/i }));

    await waitFor(() => expect(showSnackbar).toHaveBeenCalledWith(expect.objectContaining({ kind: 'error' })));
    await waitFor(() => expect(closeModal).not.toHaveBeenCalled());
  });

  it('closes modal when "Volver" is clicked', () => {
    render(<CancelFuaModal closeModal={closeModal} fuaRequest={mockFua} onCancelled={onCancelled} />);
    fireEvent.click(screen.getByText('Volver'));
    expect(closeModal).toHaveBeenCalled();
  });
});
