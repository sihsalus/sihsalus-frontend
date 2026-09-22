import {
  notifyError,
  notifySuccess,
  useCreateVersion,
  useIndicador,
  useResolvedDiagnosticos,
  useResolvedEncounterTypes,
  useResolvedLocations,
  useResolvedOrdenes,
} from '../features/indicadores/hooks';
import { act, fireEvent, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { renderWithSwr } from 'test-utils';
import IndicadorDetailPage from './IndicadorDetailPage';

vi.mock('../features/indicadores/hooks', () => ({
  getIndicatorsErrorMessage: vi.fn((_error, fallback) => fallback),
  useIndicador: vi.fn(),
  useCreateVersion: vi.fn(),
  useResolvedLocations: vi.fn(),
  useResolvedDiagnosticos: vi.fn(),
  useResolvedOrdenes: vi.fn(),
  useResolvedEncounterTypes: vi.fn(),
  useSQLPreview: vi.fn(() => ({
    data: undefined,
    error: undefined,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  })),
  useLocationSearch: vi.fn(() => ({ data: [], error: undefined, isLoading: false })),
  useDiagnosticoSearch: vi.fn(() => ({ data: [], error: undefined, isLoading: false })),
  useOrdenSearch: vi.fn(() => ({ data: [], error: undefined, isLoading: false })),
  useEncounterTypeSearch: vi.fn(() => ({ data: [], error: undefined, isLoading: false })),
  notifyError: vi.fn(),
  notifySuccess: vi.fn(),
}));

const mockUseIndicador = vi.mocked(useIndicador);
const mockUseCreateVersion = vi.mocked(useCreateVersion);
const mockUseResolvedLocations = vi.mocked(useResolvedLocations);
const mockUseResolvedDiagnosticos = vi.mocked(useResolvedDiagnosticos);
const mockUseResolvedOrdenes = vi.mocked(useResolvedOrdenes);
const mockUseResolvedEncounterTypes = vi.mocked(useResolvedEncounterTypes);

const sampleIndicator = {
  id: 'ind-001',
  nombre: 'Atenciones de control prenatal',
  descripcion: 'Gestantes atendidas con control prenatal.',
  activo: true,
  creado_en: '2026-01-15T10:00:00.000Z',
  versiones: [
    {
      id: 'ver-001-1',
      indicador_id: 'ind-001',
      version: 1,
      definicion: { tipo: 'conteo_atenciones' as const },
      creado_en: '2026-01-15T10:00:00.000Z',
    },
    {
      id: 'ver-001-2',
      indicador_id: 'ind-001',
      version: 2,
      definicion: { tipo: 'conteo_atenciones' as const },
      creado_en: '2026-02-20T14:30:00.000Z',
    },
  ],
};

function renderPage() {
  return renderWithSwr(
    <MemoryRouter initialEntries={['/ind-001']}>
      <Routes>
        <Route path="/:id" element={<IndicadorDetailPage />} />
        <Route path="/:id/edit" element={<div data-testid="edit-page">Edit Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('IndicadorDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseCreateVersion.mockReturnValue({
      createVersion: vi.fn().mockResolvedValue(undefined),
    } as never);

    mockUseResolvedOrdenes.mockReturnValue({
      data: {},
      displayMap: new Map(),
      error: undefined,
      isLoading: false,
    } as never);
    mockUseResolvedLocations.mockReturnValue({
      data: [],
      displayMap: new Map(),
      error: undefined,
      isLoading: false,
    } as never);
    mockUseResolvedDiagnosticos.mockReturnValue({
      data: [],
      resolveMap: new Map(),
      error: undefined,
      isLoading: false,
    } as never);
    mockUseResolvedEncounterTypes.mockReturnValue({
      data: [],
      displayMap: new Map(),
      error: undefined,
      isLoading: false,
    } as never);
  });

  it('shows loading state while fetching', () => {
    mockUseIndicador.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    } as never);

    renderPage();

    expect(screen.getByText('Cargando indicador...')).toBeInTheDocument();
  });

  it('shows error banner when useIndicador fails', () => {
    mockUseIndicador.mockReturnValue({
      data: undefined,
      error: new Error('Error al cargar el indicador'),
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    } as never);

    renderPage();

    expect(screen.getByText('No se pudo cargar el indicador.')).toBeInTheDocument();
    expect(screen.queryByText('Error al cargar el indicador')).not.toBeInTheDocument();
  });

  it('renders indicator name, description, and active tag', () => {
    mockUseIndicador.mockReturnValue({
      data: sampleIndicator,
      error: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);

    renderPage();

    expect(screen.getByText('Atenciones de control prenatal')).toBeInTheDocument();
    expect(screen.getByText('Gestantes atendidas con control prenatal.')).toBeInTheDocument();
    expect(screen.getByText('Activo')).toBeInTheDocument();
  });

  it('shows "Sin descripción" when descripcion is null', () => {
    mockUseIndicador.mockReturnValue({
      data: { ...sampleIndicator, descripcion: null },
      error: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);

    renderPage();

    expect(screen.getByText('Sin descripción')).toBeInTheDocument();
  });

  it('shows inactive tag when activo is false', () => {
    mockUseIndicador.mockReturnValue({
      data: { ...sampleIndicator, activo: false },
      error: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);

    renderPage();

    expect(screen.getByText('Inactivo')).toBeInTheDocument();
  });

  it('"Editar metadata" button navigates to edit page', () => {
    mockUseIndicador.mockReturnValue({
      data: sampleIndicator,
      error: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);

    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Editar metadata' }));

    // After navigation, the edit page placeholder should be rendered
    expect(screen.getByTestId('edit-page')).toBeInTheDocument();
  });

  it('"Nueva versión" button toggles version form visibility', () => {
    mockUseIndicador.mockReturnValue({
      data: sampleIndicator,
      error: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);

    renderPage();

    // Form should not be visible initially
    expect(screen.queryByText('Crear nueva versión')).not.toBeInTheDocument();

    // Click "Nueva versión" to show the form
    fireEvent.click(screen.getByRole('button', { name: 'Nueva versión' }));
    expect(screen.getByText('Crear nueva versión')).toBeInTheDocument();

    // Click "Cancelar nueva versión" to hide the form
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar nueva versión' }));
    expect(screen.queryByText('Crear nueva versión')).not.toBeInTheDocument();
  });

  it('shows version history with correct version numbers', () => {
    mockUseIndicador.mockReturnValue({
      data: sampleIndicator,
      error: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);

    renderPage();

    expect(screen.getByText('Versión #1')).toBeInTheDocument();
    expect(screen.getByText('Versión #2')).toBeInTheDocument();
  });

  it('hydrates all new-version resource selectors with resolved names', () => {
    mockUseIndicador.mockReturnValue({
      data: {
        ...sampleIndicator,
        versiones: [
          {
            ...sampleIndicator.versiones[1],
            definicion: {
              tipo: 'conteo_atenciones',
              evento: {
                location_uuids: ['loc-001'],
                diagnosticos: [{ concepto_uuids: ['dx-001'], tipo_diagnostico: 'presuntivo' }],
                ordenes: [{ concepto_uuid: 'ord-001' }],
              },
            },
          },
        ],
      },
      error: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);
    mockUseResolvedLocations.mockReturnValue({
      data: [{ uuid: 'loc-001', display: 'Centro Obstétrico' }],
      displayMap: new Map([['loc-001', 'Centro Obstétrico']]),
      error: undefined,
      isLoading: false,
    } as never);
    mockUseResolvedDiagnosticos.mockReturnValue({
      data: [{ uuid: 'dx-001', nombre: 'Anemia ferropénica' }],
      resolveMap: new Map([['dx-001', { uuid: 'dx-001', nombre: 'Anemia ferropénica' }]]),
      error: undefined,
      isLoading: false,
    } as never);
    mockUseResolvedOrdenes.mockImplementation(
      (uuids) =>
        ({
          data: uuids.length ? { 'ord-001': 'Hemograma' } : {},
          displayMap: uuids.length ? new Map([['ord-001', 'Hemograma']]) : new Map(),
          error: undefined,
          isLoading: false,
        }) as never,
    );

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Nueva versión' }));

    const selectedPills = Array.from(document.querySelectorAll('.selectedItemPill'));
    expect(selectedPills.some((pill) => pill.textContent?.includes('Centro Obstétrico'))).toBe(true);
    expect(selectedPills.some((pill) => pill.textContent?.includes('Anemia ferropénica'))).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Órdenes' }));
    expect(
      Array.from(document.querySelectorAll('.selectedItemPill')).some((pill) =>
        pill.textContent?.includes('Hemograma'),
      ),
    ).toBe(true);
  });

  it('hydrates the new-version form with a window definition and its encounter types', () => {
    mockUseIndicador.mockReturnValue({
      data: {
        ...sampleIndicator,
        versiones: [
          {
            id: 'ver-001-1',
            indicador_id: 'ind-001',
            version: 1,
            creado_en: '2026-01-15T10:00:00.000Z',
            definicion: {
              tipo: 'conteo_pacientes_ventana',
              evento: { encounter_type_uuids: ['enc-cred-neonato'], minimo_ocurrencias: 4 },
              poblacion: { max_dias: 28 },
            },
          },
        ],
      },
      error: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);
    mockUseResolvedEncounterTypes.mockReturnValue({
      data: [{ uuid: 'enc-cred-neonato', display: 'CRED Neonato' }],
      displayMap: new Map([['enc-cred-neonato', 'CRED Neonato']]),
      error: undefined,
      isLoading: false,
    } as never);

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Nueva versión' }));

    const selectedPills = Array.from(document.querySelectorAll('.selectedItemPill'));
    expect(selectedPills.some((pill) => pill.textContent?.includes('CRED Neonato'))).toBe(true);
    expect(screen.getByLabelText('Mínimo de ocurrencias')).toHaveValue(4);
    expect(screen.getByLabelText('Edad máxima días')).toHaveValue(28);
  });

  it('keeps the new-version form unmounted while selected definition names are loading', () => {
    mockUseIndicador.mockReturnValue({
      data: {
        ...sampleIndicator,
        versiones: [
          {
            ...sampleIndicator.versiones[1],
            definicion: {
              tipo: 'conteo_atenciones',
              evento: { location_uuids: ['loc-001'] },
            },
          },
        ],
      },
      error: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);
    mockUseResolvedLocations.mockReturnValue({
      data: [],
      displayMap: new Map(),
      error: undefined,
      isLoading: true,
    } as never);

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Nueva versión' }));

    expect(screen.queryByRole('button', { name: 'Crear versión' })).not.toBeInTheDocument();
    expect(screen.getByText('Cargando nombres clínicos...')).toBeInTheDocument();
  });

  it('renders without throwing when the indicator has an empty versiones array', () => {
    mockUseIndicador.mockReturnValue({
      data: { ...sampleIndicator, versiones: [] },
      error: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);

    // Regression: previously `latestVersion` called `.reduce()` without an
    // initial value on an empty array, throwing
    // `TypeError: Reduce of empty array with no initial value`.
    expect(() => renderPage()).not.toThrow();

    // The page should still render the indicator header and the (empty)
    // version history list, without a "current definition" section.
    expect(screen.getByText('Atenciones de control prenatal')).toBeInTheDocument();
    expect(screen.getByText('Historial de versiones')).toBeInTheDocument();
    expect(screen.queryByText('Definición actual')).not.toBeInTheDocument();
    // No version summary items should be present
    expect(screen.queryByText('Versión #1')).not.toBeInTheDocument();
  });

  it('calls createVersion on form submit and shows success notification', async () => {
    const createVersionMock = vi.fn().mockResolvedValue(undefined);
    mockUseCreateVersion.mockReturnValue({ createVersion: createVersionMock });
    mockUseIndicador.mockReturnValue({
      data: sampleIndicator,
      error: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);

    renderPage();

    // Open version form
    fireEvent.click(screen.getByRole('button', { name: 'Nueva versión' }));

    // Submit the form
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Crear versión' }));
    });

    expect(createVersionMock).toHaveBeenCalledTimes(1);
    expect(createVersionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: 'conteo_atenciones',
      }),
    );
    expect(createVersionMock.mock.calls[0][0]).not.toHaveProperty('evento');
    expect(notifySuccess).toHaveBeenCalledWith('Versión creada');
  });

  it('shows error notification when createVersion fails', async () => {
    const createVersionMock = vi.fn().mockRejectedValue(new Error('Error del servidor'));
    mockUseCreateVersion.mockReturnValue({ createVersion: createVersionMock });
    mockUseIndicador.mockReturnValue({
      data: sampleIndicator,
      error: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);

    renderPage();

    // Open version form
    fireEvent.click(screen.getByRole('button', { name: 'Nueva versión' }));

    // Submit the form
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Crear versión' }));
    });

    expect(notifyError).toHaveBeenCalledWith('No se pudo crear la versión.');
    expect(notifySuccess).not.toHaveBeenCalled();
  });

  it('blocks duplicate version creation while the first request is pending', async () => {
    let resolveCreate: (value: unknown) => void = () => {};
    const createVersionMock = vi.fn().mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve;
      }),
    );
    mockUseCreateVersion.mockReturnValue({ createVersion: createVersionMock });
    mockUseIndicador.mockReturnValue({
      data: sampleIndicator,
      error: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Nueva versión' }));

    const button = screen.getByRole('button', { name: 'Crear versión' });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(createVersionMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Guardando...' })).toBeDisabled();
    await act(async () => resolveCreate(undefined));
  });
});
