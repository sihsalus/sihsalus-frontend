import { act, fireEvent, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { renderWithSwr } from 'test-utils';
import type { SeriesResponse } from '../api/types';
import ResultadosPage from './ResultadosPage';

vi.mock('../features/indicadores/hooks', async () => ({
  ...(await vi.importActual('../features/indicadores/hooks')),
  useIndicadores: vi.fn(),
  notifyError: vi.fn(),
  notifySuccess: vi.fn(),
}));

vi.mock('../features/resultados/hooks', async () => ({
  ...(await vi.importActual('../features/resultados/hooks')),
  useResultados: vi.fn(),
  useResultadosSeries: vi.fn(),
  useCalcularAhora: vi.fn(),
  useRecalcularAnio: vi.fn(),
  useRecalcularAnio: vi.fn(),
}));

import { useIndicadores, notifyError, notifySuccess } from '../features/indicadores/hooks';
import {
  useCalcularAhora,
  useRecalcularAnio,
  useResultados,
  useResultadosSeries,
} from '../features/resultados/hooks';

const mockUseIndicadores = vi.mocked(useIndicadores);
const mockUseResultados = vi.mocked(useResultados);
const mockUseResultadosSeries = vi.mocked(useResultadosSeries);
const mockUseCalcularAhora = vi.mocked(useCalcularAhora);
const mockUseRecalcularAnio = vi.mocked(useRecalcularAnio);
const mockUseRecalcularAnio = vi.mocked(useRecalcularAnio);

const indicadores = {
  items: [
    { id: 'ind-001', nombre: 'Control prenatal', descripcion: null, activo: true, creado_en: '2026-01-01' },
    { id: 'ind-002', nombre: 'Anemia', descripcion: null, activo: true, creado_en: '2026-02-01' },
  ],
  total: 2,
  page: 1,
  size: 100,
  pages: 1,
};

const monthlySeries: SeriesResponse = {
  items: [
    { periodo_label: '2026-01', valor: 100, meses_disponibles: 1, anio: 2026, mes_referencia: '2026-01-01' },
    { periodo_label: '2026-02', valor: 200, meses_disponibles: 1, anio: 2026, mes_referencia: '2026-02-01' },
  ],
  indicador_id: 'ind-001',
  anio: 2026,
  granularity: 'mensual',
};

const quarterlySeries: SeriesResponse = {
  items: [
    { periodo_label: 'Q1', valor: 300, meses_disponibles: 3, anio: 2026, trimestre: 1 },
    { periodo_label: 'Q2', valor: 200, meses_disponibles: 2, anio: 2026, trimestre: 2 },
  ],
  indicador_id: 'ind-001',
  anio: 2026,
  granularity: 'trimestral',
};

function renderPage() {
  return renderWithSwr(
    <MemoryRouter initialEntries={['/results']}>
      <ResultadosPage />
    </MemoryRouter>,
  );
}

describe('ResultadosPage series granularity', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseIndicadores.mockReturnValue({
      data: indicadores,
      error: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);

    mockUseResultados.mockReturnValue({
      data: { items: [], total: 0, page: 1, size: 10, pages: 0 },
      error: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);

    mockUseCalcularAhora.mockReturnValue({
      calcularAhora: vi.fn().mockResolvedValue({ calculados: 0, errores: [], total: 0 }),
    });

    mockUseRecalcularAnio.mockReturnValue({
      recalcularAnio: vi.fn().mockResolvedValue({
        anio: 2026,
        indicador_id: null,
        meses_procesados: 12,
        indicadores_considerados: 0,
        recalculados: 0,
        errores: [],
        total: 0,
      }),
    });

    mockUseRecalcularAnio.mockReturnValue({
      recalcularAnio: vi.fn().mockResolvedValue({
        anio: 2026,
        indicador_id: null,
        meses_procesados: 12,
        indicadores_considerados: 0,
        recalculados: 0,
        errores: [],
        total: 0,
      }),
    });
  });

  it('shows prompt to select indicator for series view', () => {
    mockUseResultadosSeries.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);

    renderPage();

    // Initially in "series" (default) mode with no indicator selected
    expect(screen.getByText(/Seleccioná un indicador/)).toBeInTheDocument();
  });

  it('renders monthly series rows with periodo_label and valor columns', () => {
    mockUseResultadosSeries.mockReturnValue({
      data: monthlySeries,
      error: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);

    renderPage();

    // Select an indicator to trigger series loading
    const select = screen.getByLabelText('Indicador');
    fireEvent.change(select, { target: { value: 'ind-001' } });

    // Series table headers should appear
    expect(screen.getByText('Periodo')).toBeInTheDocument();
    expect(screen.getByText('Valor')).toBeInTheDocument();
    expect(screen.getByText('Meses disponibles')).toBeInTheDocument();

    // Monthly rows
    expect(screen.getByText('2026-01')).toBeInTheDocument();
    expect(screen.getByText('2026-02')).toBeInTheDocument();
  });

  it('switches granularity and shows quarterly rollup rows', async () => {
    let currentData: SeriesResponse = monthlySeries;
    mockUseResultadosSeries.mockImplementation(
      () =>
        ({
          data: currentData,
          error: undefined,
          isLoading: false,
          isError: false,
          refetch: vi.fn(),
        }) as never,
    );

    renderPage();

    // Select an indicator
    const indicatorSelect = screen.getByLabelText('Indicador');
    fireEvent.change(indicatorSelect, { target: { value: 'ind-001' } });

    // Monthly rows should appear first
    expect(screen.getByText('2026-01')).toBeInTheDocument();
    expect(screen.getByText('2026-02')).toBeInTheDocument();

    // Switch to quarterly
    currentData = quarterlySeries;
    const granularitySelect = screen.getByLabelText('Granularidad');
    await act(async () => {
      fireEvent.change(granularitySelect, { target: { value: 'trimestral' } });
    });

    // Quarterly rows should now be displayed
    expect(screen.getByText('Q1')).toBeInTheDocument();
    expect(screen.getByText('Q2')).toBeInTheDocument();
    // Monthly rows should be gone
    expect(screen.queryByText('2026-01')).not.toBeInTheDocument();
  });

  it('can switch to historical view and back to series', () => {
    mockUseResultadosSeries.mockImplementation(
      () =>
        ({
          data: monthlySeries,
          error: undefined,
          isLoading: false,
          isError: false,
          refetch: vi.fn(),
        }) as never,
    );

    renderPage();

    // Select indicator
    const indicatorSelect = screen.getByLabelText('Indicador');
    fireEvent.change(indicatorSelect, { target: { value: 'ind-001' } });

    // ContentSwitcher should be visible with both tabs
    expect(screen.getByText('Series temporales')).toBeInTheDocument();
    expect(screen.getByText('Histórico')).toBeInTheDocument();

    // Series data should be visible
    expect(screen.getByText('2026-01')).toBeInTheDocument();

    // Default granularity should be "Mensual" visible in the select
    const granularitySelect = screen.getByLabelText('Granularidad') as HTMLSelectElement;
    expect(granularitySelect.value).toBe('mensual');
  });
});

describe('ResultadosPage calculate / recalculate actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseIndicadores.mockReturnValue({
      data: indicadores,
      error: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);

    mockUseResultados.mockReturnValue({
      data: { items: [], total: 0, page: 1, size: 10, pages: 0 },
      error: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);

    mockUseResultadosSeries.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);

    mockUseCalcularAhora.mockReturnValue({
      calcularAhora: vi.fn().mockResolvedValue({ calculados: 2, errores: [], total: 2 }),
    });

    mockUseRecalcularAnio.mockReturnValue({
      recalcularAnio: vi.fn().mockResolvedValue({
        anio: 2026,
        indicador_id: null,
        meses_procesados: 12,
        indicadores_considerados: 2,
        recalculados: 24,
        errores: [],
        total: 24,
      }),
    });
  });

  it('calls calcularAhora hook and shows success notification on success', async () => {
    const calcularMock = vi.fn().mockResolvedValue({ calculados: 2, errores: [], total: 2 });
    mockUseCalcularAhora.mockReturnValue({ calcularAhora: calcularMock });

    renderPage();

    const button = screen.getByRole('button', { name: /Calcular ahora/ });
    await act(async () => {
      fireEvent.click(button);
    });

    expect(calcularMock).toHaveBeenCalledTimes(1);
    expect(notifySuccess).toHaveBeenCalled();
  });

  it('shows summary with partial-errors language when the response has errors', async () => {
    mockUseCalcularAhora.mockReturnValue({
      calcularAhora: vi
        .fn()
        .mockResolvedValue({
          calculados: 1,
          errores: [{ indicador_id: 'ind-002', indicador_nombre: 'Anemia', error: 'boom' }],
          total: 2,
        }),
    });

    renderPage();

    const button = screen.getByRole('button', { name: /Calcular ahora/ });
    await act(async () => {
      fireEvent.click(button);
    });

    expect(notifySuccess).toHaveBeenCalled();
    // The page should render a warning notification with the partial-error subtitle
    expect(screen.getByText(/1 de 2 calculados/)).toBeInTheDocument();
    // The failed indicator list should mention the indicator id and error
    expect(screen.getByText('(ind-002): boom')).toBeInTheDocument();
  });

  it('treats total-failure (0 calculated, all errored) as an error toast and an error notification', async () => {
    mockUseCalcularAhora.mockReturnValue({
      calcularAhora: vi.fn().mockResolvedValue({
        calculados: 0,
        errores: [
          { indicador_id: 'ind-001', indicador_nombre: 'Control prenatal', error: 'timeout' },
          { indicador_id: 'ind-002', indicador_nombre: 'Anemia', error: 'boom' },
        ],
        total: 2,
      }),
    });

    renderPage();

    const button = screen.getByRole('button', { name: /Calcular ahora/ });
    await act(async () => {
      fireEvent.click(button);
    });

    expect(notifyError).toHaveBeenCalled();
    expect(notifySuccess).not.toHaveBeenCalled();
    // The on-page summary should also use the error variant subtitle.
    expect(screen.getByText(/0 de 2 calculados, todos con error/)).toBeInTheDocument();
    // Failed indicator details are still rendered alongside the error summary.
    expect(screen.getByText('(ind-001): timeout')).toBeInTheDocument();
    expect(screen.getByText('(ind-002): boom')).toBeInTheDocument();
  });

  it('shows error notification when calcularAhora hook rejects', async () => {
    mockUseCalcularAhora.mockReturnValue({
      calcularAhora: vi.fn().mockRejectedValue(new Error('Network Error')),
    });

    renderPage();

    const button = screen.getByRole('button', { name: /Calcular ahora/ });
    await act(async () => {
      fireEvent.click(button);
    });

    expect(notifyError).toHaveBeenCalledWith('Network Error');
  });

  it('opens the recalculate-year modal when clicking the secondary action', () => {
    renderPage();

    const recalcButton = screen.getByRole('button', { name: /Recalcular año/ });
    fireEvent.click(recalcButton);

    // The Carbon modal renders a heading matching the title
    expect(screen.getByRole('heading', { name: /Recalcular año/ })).toBeInTheDocument();
    // Confirm/Cancel buttons should be visible
    expect(screen.getByRole('button', { name: /Confirmar/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancelar/ })).toBeInTheDocument();
  });

  it('submits recalcularAnio with the selected year when confirming the modal', async () => {
    const recalcMock = vi.fn().mockResolvedValue({
      anio: 2025,
      indicador_id: null,
      meses_procesados: 12,
      indicadores_considerados: 2,
      recalculados: 24,
      errores: [],
      total: 24,
    });
    mockUseRecalcularAnio.mockReturnValue({ recalcularAnio: recalcMock });

    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /Recalcular año/ }));

    // Find the NumberInput and set it to 2025
    const yearInput = screen.getByLabelText('Año') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(yearInput, { target: { value: '2025' } });
    });
    expect(yearInput.value).toBe('2025');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirmar/ }));
    });

    expect(recalcMock).toHaveBeenCalledWith({ anio: 2025 });
    expect(notifySuccess).toHaveBeenCalled();
  });

  it('scopes the recalculate to the selected indicator when one is set', async () => {
    const recalcMock = vi.fn().mockResolvedValue({
      anio: 2025,
      indicador_id: 'ind-001',
      meses_procesados: 12,
      indicadores_considerados: 1,
      recalculados: 12,
      errores: [],
      total: 12,
    });
    mockUseRecalcularAnio.mockReturnValue({ recalcularAnio: recalcMock });

    renderPage();

    // Select an indicator first
    const indicatorSelect = screen.getByLabelText('Indicador');
    fireEvent.change(indicatorSelect, { target: { value: 'ind-001' } });

    fireEvent.click(screen.getByRole('button', { name: /Recalcular año/ }));

    const yearInput = screen.getByLabelText('Año') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(yearInput, { target: { value: '2025' } });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirmar/ }));
    });

    expect(recalcMock).toHaveBeenCalledWith({ anio: 2025, indicador_id: 'ind-001' });
  });

  it('rejects a future year and does not call the hook', async () => {
    const recalcMock = vi.fn();
    mockUseRecalcularAnio.mockReturnValue({ recalcularAnio: recalcMock });

    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /Recalcular año/ }));

    const futureYear = new Date().getFullYear() + 5;
    const yearInput = screen.getByLabelText('Año') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(yearInput, { target: { value: String(futureYear) } });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirmar/ }));
    });

    expect(recalcMock).not.toHaveBeenCalled();
    expect(notifyError).not.toHaveBeenCalled();
    // Modal should still be open
    expect(screen.getByRole('heading', { name: /Recalcular año/ })).toBeInTheDocument();
  });

  it('renders annual recalc summary with failed indicator details (including mes) on partial errors', async () => {
    const recalcMock = vi.fn().mockResolvedValue({
      anio: 2025,
      indicador_id: null,
      meses_procesados: 12,
      indicadores_considerados: 2,
      recalculados: 23,
      errores: [
        {
          indicador_id: 'ind-002',
          indicador_nombre: 'Anemia',
          mes: '2025-03',
          error: 'timeout',
        },
      ],
      total: 24,
    });
    mockUseRecalcularAnio.mockReturnValue({ recalcularAnio: recalcMock });

    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /Recalcular año/ }));

    const yearInput = screen.getByLabelText('Año') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(yearInput, { target: { value: '2025' } });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirmar/ }));
    });

    expect(notifySuccess).toHaveBeenCalled();
    expect(screen.getByText(/2025: 23 recalculados, 1 con error/)).toBeInTheDocument();
    // Failed indicator details should include the mes
    expect(screen.getByText('(ind-002, 2025-03): timeout')).toBeInTheDocument();
  });

  it('treats annual recalc total-failure (0 recalculated, all errored) as an error toast', async () => {
    const recalcMock = vi.fn().mockResolvedValue({
      anio: 2025,
      indicador_id: null,
      meses_procesados: 12,
      indicadores_considerados: 2,
      recalculados: 0,
      // All items failed — errores.length equals total so the page classifies this as total failure
      errores: [
        { indicador_id: 'ind-001', indicador_nombre: 'Control prenatal', mes: '2025-01', error: 'timeout' },
        { indicador_id: 'ind-002', indicador_nombre: 'Anemia', mes: '2025-01', error: 'timeout' },
      ],
      total: 2,
    });
    mockUseRecalcularAnio.mockReturnValue({ recalcularAnio: recalcMock });

    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /Recalcular año/ }));

    const yearInput = screen.getByLabelText('Año') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(yearInput, { target: { value: '2025' } });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirmar/ }));
    });

    expect(notifyError).toHaveBeenCalled();
    expect(notifySuccess).not.toHaveBeenCalled();
    expect(screen.getByText(/2025: 0 recalculados, todos con error/)).toBeInTheDocument();
  });

  it('treats annual recalc total-failure (0 recalculated, errores.length < total) as an error toast', async () => {
    // The backend's `total` represents attempted recalculations (e.g. months
    // × indicators) while `errores` may report only a subset. The page must
    // classify 0 recalculated + any error + non-empty total as total failure
    // even when errores.length is well below total.
    const recalcMock = vi.fn().mockResolvedValue({
      anio: 2025,
      indicador_id: null,
      meses_procesados: 12,
      indicadores_considerados: 2,
      recalculados: 0,
      errores: [
        { indicador_id: 'ind-001', indicador_nombre: 'Control prenatal', mes: '2025-01', error: 'timeout' },
      ],
      total: 24,
    });
    mockUseRecalcularAnio.mockReturnValue({ recalcularAnio: recalcMock });

    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /Recalcular año/ }));

    const yearInput = screen.getByLabelText('Año') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(yearInput, { target: { value: '2025' } });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirmar/ }));
    });

    expect(notifyError).toHaveBeenCalled();
    expect(notifySuccess).not.toHaveBeenCalled();
    expect(screen.getByText(/2025: 0 recalculados, todos con error/)).toBeInTheDocument();
  });

  it('treats calculate-now total-failure (0 calculated, errores.length < total) as an error toast', async () => {
    // Same safer rule applied to calculate-now: 0 successes + at least one
    // error on a non-empty batch is total failure, even when the backend
    // reports fewer errors than total.
    const calcularMock = vi.fn().mockResolvedValue({
      calculados: 0,
      errores: [{ indicador_id: 'ind-001', indicador_nombre: 'Control prenatal', error: 'timeout' }],
      total: 5,
    });
    mockUseCalcularAhora.mockReturnValue({ calcularAhora: calcularMock });

    renderPage();

    const button = screen.getByRole('button', { name: /Calcular ahora/ });
    await act(async () => {
      fireEvent.click(button);
    });

    expect(notifyError).toHaveBeenCalled();
    expect(notifySuccess).not.toHaveBeenCalled();
    expect(screen.getByText(/0 de 5 calculados, todos con error/)).toBeInTheDocument();
    expect(screen.getByText('(ind-001): timeout')).toBeInTheDocument();
  });

  it('closes the recalculate-year modal via Cancel without calling the hook', async () => {
    const recalcMock = vi.fn();
    mockUseRecalcularAnio.mockReturnValue({ recalcularAnio: recalcMock });

    renderPage();

    // Open the modal
    fireEvent.click(screen.getByRole('button', { name: /Recalcular año/ }));
    expect(screen.getByRole('heading', { name: /Recalcular año/ })).toBeInTheDocument();

    // Click Cancel
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Cancelar/ }));
    });

    // The hook must NOT have been called
    expect(recalcMock).not.toHaveBeenCalled();
    expect(notifySuccess).not.toHaveBeenCalled();
    expect(notifyError).not.toHaveBeenCalled();
    // Carbon Modal keeps the heading in the DOM but removes the `is-visible`
    // class from its `.cds--modal` container when closed, so the dialog is
    // no longer presented to the user.
    const modal = document.querySelector('.cds--modal');
    expect(modal).not.toBeNull();
    expect(modal?.classList.contains('is-visible')).toBe(false);
  });
});
