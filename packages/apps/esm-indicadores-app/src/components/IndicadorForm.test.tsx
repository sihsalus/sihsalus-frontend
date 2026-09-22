import { act, fireEvent, render, screen } from '@testing-library/react';
import type { IndicadorUpdatePayload } from '../api/types';
import IndicadorForm from './IndicadorForm';

vi.mock('../features/indicadores/hooks', async () => {
  const actual = await vi.importActual<typeof import('../features/indicadores/hooks')>('../features/indicadores/hooks');
  return {
    ...actual,
    useEncounterTypeSearch: vi.fn((query: string) => ({
      data: query.trim().toLowerCase().includes('cred') ? [{ uuid: 'enc-cred-neonato', display: 'CRED Neonato' }] : [],
      error: undefined,
      isLoading: false,
    })),
  };
});

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

  it('rejects min age greater than max age when both use the same unit', async () => {
    const onSubmit = vi.fn();
    render(<IndicadorForm mode="create" defaultValues={{ nombre: 'Rango invertido' }} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Edad mínima años'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Edad máxima años'), { target: { value: '5' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Guardar' })));

    expect(screen.getByText(/la edad mínima no puede ser mayor que la edad máxima/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rejects min age greater than max age across different units (months vs years)', async () => {
    const onSubmit = vi.fn();
    render(<IndicadorForm mode="create" defaultValues={{ nombre: 'Rango invertido mixto' }} onSubmit={onSubmit} />);

    // 72 months (≈2160 days) > 1 year (365 days) → inverted range
    fireEvent.change(screen.getByLabelText('Edad mínima meses'), { target: { value: '72' } });
    fireEvent.change(screen.getByLabelText('Edad máxima años'), { target: { value: '1' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Guardar' })));

    expect(screen.getByText(/la edad mínima no puede ser mayor que la edad máxima/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('accepts min age less than max age across different units (months vs years)', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<IndicadorForm mode="create" defaultValues={{ nombre: 'Rango válido mixto' }} onSubmit={onSubmit} />);

    // 6 months (≈180 days) < 6 years (2190 days) → valid
    fireEvent.change(screen.getByLabelText('Edad mínima meses'), { target: { value: '6' } });
    fireEvent.change(screen.getByLabelText('Edad máxima años'), { target: { value: '6' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Guardar' })));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/la edad mínima no puede ser mayor que la edad máxima/i)).not.toBeInTheDocument();
  });
});

describe('IndicadorForm conteo_pacientes_ventana contract', () => {
  it('serializes encounter types, min occurrences and the day window into the definicion', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <IndicadorForm
        mode="create"
        defaultValues={{
          nombre: 'CRED Neonato',
          tipo: 'conteo_pacientes_ventana',
          selectedEncounterTypes: [{ uuid: 'enc-cred', display: 'CRED Neonato' }],
        }}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(screen.getByLabelText('Mínimo de ocurrencias'), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('Edad máxima días'), { target: { value: '28' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Guardar' })));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0].definicion).toEqual({
      tipo: 'conteo_pacientes_ventana',
      evento: {
        minimo_ocurrencias: 4,
        encounter_type_uuids: ['enc-cred'],
      },
      poblacion: {
        min_anios: undefined,
        min_meses: undefined,
        min_dias: undefined,
        max_anios_excl: undefined,
        max_meses_excl: undefined,
        max_dias: 28,
        sexo: undefined,
      },
    });
  });

  it('rejects the window tipo without any selected encounter type', async () => {
    const onSubmit = vi.fn();
    render(
      <IndicadorForm
        mode="create"
        defaultValues={{ nombre: 'Sin encounter types', tipo: 'conteo_pacientes_ventana' }}
        onSubmit={onSubmit}
      />,
    );

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Guardar' })));

    expect(screen.getByText(/al menos un tipo de encuentro/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows the encounter-type picker only for the window tipo', async () => {
    const onSubmit = vi.fn();
    render(<IndicadorForm mode="create" defaultValues={{ nombre: 'Window' }} onSubmit={onSubmit} />);

    expect(screen.queryByLabelText('Tipos de encuentro')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'conteo_pacientes_ventana' } });
    expect(screen.getByLabelText('Tipos de encuentro')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'conteo_atenciones' } });
    expect(screen.queryByLabelText('Tipos de encuentro')).not.toBeInTheDocument();
  });

  it('adds an encounter type through the picker and submits it in the definicion', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<IndicadorForm mode="create" defaultValues={{ nombre: 'CRED Neonato' }} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'conteo_pacientes_ventana' } });
    fireEvent.change(screen.getByLabelText('Tipos de encuentro'), { target: { value: 'CRED' } });
    await act(async () => {});

    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));
    expect(screen.getByText('CRED Neonato')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Mínimo de ocurrencias'), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('Edad máxima días'), { target: { value: '28' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Guardar' })));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0].definicion.evento.encounter_type_uuids).toEqual(['enc-cred-neonato']);
    expect(onSubmit.mock.calls[0][0].definicion.evento.minimo_ocurrencias).toBe(4);
    expect(onSubmit.mock.calls[0][0].definicion.poblacion.max_dias).toBe(28);
  });
});
