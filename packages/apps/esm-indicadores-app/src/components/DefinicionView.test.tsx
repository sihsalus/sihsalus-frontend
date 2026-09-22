import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { DefinicionIndicadorForm } from '../api/types';
import {
  useResolvedDiagnosticos,
  useResolvedEncounterTypes,
  useResolvedLocations,
  useResolvedOrdenes,
} from '../features/indicadores/hooks';
import DefinicionView from './DefinicionView';

vi.mock('../features/indicadores/hooks', async () => ({
  ...(await vi.importActual('../features/indicadores/hooks')),
  useResolvedOrdenes: vi.fn(),
  useResolvedDiagnosticos: vi.fn(),
  useResolvedLocations: vi.fn(),
  useResolvedEncounterTypes: vi.fn(),
}));

const mockUseResolvedOrdenes = vi.mocked(useResolvedOrdenes);
const mockUseResolvedLocations = vi.mocked(useResolvedLocations);
const mockUseResolvedDiagnosticos = vi.mocked(useResolvedDiagnosticos);
const mockUseResolvedEncounterTypes = vi.mocked(useResolvedEncounterTypes);

function mockDefaultResolvedHooks() {
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
  mockUseResolvedEncounterTypes.mockReturnValue({
    data: [],
    displayMap: new Map(),
    error: undefined,
    isLoading: false,
  } as ReturnType<typeof useResolvedEncounterTypes>);
}

function makeDefinicionWithOrdenes(uuids: Array<string>): DefinicionIndicadorForm {
  return {
    tipo: 'conteo_atenciones',
    evento: {
      ordenes: uuids.map((concepto_uuid) => ({ concepto_uuid })),
    },
  };
}

function makeDefinicionWithoutOrdenes(): DefinicionIndicadorForm {
  return {
    tipo: 'conteo_atenciones',
    evento: {
      ordenes: [],
    },
  };
}

describe('DefinicionView orden rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDefaultResolvedHooks();
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

describe('DefinicionView with pre-resolved names', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDefaultResolvedHooks();
    mockUseResolvedOrdenes.mockReturnValue({
      data: undefined,
      displayMap: new Map(),
      error: undefined,
      isLoading: false,
    });
  });

  it('renders resolved names and issues no resolve requests when resolved maps are provided', () => {
    const definicion: DefinicionIndicadorForm = {
      tipo: 'conteo_atenciones',
      evento: {
        location_uuids: ['loc-a'],
        ordenes: [{ concepto_uuid: 'ord-a' }],
        encounter_type_uuids: ['enc-a'],
      },
    };
    render(
      <DefinicionView
        definicion={definicion}
        resolved={{
          locationNames: new Map([['loc-a', 'Servicio A']]),
          diagnosticoNames: new Map(),
          ordenNames: new Map([['ord-a', 'Hemograma']]),
          encounterTypeNames: new Map([['enc-a', 'CRED Neonato']]),
        }}
      />,
    );

    expect(screen.getByText('Servicio A')).toBeInTheDocument();
    expect(screen.getByText('Hemograma')).toBeInTheDocument();
    expect(screen.getByText('CRED Neonato')).toBeInTheDocument();
    expect(mockUseResolvedOrdenes).toHaveBeenCalledWith([]);
    expect(mockUseResolvedLocations).toHaveBeenCalledWith([]);
    expect(mockUseResolvedDiagnosticos).toHaveBeenCalledWith([]);
    expect(mockUseResolvedEncounterTypes).toHaveBeenCalledWith([]);
  });
});

describe('DefinicionView age rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDefaultResolvedHooks();
    mockUseResolvedOrdenes.mockReturnValue({
      data: undefined,
      displayMap: new Map(),
      error: undefined,
      isLoading: false,
    });
  });

  it('renders year-based age bounds', () => {
    render(
      <DefinicionView definicion={{ tipo: 'conteo_atenciones', poblacion: { min_anios: 10, max_anios_excl: 50 } }} />,
    );

    expect(screen.getByText(/min 10 años \/ max 50 años/)).toBeInTheDocument();
  });

  it('renders month and day constraints instead of hiding them', () => {
    render(
      <DefinicionView
        definicion={{
          tipo: 'conteo_atenciones',
          poblacion: {
            min_meses: 6,
            min_dias: 2,
            max_meses_excl: 12,
            max_dias: 4,
          },
        }}
      />,
    );

    expect(screen.getByText(/min 6 meses, 2 días \/ max 12 meses, 4 días/)).toBeInTheDocument();
  });

  it('renders a placeholder when no age bounds are defined', () => {
    render(<DefinicionView definicion={{ tipo: 'conteo_atenciones' }} />);

    expect(screen.getByText(/min - \/ max -/)).toBeInTheDocument();
  });
});

describe('DefinicionView periodo removal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDefaultResolvedHooks();
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
    };
    render(<DefinicionView definicion={definicion} />);

    expect(screen.getByText(/Tipo:/)).toBeInTheDocument();
    expect(screen.getByText('Conteo de pacientes')).toBeInTheDocument();
  });
});

describe('DefinicionView encounter types', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDefaultResolvedHooks();
    mockUseResolvedOrdenes.mockReturnValue({
      data: undefined,
      displayMap: new Map(),
      error: undefined,
      isLoading: false,
    });
  });

  it('renders resolved encounter-type names and the window tipo label', () => {
    mockUseResolvedEncounterTypes.mockReturnValue({
      data: [],
      displayMap: new Map([['enc-cred', 'CRED Neonato']]),
      error: undefined,
      isLoading: false,
    });

    const definicion: DefinicionIndicadorForm = {
      tipo: 'conteo_pacientes_ventana',
      evento: {
        encounter_type_uuids: ['enc-cred'],
        minimo_ocurrencias: 4,
      },
      poblacion: { max_dias: 28 },
    };
    render(<DefinicionView definicion={definicion} />);

    expect(screen.getByText('Conteo de pacientes en ventana etaria')).toBeInTheDocument();
    expect(screen.getByText(/Tipos de encuentro:/)).toBeInTheDocument();
    expect(screen.getByText('CRED Neonato')).toBeInTheDocument();
    expect(screen.getByText(/min - \/ max 28 días/)).toBeInTheDocument();
  });

  it('renders raw UUIDs when encounter-type names are unavailable', () => {
    mockUseResolvedEncounterTypes.mockReturnValue({
      data: [],
      displayMap: new Map(),
      error: undefined,
      isLoading: false,
    });

    const definicion: DefinicionIndicadorForm = {
      tipo: 'conteo_pacientes_ventana',
      evento: { encounter_type_uuids: ['enc-unknown'] },
    };
    render(<DefinicionView definicion={definicion} />);

    expect(screen.getByText('enc-unknown')).toBeInTheDocument();
  });
});
