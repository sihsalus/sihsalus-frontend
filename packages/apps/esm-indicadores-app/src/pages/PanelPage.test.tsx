import { screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { renderWithSwr } from 'test-utils';
import type { Indicador, SeriesResponse } from '../api/types';
import PanelPage from './PanelPage';

vi.mock('../features/indicadores/hooks', async () => ({
  ...(await vi.importActual('../features/indicadores/hooks')),
  useAllIndicadores: vi.fn(),
}));

vi.mock('../features/resultados/hooks', async () => ({
  ...(await vi.importActual('../features/resultados/hooks')),
  useResultadosSeries: vi.fn(),
}));

import { useAllIndicadores } from '../features/indicadores/hooks';
import { useResultadosSeries } from '../features/resultados/hooks';

const mockUseAllIndicadores = vi.mocked(useAllIndicadores);
const mockUseResultadosSeries = vi.mocked(useResultadosSeries);

const activo: Indicador = {
  id: 'ind-001',
  nombre: 'Control de recién nacido',
  descripcion: null,
  activo: true,
  creado_en: '2024-01-01',
};

const inactivo: Indicador = {
  id: 'ind-002',
  nombre: 'Anemia',
  descripcion: null,
  activo: false,
  creado_en: '2024-02-01',
};

const series: SeriesResponse = {
  items: [
    {
      periodo_label: '2020-01',
      valor: 100,
      meses_disponibles: 1,
      anio: 2020,
      mes_referencia: '2020-01-01',
      meta: 1000,
    },
  ],
  indicador_id: 'ind-001',
  anio: 2020,
  granularity: 'mensual',
};

const setIndicadores = (data: Array<Indicador> | undefined, overrides: Record<string, unknown> = {}) => {
  mockUseAllIndicadores.mockReturnValue({
    data,
    error: undefined,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    ...overrides,
  } as never);
};

const renderPanel = () =>
  renderWithSwr(
    <MemoryRouter>
      <PanelPage />
    </MemoryRouter>,
  );

describe('PanelPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setIndicadores([activo, inactivo]);
    mockUseResultadosSeries.mockReturnValue({
      data: series,
      error: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);
  });

  it('renders one summary card per active indicator and skips inactive ones', () => {
    renderPanel();

    expect(screen.getByText('Control de recién nacido')).toBeInTheDocument();
    expect(screen.queryByText('Anemia')).not.toBeInTheDocument();
  });

  it('defaults the year selector to the current year', () => {
    renderPanel();

    expect(screen.getByLabelText('Año')).toHaveValue(String(new Date().getFullYear()));
  });

  it('shows an empty state when there are no active indicators', () => {
    setIndicadores([inactivo]);

    renderPanel();

    expect(screen.getByText('No hay indicadores activos para mostrar.')).toBeInTheDocument();
  });

  it('shows an error banner when the catalogue fails', () => {
    setIndicadores(undefined, { error: new Error('boom'), isError: true });

    renderPanel();

    expect(screen.getByText('No se pudieron cargar los indicadores.')).toBeInTheDocument();
    expect(screen.queryByText('Control de recién nacido')).not.toBeInTheDocument();
  });
});
