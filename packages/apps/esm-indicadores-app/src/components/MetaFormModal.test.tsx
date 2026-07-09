import { act, fireEvent, render, screen } from '@testing-library/react';
import type { IndicadorDetail, IndicadorMeta } from '../api/types';
import { useIndicadores } from '../features/indicadores/hooks';
import MetaFormModal from './MetaFormModal';

vi.mock('../features/indicadores/hooks', async () => ({
  ...(await vi.importActual('../features/indicadores/hooks')),
  useIndicadores: vi.fn(),
}));

const mockUseIndicadores = vi.mocked(useIndicadores);

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
  indicador_nombre: 'Control prenatal',
  version_numero: 2,
};

function renderModal(props: Partial<React.ComponentProps<typeof MetaFormModal>> = {}) {
  return render(
    <MetaFormModal
      isOpen
      onClose={vi.fn()}
      onSubmit={vi.fn().mockResolvedValue(undefined)}
      {...props}
    />,
  );
}

/** The ComboBox input is tricky to query via role/label in jsdom due to Carbon internals. */
function getIndicatorInput(container: HTMLElement) {
  const input = container.querySelector('#meta-indicador');
  if (!input) throw new Error('Indicator ComboBox input not found');
  return input as HTMLInputElement;
}

describe('MetaFormModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseIndicadores.mockReturnValue({
      data: { items: indicadores, total: 2, page: 1, size: 1000, pages: 1 },
      error: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);
  });

  it('submits the payload after selecting indicator, version, year and value', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { container } = renderModal({ onSubmit });

    // ComboBox: type to filter, then click the matching option
    const indicatorInput = getIndicatorInput(container);
    await act(async () => {
      fireEvent.input(indicatorInput, { target: { value: 'Control' } });
    });
    await act(async () => {
      fireEvent.click(screen.getByText('Control prenatal'));
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
    const { container } = renderModal({ initialMeta: existingMeta });

    expect((screen.getByLabelText('Año') as HTMLInputElement).value).toBe('2025');
    expect((screen.getByLabelText('Valor de la meta') as HTMLInputElement).value).toBe('1200');
    expect((screen.getByLabelText('Versión') as HTMLSelectElement).value).toBe('ver-001-2');
    // ComboBox shows the selected item's display text
    expect(getIndicatorInput(container)).toHaveValue('Control prenatal');
  });

  it('shows a validation error when the year is out of range', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { container } = renderModal({ onSubmit });

    const indicatorInput = getIndicatorInput(container);
    await act(async () => {
      fireEvent.input(indicatorInput, { target: { value: 'Control' } });
    });
    await act(async () => {
      fireEvent.click(screen.getByText('Control prenatal'));
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
    const { container } = renderModal({ onSubmit });

    const indicatorInput = getIndicatorInput(container);
    await act(async () => {
      fireEvent.input(indicatorInput, { target: { value: 'Anemia' } });
    });
    await act(async () => {
      fireEvent.click(screen.getByText('Anemia'));
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
