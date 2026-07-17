import { act, fireEvent, render, screen } from '@testing-library/react';
import type { IndicadorUpdatePayload } from '../api/types';
import IndicadorForm from './IndicadorForm';

describe('IndicadorForm metadata contract', () => {
  const editInitialMetadata: Pick<IndicadorUpdatePayload, 'nombre' | 'descripcion'> = {
    nombre: 'Indicador de prueba',
    descripcion: 'Descripción de prueba',
  };

  it('does not render an unsupported activo toggle in edit mode', () => {
    render(<IndicadorForm mode="edit" initialMetadata={editInitialMetadata} onSubmit={vi.fn()} />);

    expect(screen.queryByRole('switch', { name: /activo|inactivo/i })).not.toBeInTheDocument();
  });

  it('does NOT render activo Toggle in create mode', () => {
    render(<IndicadorForm mode="create" onSubmit={vi.fn()} />);

    expect(screen.queryByRole('switch', { name: 'Activo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: 'Inactivo' })).not.toBeInTheDocument();
  });

  it('submits only metadata supported by PUT /indicadores/:id', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(<IndicadorForm mode="edit" initialMetadata={editInitialMetadata} onSubmit={onSubmit} />);

    const submitButton = screen.getByRole('button', { name: 'Guardar' });
    await act(async () => {
      fireEvent.click(submitButton);
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const submittedPayload = onSubmit.mock.calls[0][0];
    expect(submittedPayload.metadata).toMatchObject({
      nombre: 'Indicador de prueba',
      descripcion: 'Descripción de prueba',
    });
    expect(submittedPayload.metadata).not.toHaveProperty('activo');
    // Edit mode should NOT include definicion
    expect(submittedPayload.definicion).toBeUndefined();
  });
});

describe('IndicadorForm periodo removal', () => {
  it('does NOT render periodo Select in create mode', () => {
    render(<IndicadorForm mode="create" onSubmit={vi.fn()} />);

    // The "Periodo" label should not appear anywhere in the form
    expect(screen.queryByText('Periodo')).not.toBeInTheDocument();
    // The periodo select items from the legacy UI should not be present
    expect(screen.queryByText('Mes actual')).not.toBeInTheDocument();
    expect(screen.queryByText('Trimestre actual')).not.toBeInTheDocument();
    expect(screen.queryByText('Semestre actual')).not.toBeInTheDocument();
    expect(screen.queryByText('Año actual')).not.toBeInTheDocument();
  });

  it('does NOT render periodo Select in version mode', () => {
    render(<IndicadorForm mode="version" initialMetadata={{ nombre: 'Test', descripcion: null }} onSubmit={vi.fn()} />);

    expect(screen.queryByText('Periodo')).not.toBeInTheDocument();
  });

  it('does NOT include periodo in built definicion when submitted', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(<IndicadorForm mode="create" onSubmit={onSubmit} />);

    const nombreInput = screen.getByLabelText('Nombre');
    await act(async () => {
      fireEvent.change(nombreInput, { target: { value: 'Test' } });
    });

    const submitButton = screen.getByRole('button', { name: 'Guardar' });
    await act(async () => {
      fireEvent.click(submitButton);
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const submittedPayload = onSubmit.mock.calls[0][0];
    // The definicion must NOT contain periodo
    expect(submittedPayload.definicion).toBeDefined();
    expect(submittedPayload.definicion).not.toHaveProperty('periodo');
    expect(submittedPayload.definicion.tipo).toBe('conteo_atenciones');
  });
});

describe('IndicadorForm reportes-sql contract', () => {
  it('omits an empty evento instead of sending null', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<IndicadorForm mode="create" onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Indicador sin filtros' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Guardar' })));

    expect(onSubmit.mock.calls[0][0].definicion).not.toHaveProperty('evento');
  });

  it('serializes each selected order as a concepto_uuid item', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <IndicadorForm
        mode="create"
        defaultValues={{
          nombre: 'Indicador con órdenes',
          filtroClinico: 'ordenes',
          selectedOrdenes: [
            { uuid: 'order-a', display: 'Orden A' },
            { uuid: 'order-b', display: 'Orden B' },
          ],
        }}
        onSubmit={onSubmit}
      />,
    );

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Guardar' })));

    expect(onSubmit.mock.calls[0][0].definicion.evento.ordenes).toEqual([
      { concepto_uuid: 'order-a' },
      { concepto_uuid: 'order-b' },
    ]);
  });

  it.each([
    ['mínima', 'Edad mínima años', 'Edad mínima meses'],
    ['máxima', 'Edad máxima años', 'Edad máxima días'],
  ])('rejects more than one unit for the %s age bound', async (_bound, firstLabel, secondLabel) => {
    const onSubmit = vi.fn();
    render(<IndicadorForm mode="create" defaultValues={{ nombre: 'Edad inválida' }} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(firstLabel), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText(secondLabel), { target: { value: '2' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Guardar' })));

    expect(screen.getByText(/una sola unidad/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rejects fractional and negative age values before calling the backend', async () => {
    const onSubmit = vi.fn();
    render(<IndicadorForm mode="create" defaultValues={{ nombre: 'Edad inválida' }} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Edad mínima días'), { target: { value: '-1' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Guardar' })));

    expect(screen.getByText(/enteros mayores o iguales a 0/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
