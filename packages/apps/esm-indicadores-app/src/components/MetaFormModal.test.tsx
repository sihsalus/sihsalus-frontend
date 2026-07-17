import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Indicador, IndicadorDetail, IndicadorMeta } from '../api/types';
import { useIndicador, useIndicadores } from '../features/indicadores/hooks';
import MetaFormModal from './MetaFormModal';

vi.mock('../features/indicadores/hooks', () => ({
  getIndicatorsErrorMessage: vi.fn((_error, fallback) => fallback),
  useIndicadores: vi.fn(),
  useIndicador: vi.fn(),
}));

const mockUseIndicadores = vi.mocked(useIndicadores);
const mockUseIndicador = vi.mocked(useIndicador);

const indicators: Array<Indicador> = [
  {
    id: 'indicator-a',
    nombre: 'Control prenatal',
    descripcion: null,
    activo: true,
    creado_en: '2026-01-01',
  },
  { id: 'indicator-b', nombre: 'Anemia', descripcion: null, activo: true, creado_en: '2026-01-01' },
];

const details: Record<string, IndicadorDetail> = {
  'indicator-a': {
    ...indicators[0],
    versiones: [
      {
        id: 'version-a-1',
        indicador_id: 'indicator-a',
        version: 1,
        definicion: { tipo: 'conteo_atenciones' },
        creado_en: '2026-01-01',
      },
      {
        id: 'version-a-2',
        indicador_id: 'indicator-a',
        version: 2,
        definicion: { tipo: 'conteo_atenciones' },
        creado_en: '2026-02-01',
      },
    ],
  },
  'indicator-b': {
    ...indicators[1],
    versiones: [
      {
        id: 'version-b-1',
        indicador_id: 'indicator-b',
        version: 1,
        definicion: { tipo: 'conteo_pacientes' },
        creado_en: '2026-01-01',
      },
    ],
  },
};

const existingMeta: IndicadorMeta = {
  id: 'meta-a',
  indicador_version_id: 'version-a-2',
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
    expect((screen.getByLabelText('Versión vigente') as HTMLSelectElement).value).toMatch(/^version-/),
  );
}

describe('MetaFormModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseIndicadores.mockReturnValue({
      data: { items: indicators, total: 2, page: 1, size: 100, pages: 1 },
      error: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    mockUseIndicador.mockImplementation((id) => ({
      data: details[id],
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
    expect(screen.getByLabelText('Versión vigente')).toHaveValue('version-a-2');
    fireEvent.change(screen.getByLabelText('Año'), { target: { value: '2026' } });
    fireEvent.change(screen.getByLabelText('Valor de la meta'), { target: { value: '1500' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Guardar/ })));

    expect(onSubmit).toHaveBeenCalledWith(
      { indicador_version_id: 'version-a-2', anio: 2026, valor_meta: 1500 },
      'indicator-a',
    );
  });

  it('uses a newly published latest version after detail data is revalidated', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { container, rerender } = renderModal({ onSubmit });
    await selectIndicator(container, 'Control prenatal');
    expect(screen.getByLabelText('Versión vigente')).toHaveValue('version-a-2');

    const refreshedDetail: IndicadorDetail = {
      ...details['indicator-a'],
      versiones: [
        ...details['indicator-a'].versiones,
        {
          id: 'version-a-3',
          indicador_id: 'indicator-a',
          version: 3,
          definicion: { tipo: 'conteo_atenciones' },
          creado_en: '2026-03-01',
        },
      ],
    };
    mockUseIndicador.mockImplementation((id) => ({
      data: id === 'indicator-a' ? refreshedDetail : details[id],
      error: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }));
    rerender(<MetaFormModal isOpen onClose={vi.fn()} onSubmit={onSubmit} />);

    await waitFor(() => expect(screen.getByLabelText('Versión vigente')).toHaveValue('version-a-3'));
    fireEvent.change(screen.getByLabelText('Año'), { target: { value: '2026' } });
    fireEvent.change(screen.getByLabelText('Valor de la meta'), { target: { value: '1500' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Guardar/ })));

    expect(onSubmit).toHaveBeenCalledWith(
      { indicador_version_id: 'version-a-3', anio: 2026, valor_meta: 1500 },
      'indicator-a',
    );
  });

  it('preserves the exact edited version if a newer version appears before detail loads', async () => {
    const versionOneMeta = { ...existingMeta, indicador_version_id: 'version-a-1', version_numero: 1 };
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderModal({ initialMeta: versionOneMeta, initialIndicatorId: 'indicator-a', onSubmit });

    await waitFor(() => expect(screen.getByLabelText('Versión de la meta')).toHaveValue('version-a-1'));
    fireEvent.change(screen.getByLabelText('Valor de la meta'), { target: { value: '1300' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Guardar/ })));

    expect(onSubmit).toHaveBeenCalledWith(
      { indicador_version_id: 'version-a-1', anio: 2025, valor_meta: 1300 },
      'indicator-a',
    );
  });

  it('locks indicator, version and year while editing the selected record', async () => {
    const { container } = renderModal({ initialMeta: existingMeta, initialIndicatorId: 'indicator-a' });

    await waitFor(() => expect(getIndicatorInput(container)).toHaveValue('Control prenatal'));
    expect(getIndicatorInput(container)).toBeDisabled();
    expect(screen.getByLabelText('Versión de la meta')).toBeDisabled();
    expect(screen.getByLabelText('Año')).toBeDisabled();
  });

  it('does not reset edited values when indicator data is revalidated', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { container, rerender } = renderModal({
      initialMeta: existingMeta,
      initialIndicatorId: 'indicator-a',
      onSubmit,
    });

    await waitFor(() => expect(getIndicatorInput(container)).toHaveValue('Control prenatal'));
    fireEvent.change(screen.getByLabelText('Valor de la meta'), { target: { value: '1350' } });
    mockUseIndicadores.mockReturnValue({
      data: { items: indicators.map((indicator) => ({ ...indicator })), total: 2, page: 1, size: 100, pages: 1 },
      error: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    rerender(
      <MetaFormModal
        isOpen
        initialMeta={existingMeta}
        initialIndicatorId="indicator-a"
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByLabelText('Valor de la meta')).toHaveValue(1350);
    expect(screen.getByLabelText('Año')).toHaveValue(2025);
  });

  it('does not restore the initial filter after the user selects another indicator', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { container, rerender } = renderModal({ initialIndicatorId: 'indicator-a', onSubmit });
    await waitFor(() => expect(getIndicatorInput(container)).toHaveValue('Control prenatal'));
    await selectIndicator(container, 'Anemia');
    expect(getIndicatorInput(container)).toHaveValue('Anemia');

    mockUseIndicadores.mockReturnValue({
      data: { items: indicators.map((indicator) => ({ ...indicator })), total: 2, page: 1, size: 100, pages: 1 },
      error: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    rerender(<MetaFormModal isOpen initialIndicatorId="indicator-a" onClose={vi.fn()} onSubmit={onSubmit} />);

    expect(getIndicatorInput(container)).toHaveValue('Anemia');
    expect(screen.getByLabelText('Versión vigente')).toHaveValue('version-b-1');
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

  it('disables saving and shows a stable Spanish message when versions fail to load', () => {
    mockUseIndicador.mockReturnValue({
      data: undefined,
      error: Object.assign(new Error('technical database message'), { response: { status: 500 } }),
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    });
    renderModal({ initialIndicatorId: 'indicator-a' });

    expect(screen.getByText('No se pudieron cargar las versiones')).toBeInTheDocument();
    expect(screen.queryByText('technical database message')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Guardar/ })).toBeDisabled();
  });
});
