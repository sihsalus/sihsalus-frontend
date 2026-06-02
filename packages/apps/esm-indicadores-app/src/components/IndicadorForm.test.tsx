import { act, fireEvent, render, screen } from '@testing-library/react';
import IndicadorForm from './IndicadorForm';
import type { IndicadorUpdatePayload } from '../api/types';

describe('IndicadorForm activo toggle', () => {
  const editInitialMetadata: Pick<IndicadorUpdatePayload, 'nombre' | 'descripcion' | 'activo'> = {
    nombre: 'Indicador de prueba',
    descripcion: 'Descripción de prueba',
    activo: true,
  };

  it('renders activo Toggle in edit mode', () => {
    render(
      <IndicadorForm
        mode="edit"
        initialMetadata={editInitialMetadata}
        onSubmit={vi.fn()}
      />,
    );

    // The Toggle switch should have accessible name "Activo"
    const toggle = screen.getByRole('switch', { name: 'Activo' });
    expect(toggle).toBeInTheDocument();
    expect(toggle).toBeChecked();
  });

  it('does NOT render activo Toggle in create mode', () => {
    render(<IndicadorForm mode="create" onSubmit={vi.fn()} />);

    expect(screen.queryByRole('switch', { name: 'Activo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: 'Inactivo' })).not.toBeInTheDocument();
  });

  it('renders Toggle as unchecked when initialMetadata.activo is false', () => {
    render(
      <IndicadorForm
        mode="edit"
        initialMetadata={{ ...editInitialMetadata, activo: false }}
        onSubmit={vi.fn()}
      />,
    );

    const toggle = screen.getByRole('switch', { name: 'Inactivo' });
    expect(toggle).toBeInTheDocument();
    expect(toggle).not.toBeChecked();
  });

  it('includes activo in submitted metadata when form is submitted in edit mode', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <IndicadorForm
        mode="edit"
        initialMetadata={editInitialMetadata}
        onSubmit={onSubmit}
      />,
    );

    const submitButton = screen.getByRole('button', { name: 'Guardar' });
    await act(async () => {
      fireEvent.click(submitButton);
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const submittedPayload = onSubmit.mock.calls[0][0];
    expect(submittedPayload.metadata).toMatchObject({
      nombre: 'Indicador de prueba',
      descripcion: 'Descripción de prueba',
      activo: true,
    });
    // Edit mode should NOT include definicion
    expect(submittedPayload.definicion).toBeUndefined();
  });

  it('includes toggled-off activo in submitted metadata when user toggles before submit', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <IndicadorForm
        mode="edit"
        initialMetadata={editInitialMetadata}
        onSubmit={onSubmit}
      />,
    );

    // Toggle activo off
    const toggle = screen.getByRole('switch', { name: 'Activo' });
    await act(async () => {
      fireEvent.click(toggle);
    });

    // Now submit
    const submitButton = screen.getByRole('button', { name: 'Guardar' });
    await act(async () => {
      fireEvent.click(submitButton);
    });

    const submittedPayload = onSubmit.mock.calls[0][0];
    expect(submittedPayload.metadata.activo).toBe(false);
  });
});
