import {
  notifyError,
  notifySuccess,
  useCreateVersion,
  useIndicador,
  useResolvedOrdenes,
} from '../features/indicadores/hooks';
import { act, fireEvent, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { renderWithSwr } from 'test-utils';
import IndicadorDetailPage from './IndicadorDetailPage';

vi.mock('../features/indicadores/hooks', async () => ({
  ...(await vi.importActual('../features/indicadores/hooks')),
  useIndicador: vi.fn(),
  useCreateVersion: vi.fn(),
  useResolvedOrdenes: vi.fn(),
  notifyError: vi.fn(),
  notifySuccess: vi.fn(),
}));

const mockUseIndicador = vi.mocked(useIndicador);
const mockUseCreateVersion = vi.mocked(useCreateVersion);
const mockUseResolvedOrdenes = vi.mocked(useResolvedOrdenes);

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
      definicion: { tipo: 'conteo_atenciones' as const, evento: null },
      creado_en: '2026-01-15T10:00:00.000Z',
    },
    {
      id: 'ver-001-2',
      indicador_id: 'ind-001',
      version: 2,
      definicion: { tipo: 'conteo_atenciones' as const, evento: null },
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

    expect(screen.getByText('Error al cargar el indicador')).toBeInTheDocument();
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
        evento: null,
      }),
    );
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

    expect(notifyError).toHaveBeenCalledWith('Error del servidor');
  });
});
