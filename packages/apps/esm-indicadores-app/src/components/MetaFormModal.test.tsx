import { act, fireEvent, render, screen } from '@testing-library/react';
import type { IndicadorDetail, IndicadorMeta } from '../api/types';
import MetaFormModal from './MetaFormModal';

const indicadores: Array<IndicadorDetail> = [
  {
    id: 'ind-001',
    nombre: 'Control prenatal',
    descripcion: null,
    activo: true,
    creado_en: '2026-01-01',
    versiones: [
      { id: 'ver-001-1', indicador_id: 'ind-001', version: 1, definicion: { tipo: 'conteo_atenciones', evento: null }, creado_en: '2026-01-01' },
      { id: 'ver-001-2', indicador_id: 'ind-001', version: 2, definicion: { tipo: 'conteo_atenciones', evento: null }, creado_en: '2026-02-01' },
    ],
  },
  {
    id: 'ind-002',
    nombre: 'Anemia',
    descripcion: null,
    activo: true,
    creado_en: '2026-01-01',
    versiones: [
      { id: 'ver-002-1', indicador_id: 'ind-002', version: 1, definicion: { tipo: 'conteo_pacientes', evento: null }, creado_en: '2026-01-01' },
    ],
  },
];

const existingMeta: IndicadorMeta = {
  id: 'meta-1',
  indicador_version_id: 'ver-001-2',
  anio: 2025,
  valor_meta: 1200,
  creado_en: '2026-01-01',
};

function renderModal(props: Partial<React.ComponentProps<typeof MetaFormModal>> = {}) {
  return render(
    <MetaFormModal
      isOpen
      indicators={indicadores}
      onClose={vi.fn()}
      onSubmit={vi.fn().mockResolvedValue(undefined)}
      {...props}
    />,
  );
}

describe('MetaFormModal', () => {
  it('submits the payload after selecting indicator, version, year and value', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderModal({ onSubmit });

    const indicatorSelect = screen.getByLabelText('Indicador');
    await act(async () => {
      fireEvent.change(indicatorSelect, { target: { value: 'ind-001' } });
    });

    const versionSelect = screen.getByLabelText('Versión');
    await act(async () => {
      fireEvent.change(versionSelect, { target: { value: 'ver-001-2' } });
    });

    const yearInput = screen.getByLabelText('Año') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(yearInput, { target: { value: '2026' } });
    });

    const valueInput = screen.getByLabelText('Valor de la meta') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(valueInput, { target: { value: '1500' } });
    });

    const submitButton = screen.getByRole('button', { name: /Guardar/ });
    await act(async () => {
      fireEvent.click(submitButton);
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      indicador_version_id: 'ver-001-2',
      anio: 2026,
      valor_meta: 1500,
    });
  });

  it('pre-fills the form when editing an existing meta', () => {
    renderModal({ initialMeta: existingMeta });

    expect((screen.getByLabelText('Año') as HTMLInputElement).value).toBe('2025');
    expect((screen.getByLabelText('Valor de la meta') as HTMLInputElement).value).toBe('1200');
    expect((screen.getByLabelText('Versión') as HTMLSelectElement).value).toBe('ver-001-2');
    expect((screen.getByLabelText('Indicador') as HTMLSelectElement).value).toBe('ind-001');
  });

  it('shows a validation error when the year is out of range', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderModal({ onSubmit });

    const indicatorSelect = screen.getByLabelText('Indicador');
    await act(async () => {
      fireEvent.change(indicatorSelect, { target: { value: 'ind-001' } });
    });

    const versionSelect = screen.getByLabelText('Versión');
    await act(async () => {
      fireEvent.change(versionSelect, { target: { value: 'ver-001-1' } });
    });

    const yearInput = screen.getByLabelText('Año') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(yearInput, { target: { value: '1999' } });
    });

    const valueInput = screen.getByLabelText('Valor de la meta') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(valueInput, { target: { value: '100' } });
    });

    const submitButton = screen.getByRole('button', { name: /Guardar/ });
    await act(async () => {
      fireEvent.click(submitButton);
    });

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/año debe estar entre 2000 y 2100/i)).toBeInTheDocument();
  });

  it('shows a validation error when the value is negative', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderModal({ onSubmit });

    const indicatorSelect = screen.getByLabelText('Indicador');
    await act(async () => {
      fireEvent.change(indicatorSelect, { target: { value: 'ind-002' } });
    });

    const versionSelect = screen.getByLabelText('Versión');
    await act(async () => {
      fireEvent.change(versionSelect, { target: { value: 'ver-002-1' } });
    });

    const yearInput = screen.getByLabelText('Año') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(yearInput, { target: { value: '2026' } });
    });

    const valueInput = screen.getByLabelText('Valor de la meta') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(valueInput, { target: { value: '-10' } });
    });

    const submitButton = screen.getByRole('button', { name: /Guardar/ });
    await act(async () => {
      fireEvent.click(submitButton);
    });

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/la meta no puede ser negativa/i)).toBeInTheDocument();
  });

  it('calls onClose when the cancel button is clicked', async () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    const cancelButton = screen.getByRole('button', { name: /Cancelar/ });
    await act(async () => {
      fireEvent.click(cancelButton);
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
