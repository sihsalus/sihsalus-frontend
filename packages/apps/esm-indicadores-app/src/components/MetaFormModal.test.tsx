import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Indicador, IndicadorDetail, IndicadorMeta } from '../api/types';
import { useAllIndicadores, useIndicador } from '../features/indicadores/hooks';
import MetaFormModal from './MetaFormModal';

vi.mock('../features/indicadores/hooks', () => ({
  getIndicatorsErrorMessage: vi.fn((_error, fallback) => fallback),
  useAllIndicadores: vi.fn(),
  useIndicador: vi.fn(),
}));

const mockUseAllIndicadores = vi.mocked(useAllIndicadores);
const mockUseIndicador = vi.mocked(useIndicador);

const indicators: Array<Indicador> = [
  {
    id: 1,
    nombre: 'Control prenatal',
    descripcion: null,
    activo: true,
    creado_en: '2026-01-01',
  },
  { id: 2, nombre: 'Anemia', descripcion: null, activo: true, creado_en: '2026-01-01' },
];

const indicatorBeyondFirstPage: Indicador = {
  id: 101,
  nombre: 'Indicador 101',
  descripcion: null,
  activo: true,
  creado_en: '2026-01-01',
};
const indicatorsWithSecondPage = [
  ...indicators,
  ...Array.from({ length: 98 }, (_, index) => ({
    ...indicators[0],
    id: index + 3,
    nombre: `Indicador ${index + 3}`,
  })),
  indicatorBeyondFirstPage,
];

const details: Record<string, IndicadorDetail> = {
  '1': {
    ...indicators[0],
    versiones: [
      {
        id: 11,
        indicador_id: 1,
        version: 1,
        definicion: { tipo: 'conteo_atenciones' },
        creado_en: '2026-01-01',
      },
      {
        id: 12,
        indicador_id: 1,
        version: 2,
        definicion: { tipo: 'conteo_atenciones' },
        creado_en: '2026-02-01',
      },
    ],
  },
  '2': {
    ...indicators[1],
    versiones: [
      {
        id: 21,
        indicador_id: 2,
        version: 1,
        definicion: { tipo: 'conteo_pacientes' },
        creado_en: '2026-01-01',
      },
    ],
  },
  '101': {
    ...indicatorBeyondFirstPage,
    versiones: [
      {
        id: 1011,
        indicador_id: 101,
        version: 1,
        definicion: { tipo: 'conteo_atenciones' },
        creado_en: '2026-01-01',
      },
    ],
  },
};

const existingMeta: IndicadorMeta = {
  id: 1,
  indicador_version_id: 12,
  anio: 2025,
  valor_meta: 1200,
  creado_en: '2026-01-01',
  indicador_nombre: 'Control prenatal',
  version_numero: 2,
};

function renderModal(props: Partial<React.ComponentProps<typeof MetaFormModal>> = {}) {
  return render(<MetaFormModal isOpen onClose={vi.fn()} onSubmit={vi.fn().mockResolvedValue(undefined)} {...props} />);
}

function getIndicatorInput(container: HTMLElement) {
  const input = container.querySelector('#meta-indicador');
  if (!input) throw new Error('Indicator ComboBox input not found');
  return input as HTMLInputElement;
}

async function selectIndicator(container: HTMLElement, name: string) {
  fireEvent.input(getIndicatorInput(container), { target: { value: name } });
  fireEvent.click(screen.getByText(name));
  await waitFor(() =>
    expect((screen.getByLabelText('Versión vigente') as HTMLSelectElement).value).toMatch(/^\d+$/),
  );
}

describe('MetaFormModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAllIndicadores.mockReturnValue({
      data: indicators,
      error: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    mockUseIndicador.mockImplementation((id) => ({
      data: details[String(id)],
      error: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }));
  });

  it('creates a meta only for the latest version returned by indicator detail', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { container } = renderModal({ onSubmit });
    await selectIndicator(container, 'Control prenatal');

    expect(screen.getByLabelText('Versión vigente')).toBeDisabled();
    expect(screen.getByLabelText('Versión vigente')).toHaveValue('12');
    fireEvent.change(screen.getByLabelText('Año'), { target: { value: '2026' } });
    fireEvent.change(screen.getByLabelText('Valor de la meta'), { target: { value: '1500' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Guardar/ })));

    expect(onSubmit).toHaveBeenCalledWith(
      { indicador_version_id: 12, anio: 2026, valor_meta: 1500 },
      1,
    );
  });

  it('uses a newly published latest version after detail data is revalidated', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { container, rerender } = renderModal({ onSubmit });
    await selectIndicator(container, 'Control prenatal');
    expect(screen.getByLabelText('Versión vigente')).toHaveValue('12');

    const refreshedDetail: IndicadorDetail = {
      ...details['1'],
      versiones: [
        ...details['1'].versiones,
        {
          id: 13,
          indicador_id: 1,
          version: 3,
          definicion: { tipo: 'conteo_atenciones' },
          creado_en: '2026-03-01',
        },
      ],
    };
    mockUseIndicador.mockImplementation((id) => ({
      data: id === 1 ? refreshedDetail : details[String(id)],
      error: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }));
    rerender(<MetaFormModal isOpen onClose={vi.fn()} onSubmit={onSubmit} />);

    await waitFor(() => expect(screen.getByLabelText('Versión vigente')).toHaveValue('13'));
    fireEvent.change(screen.getByLabelText('Año'), { target: { value: '2026' } });
    fireEvent.change(screen.getByLabelText('Valor de la meta'), { target: { value: '1500' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Guardar/ })));

    expect(onSubmit).toHaveBeenCalledWith(
      { indicador_version_id: 13, anio: 2026, valor_meta: 1500 },
      1,
    );
  });

  it('preserves the exact edited version if a newer version appears before detail loads', async () => {
    const versionOneMeta = { ...existingMeta, indicador_version_id: 11, version_numero: 1 };
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderModal({ initialMeta: versionOneMeta, initialIndicatorId: 1, onSubmit });

    await waitFor(() => expect(screen.getByLabelText('Versión de la meta')).toHaveValue('11'));
    fireEvent.change(screen.getByLabelText('Valor de la meta'), { target: { value: '1300' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Guardar/ })));

    expect(onSubmit).toHaveBeenCalledWith(
      { indicador_version_id: 11, anio: 2025, valor_meta: 1300 },
      1,
    );
  });

  it('locks indicator, version and year while editing the selected record', async () => {
    const { container } = renderModal({ initialMeta: existingMeta, initialIndicatorId: 1 });

    await waitFor(() => expect(getIndicatorInput(container)).toHaveValue('Control prenatal'));
    expect(getIndicatorInput(container)).toBeDisabled();
    expect(screen.getByLabelText('Versión de la meta')).toBeDisabled();
    expect(screen.getByLabelText('Año')).toBeDisabled();
  });

  it('does not reset edited values when indicator data is revalidated', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { container, rerender } = renderModal({
      initialMeta: existingMeta,
      initialIndicatorId: 1,
      onSubmit,
    });

    await waitFor(() => expect(getIndicatorInput(container)).toHaveValue('Control prenatal'));
    fireEvent.change(screen.getByLabelText('Valor de la meta'), { target: { value: '1350' } });
    mockUseAllIndicadores.mockReturnValue({
      data: indicators.map((indicator) => ({ ...indicator })),
      error: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    rerender(
      <MetaFormModal
        isOpen
        initialMeta={existingMeta}
        initialIndicatorId={1}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByLabelText('Valor de la meta')).toHaveValue(1350);
    expect(screen.getByLabelText('Año')).toHaveValue(2025);
  });

  it('does not restore the initial filter after the user selects another indicator', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { container, rerender } = renderModal({ initialIndicatorId: 1, onSubmit });
    await waitFor(() => expect(getIndicatorInput(container)).toHaveValue('Control prenatal'));
    await selectIndicator(container, 'Anemia');
    expect(getIndicatorInput(container)).toHaveValue('Anemia');

    mockUseAllIndicadores.mockReturnValue({
      data: indicators.map((indicator) => ({ ...indicator })),
      error: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    rerender(<MetaFormModal isOpen initialIndicatorId={1} onClose={vi.fn()} onSubmit={onSubmit} />);

    expect(getIndicatorInput(container)).toHaveValue('Anemia');
    expect(screen.getByLabelText('Versión vigente')).toHaveValue('21');
  });

  it('submits only once while a save request is pending', async () => {
    let resolveSubmit!: () => void;
    const onSubmit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSubmit = resolve;
        }),
    );
    const { container } = renderModal({ onSubmit });
    await selectIndicator(container, 'Anemia');
    fireEvent.change(screen.getByLabelText('Año'), { target: { value: '2026' } });
    fireEvent.change(screen.getByLabelText('Valor de la meta'), { target: { value: '100' } });

    const save = screen.getByRole('button', { name: /Guardar/ });
    fireEvent.click(save);
    fireEvent.click(save);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    await act(async () => resolveSubmit());
  });

  it('offers indicators returned after the first page', async () => {
    mockUseAllIndicadores.mockReturnValue({
      data: indicatorsWithSecondPage,
      error: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    const { container } = renderModal();

    await selectIndicator(container, 'Indicador 101');

    expect(getIndicatorInput(container)).toHaveValue('Indicador 101');
    expect(screen.getByLabelText('Versión vigente')).toHaveValue('1011');
  });

  it('rejects a year outside the backend range', async () => {
    const onSubmit = vi.fn();
    const { container } = renderModal({ onSubmit });
    await selectIndicator(container, 'Anemia');
    fireEvent.change(screen.getByLabelText('Año'), { target: { value: '1999' } });
    fireEvent.change(screen.getByLabelText('Valor de la meta'), { target: { value: '100' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Guardar/ })));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/año debe estar entre 2000 y 2100/i)).toBeInTheDocument();
  });

  it('rejects a negative target value', async () => {
    const onSubmit = vi.fn();
    const { container } = renderModal({ onSubmit });
    await selectIndicator(container, 'Anemia');
    fireEvent.change(screen.getByLabelText('Año'), { target: { value: '2026' } });
    fireEvent.change(screen.getByLabelText('Valor de la meta'), { target: { value: '-10' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Guardar/ })));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/la meta no puede ser negativa/i)).toBeInTheDocument();
  });

  it('rejects an absurd target value above the persistence cap', async () => {
    const onSubmit = vi.fn();
    const { container } = renderModal({ onSubmit });
    await selectIndicator(container, 'Anemia');
    fireEvent.change(screen.getByLabelText('Año'), { target: { value: '2026' } });
    fireEvent.change(screen.getByLabelText('Valor de la meta'), { target: { value: '1000000001' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Guardar/ })));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/la meta no puede ser mayor/i)).toBeInTheDocument();
  });

  it('disables saving and shows a stable Spanish message when versions fail to load', () => {
    mockUseIndicador.mockReturnValue({
      data: undefined,
      error: Object.assign(new Error('technical database message'), { response: { status: 500 } }),
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    });
    renderModal({ initialIndicatorId: 1 });

    expect(screen.getByText('No se pudieron cargar las versiones')).toBeInTheDocument();
    expect(screen.queryByText('technical database message')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Guardar/ })).toBeDisabled();
  });

  it('shows an explanation and cannot submit when the selected indicator has no versions', async () => {
    const onSubmit = vi.fn();
    const { container } = renderModal({ onSubmit });
    mockUseIndicador.mockReturnValue({
      data: { ...indicators[0], versiones: [] },
      error: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    fireEvent.input(getIndicatorInput(container), { target: { value: 'Control prenatal' } });
    fireEvent.click(screen.getByText('Control prenatal'));
    await waitFor(() =>
      expect(screen.getByText(/no tiene versiones. Cree una versión antes de definir una meta/i)).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: /Guardar/ })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Año'), { target: { value: '2026' } });
    fireEvent.change(screen.getByLabelText('Valor de la meta'), { target: { value: '1500' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Guardar/ })));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('enables saving as soon as the indicator gets a version', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { container, rerender } = renderModal({ onSubmit });
    mockUseIndicador.mockReturnValue({
      data: { ...indicators[0], versiones: [] },
      error: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    fireEvent.input(getIndicatorInput(container), { target: { value: 'Control prenatal' } });
    fireEvent.click(screen.getByText('Control prenatal'));
    await waitFor(() =>
      expect(screen.getByText(/no tiene versiones. Cree una versión antes de definir una meta/i)).toBeInTheDocument(),
    );

    mockUseIndicador.mockReturnValue({
      data: details['1'],
      error: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    rerender(<MetaFormModal isOpen onClose={vi.fn()} onSubmit={onSubmit} />);

    await waitFor(() => expect(screen.getByLabelText('Versión vigente')).toHaveValue('12'));
    expect(screen.queryByText(/no tiene versiones/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Guardar/ })).not.toBeDisabled();

    fireEvent.change(screen.getByLabelText('Año'), { target: { value: '2026' } });
    fireEvent.change(screen.getByLabelText('Valor de la meta'), { target: { value: '1500' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Guardar/ })));

    expect(onSubmit).toHaveBeenCalledWith(
      { indicador_version_id: 12, anio: 2026, valor_meta: 1500 },
      1,
    );
  });
});
