import { act, fireEvent, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { renderWithSwr } from 'test-utils';
import ResultadosPage from './ResultadosPage';
import type { SerieRow, SeriesResponse } from '../api/types';

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
}));

import { useIndicadores, notifySuccess } from '../features/indicadores/hooks';
import { useResultados, useResultadosSeries, useCalcularAhora } from '../features/resultados/hooks';

const mockUseIndicadores = vi.mocked(useIndicadores);
const mockUseResultados = vi.mocked(useResultados);
const mockUseResultadosSeries = vi.mocked(useResultadosSeries);
const mockUseCalcularAhora = vi.mocked(useCalcularAhora);

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
