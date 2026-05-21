import { showSnackbar } from '@openmrs/esm-framework';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { setFuaEstado } from '../hooks/useFuaRequests';

import ChangeFuaStatusModal, { FUA_ESTADOS } from './change-fua-status.modal';

vi.mock('../hooks/useFuaRequests', () => ({
  setFuaEstado: vi.fn(),
}));
vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  showSnackbar: vi.fn(),
}));

const mockFuaPendiente = {
  uuid: 'fua-1',
  id: 1,
  visitUuid: 'visit-1',
  name: 'FUA Test',
  payload: '{}',
  fuaEstado: { uuid: 'e-1', id: 1, nombre: 'Pendiente' },
  fechaCreacion: Date.now(),
  fechaActualizacion: Date.now(),
};

const mockFuaEnviado = {
  ...mockFuaPendiente,
  fuaEstado: { uuid: 'e-4', id: 4, nombre: 'Enviado a SETI-SIS' },
};

const mockFuaRechazado = {
  ...mockFuaPendiente,
  fuaEstado: { uuid: 'e-5', id: 5, nombre: 'Rechazado' },
};

const mockFuaCancelado = {
  ...mockFuaPendiente,
  fuaEstado: { uuid: 'e-6', id: 6, nombre: 'Cancelado' },
};

describe('FUA_ESTADOS', () => {
  it('has all 6 states including CANCELADO', () => {
    expect(FUA_ESTADOS.PENDIENTE.id).toBe(1);
    expect(FUA_ESTADOS.EN_PROCESO.id).toBe(2);
    expect(FUA_ESTADOS.COMPLETADO.id).toBe(3);
    expect(FUA_ESTADOS.ENVIADO.id).toBe(4);
    expect(FUA_ESTADOS.RECHAZADO.id).toBe(5);
    expect(FUA_ESTADOS.CANCELADO.id).toBe(6);
  });
});

describe('ChangeFuaStatusModal — transitions', () => {
  const closeModal = vi.fn();
  const onStatusChanged = vi.fn();

  beforeEach(() => vi.clearAllMocks());

  it('shows EN_PROCESO and CANCELADO as options from PENDIENTE', () => {
    render(
      <ChangeFuaStatusModal closeModal={closeModal} fuaRequest={mockFuaPendiente} onStatusChanged={onStatusChanged} />,
    );
    const options = screen.getAllByRole('option').map((o) => o.textContent);
    expect(options).toContain('En Proceso');
    expect(options).toContain('Cancelado');
    expect(options).not.toContain('Completado');
    expect(options).not.toContain('Enviado a SETI-SIS');
  });

  it('shows RECHAZADO as option from ENVIADO (SETI-SIS rejection)', () => {
    render(
      <ChangeFuaStatusModal closeModal={closeModal} fuaRequest={mockFuaEnviado} onStatusChanged={onStatusChanged} />,
    );
    const options = screen.getAllByRole('option').map((o) => o.textContent);
    expect(options).toContain('Rechazado');
  });

  it('shows PENDIENTE as option from RECHAZADO (correction flow)', () => {
    render(
      <ChangeFuaStatusModal closeModal={closeModal} fuaRequest={mockFuaRechazado} onStatusChanged={onStatusChanged} />,
    );
    const options = screen.getAllByRole('option').map((o) => o.textContent);
    expect(options).toContain('Pendiente');
  });

  it('shows no transitions for CANCELADO (final state)', () => {
    render(
      <ChangeFuaStatusModal closeModal={closeModal} fuaRequest={mockFuaCancelado} onStatusChanged={onStatusChanged} />,
    );
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('calls setFuaEstado with selected estado and calls onStatusChanged', async () => {
    (setFuaEstado as vi.Mock).mockResolvedValueOnce({ data: {} });

    render(
      <ChangeFuaStatusModal closeModal={closeModal} fuaRequest={mockFuaPendiente} onStatusChanged={onStatusChanged} />,
    );

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '2' } }); // En Proceso
    fireEvent.click(screen.getByText('Guardar'));

    await waitFor(() => expect(setFuaEstado).toHaveBeenCalledWith(1, 2, expect.any(AbortController)));
    await waitFor(() => expect(onStatusChanged).toHaveBeenCalled());
    await waitFor(() => expect(closeModal).toHaveBeenCalled());
  });

  it('shows error snackbar when setFuaEstado fails', async () => {
    (setFuaEstado as vi.Mock).mockRejectedValueOnce(new Error('Network error'));

    render(
      <ChangeFuaStatusModal closeModal={closeModal} fuaRequest={mockFuaPendiente} onStatusChanged={onStatusChanged} />,
    );

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '2' } });
    fireEvent.click(screen.getByText('Guardar'));

    await waitFor(() => expect(showSnackbar).toHaveBeenCalledWith(expect.objectContaining({ kind: 'error' })));
    await waitFor(() => expect(closeModal).not.toHaveBeenCalled());
  });
});
