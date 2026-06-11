import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { DefinicionIndicadorForm } from '../api/types';
import { useResolvedDiagnosticos, useResolvedLocations, useResolvedOrdenes } from '../features/indicadores/hooks';
import DefinicionView from './DefinicionView';

vi.mock('../features/indicadores/hooks', async () => ({
  ...(await vi.importActual('../features/indicadores/hooks')),
  useResolvedOrdenes: vi.fn(),
  useResolvedDiagnosticos: vi.fn(),
  useResolvedLocations: vi.fn(),
}));

const mockUseResolvedOrdenes = vi.mocked(useResolvedOrdenes);
const mockUseResolvedLocations = vi.mocked(useResolvedLocations);
const mockUseResolvedDiagnosticos = vi.mocked(useResolvedDiagnosticos);

function makeDefinicionWithOrdenes(uuids: Array<string>): DefinicionIndicadorForm {
  return {
    tipo: 'conteo_atenciones',
    evento: {
      location_uuids: [],
      ordenes: [{ concepto_uuids: uuids }],
    },
  };
}

function makeDefinicionWithoutOrdenes(): DefinicionIndicadorForm {
  return {
    tipo: 'conteo_atenciones',
    evento: {
      location_uuids: [],
      ordenes: [],
    },
  };
}

describe('DefinicionView orden rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseResolvedLocations.mockReturnValue({
      data: [],
      displayMap: new Map(),
      error: undefined,
      isLoading: false,
    } as ReturnType<typeof useResolvedLocations>);
    mockUseResolvedDiagnosticos.mockReturnValue({
      data: [],
      resolveMap: new Map(),
      error: undefined,
      isLoading: false,
    } as ReturnType<typeof useResolvedDiagnosticos>);
  });

  it('renders resolved orden names when resolution succeeds', () => {
    mockUseResolvedOrdenes.mockReturnValue({
      data: { 'ord-hemograma': 'Hemograma', 'ord-ferritina': 'Ferritina sérica' },
      displayMap: new Map([
        ['ord-hemograma', 'Hemograma'],
        ['ord-ferritina', 'Ferritina sérica'],
      ]),
      error: undefined,
      isLoading: false,
    });

    const definicion = makeDefinicionWithOrdenes(['ord-hemograma', 'ord-ferritina']);
    render(<DefinicionView definicion={definicion} />);

    expect(screen.getByText(/Órdenes:/)).toBeInTheDocument();
    expect(screen.getByText('Hemograma, Ferritina sérica')).toBeInTheDocument();
    expect(screen.queryByText('ord-hemograma')).not.toBeInTheDocument();
  });

  it('renders raw UUIDs when resolution returns empty Record', () => {
    mockUseResolvedOrdenes.mockReturnValue({
      data: {} as Record<string, string>,
      displayMap: new Map(),
      error: undefined,
      isLoading: false,
    });

    const definicion = makeDefinicionWithOrdenes(['ord-hemograma', 'ord-unknown']);
    render(<DefinicionView definicion={definicion} />);

    expect(screen.getByText(/Órdenes:/)).toBeInTheDocument();
    expect(screen.getByText('ord-hemograma, ord-unknown')).toBeInTheDocument();
  });

  it('renders "Sin filtro" when no ordenes defined', () => {
    mockUseResolvedOrdenes.mockReturnValue({
      data: undefined,
      displayMap: new Map(),
      error: undefined,
      isLoading: false,
    });

    const definicion = makeDefinicionWithoutOrdenes();
    render(<DefinicionView definicion={definicion} />);

    const sinFiltroElements = screen.getAllByText('Sin filtro', { exact: false });
    expect(sinFiltroElements.length).toBeGreaterThanOrEqual(1);
  });

  it('renders raw UUIDs when resolution is loading', () => {
    mockUseResolvedOrdenes.mockReturnValue({
      data: undefined,
      displayMap: new Map(),
      error: undefined,
      isLoading: true,
    });

    const definicion = makeDefinicionWithOrdenes(['ord-hemograma']);
    render(<DefinicionView definicion={definicion} />);

    expect(screen.getByText(/Órdenes:/)).toBeInTheDocument();
    expect(screen.getByText('ord-hemograma')).toBeInTheDocument();
  });
});

describe('DefinicionView periodo removal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseResolvedLocations.mockReturnValue({
      data: [],
      displayMap: new Map(),
      error: undefined,
      isLoading: false,
    } as ReturnType<typeof useResolvedLocations>);
    mockUseResolvedDiagnosticos.mockReturnValue({
      data: [],
      resolveMap: new Map(),
      error: undefined,
      isLoading: false,
    } as ReturnType<typeof useResolvedDiagnosticos>);
    mockUseResolvedOrdenes.mockReturnValue({
      data: undefined,
      displayMap: new Map(),
      error: undefined,
      isLoading: false,
    });
  });

  it('does NOT render a Periodo label in the definition view', () => {
    const definicion: DefinicionIndicadorForm = {
      tipo: 'conteo_atenciones',
      evento: { location_uuids: ['uuid-x'] },
    };
    render(<DefinicionView definicion={definicion} />);

    // The "Periodo:" label should never appear
    expect(screen.queryByText('Periodo:')).not.toBeInTheDocument();
    // Legacy periodo labels should not appear
    expect(screen.queryByText('Mes actual')).not.toBeInTheDocument();
    expect(screen.queryByText('Trimestre actual')).not.toBeInTheDocument();
  });

  it('still renders Tipo correctly without periodo', () => {
    const definicion: DefinicionIndicadorForm = {
      tipo: 'conteo_pacientes',
      evento: null,
    };
    render(<DefinicionView definicion={definicion} />);

    expect(screen.getByText(/Tipo:/)).toBeInTheDocument();
    expect(screen.getByText('Conteo de pacientes')).toBeInTheDocument();
  });
});
