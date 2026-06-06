import { notifyError, useDeleteIndicador, useIndicadores, useUpdateIndicador } from '../features/indicadores/hooks';
import { act, fireEvent, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { renderWithSwr } from 'test-utils';
import IndicadoresPage from './IndicadoresPage';

vi.mock('../features/indicadores/hooks', async () => ({
  ...(await vi.importActual('../features/indicadores/hooks')),
  useIndicadores: vi.fn(),
  useUpdateIndicador: vi.fn(),
  useDeleteIndicador: vi.fn(),
  notifyError: vi.fn(),
  notifySuccess: vi.fn(),
}));

const mockUseIndicadores = vi.mocked(useIndicadores);
const mockUseUpdateIndicador = vi.mocked(useUpdateIndicador);

const activeIndicator = {
  id: 'ind-001',
  nombre: 'Atenciones de control prenatal',
  descripcion: 'Gestantes atendidas con control prenatal en el periodo.',
  activo: true,
  creado_en: '2026-01-15T10:00:00.000Z',
};

const inactiveIndicator = {
  id: 'ind-003',
  nombre: 'Atenciones odontológicas preventivas',
  descripcion: 'Indicador de seguimiento para profilaxis y flúor.',
  activo: false,
  creado_en: '2026-03-20T14:45:00.000Z',
};

function renderPage() {
  return renderWithSwr(
    <MemoryRouter initialEntries={['/']}>
      <IndicadoresPage />
    </MemoryRouter>,
  );
}

describe('IndicadoresPage Toggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useDeleteIndicador).mockReturnValue({
      deleteIndicador: vi.fn().mockResolvedValue(undefined),
    });
  });

  it('renders Toggle as "Activo" when indicador.activo is true', () => {
    const mockUpdateIndicador = vi.fn().mockResolvedValue(activeIndicator);
    mockUseIndicadores.mockReturnValue({
      data: { items: [activeIndicator], total: 1, page: 1, size: 10, pages: 1 },
      error: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);
    mockUseUpdateIndicador.mockReturnValue({ updateIndicador: mockUpdateIndicador });

    renderPage();

    // The Toggle switch should have accessible name "Activo"
    const toggle = screen.getByRole('switch', { name: 'Activo' });
    expect(toggle).toBeInTheDocument();
    // The toggle should be checked (toggled)
    expect(toggle).toBeChecked();
  });

  it('renders Toggle as "Inactivo" when indicador.activo is false', () => {
    const mockUpdateIndicador = vi.fn().mockResolvedValue(inactiveIndicator);
    mockUseIndicadores.mockReturnValue({
      data: { items: [inactiveIndicator], total: 1, page: 1, size: 10, pages: 1 },
      error: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);
    mockUseUpdateIndicador.mockReturnValue({ updateIndicador: mockUpdateIndicador });

    renderPage();

    const toggle = screen.getByRole('switch', { name: 'Inactivo' });
    expect(toggle).toBeInTheDocument();
    expect(toggle).not.toBeChecked();
  });

  it('calls updateIndicador with inverted activo when Toggle is clicked', async () => {
    const mockUpdateIndicador = vi.fn().mockResolvedValue({ ...activeIndicator, activo: false });
    mockUseIndicadores.mockReturnValue({
      data: { items: [activeIndicator], total: 1, page: 1, size: 10, pages: 1 },
      error: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);
    mockUseUpdateIndicador.mockReturnValue({ updateIndicador: mockUpdateIndicador });

    renderPage();

    const toggle = screen.getByRole('switch', { name: 'Activo' });
    await act(async () => {
      fireEvent.click(toggle);
    });

    expect(mockUpdateIndicador).toHaveBeenCalledTimes(1);
    expect(mockUpdateIndicador).toHaveBeenCalledWith('ind-001', {
      nombre: 'Atenciones de control prenatal',
      descripcion: 'Gestantes atendidas con control prenatal en el periodo.',
      activo: false,
    });
  });

  it('shows error notification when updateIndicador fails on toggle', async () => {
    const mockUpdateIndicador = vi.fn().mockRejectedValue(new Error('Network Error'));
    mockUseIndicadores.mockReturnValue({
      data: { items: [activeIndicator], total: 1, page: 1, size: 10, pages: 1 },
      error: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);
    mockUseUpdateIndicador.mockReturnValue({ updateIndicador: mockUpdateIndicador });

    renderPage();

    const toggle = screen.getByRole('switch', { name: 'Activo' });
    await act(async () => {
      fireEvent.click(toggle);
    });

    expect(notifyError).toHaveBeenCalledWith('Network Error');
  });
});
