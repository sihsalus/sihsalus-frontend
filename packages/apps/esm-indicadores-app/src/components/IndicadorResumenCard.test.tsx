import { screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { renderWithSwr } from 'test-utils';
import type { Indicador, SeriesResponse } from '../api/types';
import IndicadorResumenCard from './IndicadorResumenCard';

vi.mock('../features/resultados/hooks', async () => ({
  ...(await vi.importActual('../features/resultados/hooks')),
  useResultadosSeries: vi.fn(),
}));

import { useResultadosSeries } from '../features/resultados/hooks';

const mockUseResultadosSeries = vi.mocked(useResultadosSeries);

const indicador: Indicador = {
  id: 'ind-001',
  nombre: 'Control de recién nacido',
  descripcion: null,
  activo: true,
  creado_en: '2024-01-01',
};

const series = (meta: number | null, valores: Array<number>, anio = 2020): SeriesResponse => ({
  items: valores.map((valor, index) => ({
    periodo_label: `${anio}-0${index + 1}`,
    valor,
    meses_disponibles: 1,
    anio,
    mes_referencia: `${anio}-0${index + 1}-01`,
    meta,
  })),
  indicador_id: indicador.id,
  anio,
  granularity: 'mensual',
});

const setSeries = (data: SeriesResponse | undefined, overrides: Record<string, unknown> = {}) => {
  mockUseResultadosSeries.mockReturnValue({
    data,
    error: undefined,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    ...overrides,
  } as never);
};

const renderCard = (anio = 2020) =>
  renderWithSwr(
    <MemoryRouter>
      <IndicadorResumenCard indicador={indicador} anio={anio} />
    </MemoryRouter>,
  );

describe('IndicadorResumenCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the accumulated yearly value against the annual target', () => {
    setSeries(series(1000, [100, 200]));

    renderCard();

    expect(screen.getByText('Control de recién nacido')).toBeInTheDocument();
    expect(screen.getByText('300')).toBeInTheDocument();
    expect(screen.getByText('/ 1000')).toBeInTheDocument();
    expect(screen.getByText('30%')).toBeInTheDocument();
    expect(screen.getByText('2 de 12 meses calculados · Último: 2020-02')).toBeInTheDocument();
  });

  it('links the card title to the indicator results with the indicator preselected', () => {
    setSeries(series(1000, [100]));

    renderCard();

    expect(screen.getByRole('link', { name: 'Control de recién nacido' })).toHaveAttribute(
      'href',
      '/resultados?indicador=ind-001&anio=2020',
    );
  });

  it('labels a low band below the low threshold', () => {
    setSeries(series(1000, [100]));

    renderCard();

    expect(screen.getByText('10%')).toBeInTheDocument();
    expect(screen.getByText('Bajo')).toBeInTheDocument();
  });

  it('labels the medium band between the thresholds', () => {
    setSeries(series(1000, [200, 100]));

    renderCard();

    expect(screen.getByText('30%')).toBeInTheDocument();
    expect(screen.getByText('Medio')).toBeInTheDocument();
  });

  it('labels a high band at or above the high threshold', () => {
    setSeries(series(1000, [400, 300]));

    renderCard();

    expect(screen.getByText('70%')).toBeInTheDocument();
    expect(screen.getByText('Alto')).toBeInTheDocument();
  });

  it('shows a no-target state without a progress bar when there is no meta', () => {
    setSeries(series(null, [100]));

    renderCard();

    expect(screen.getByText('Sin meta')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByText('Bajo')).not.toBeInTheDocument();
  });

  it('does not divide by a zero target', () => {
    setSeries(series(0, [100]));

    renderCard();

    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('Sin meta')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('shows a loading state while the series is pending', () => {
    setSeries(undefined, { isLoading: true });

    renderCard();

    expect(screen.getByText('Cargando indicador...')).toBeInTheDocument();
  });

  it('shows an unavailable state when the series fails', () => {
    setSeries(undefined, { error: new Error('boom'), isError: true });

    renderCard();

    expect(screen.getByText('No disponible')).toBeInTheDocument();
  });

  it('shows a no-data state when the year has no results', () => {
    setSeries({ ...series(null, []), items: [] });

    renderCard();

    expect(screen.getByText('Sin datos para este año.')).toBeInTheDocument();
  });
});
