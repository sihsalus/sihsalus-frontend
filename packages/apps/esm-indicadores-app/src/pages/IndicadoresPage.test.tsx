import { act, fireEvent, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { renderWithSwr } from 'test-utils';
import { notifyError, notifySuccess, useDeleteIndicador, useIndicadores } from '../features/indicadores/hooks';
import IndicadoresPage from './IndicadoresPage';

vi.mock('../features/indicadores/hooks', () => ({
  getIndicatorsErrorMessage: vi.fn((_error, fallback) => fallback),
  useIndicadores: vi.fn(),
  useDeleteIndicador: vi.fn(),
  notifyError: vi.fn(),
  notifySuccess: vi.fn(),
}));

const indicator = {
  id: 'indicator-a',
  nombre: 'Atenciones de control prenatal',
  descripcion: 'Gestantes atendidas.',
  activo: true,
  creado_en: '2026-01-15T10:00:00.000Z',
};

function renderPage() {
  return renderWithSwr(
    <MemoryRouter initialEntries={['/']}>
      <IndicadoresPage />
    </MemoryRouter>,
  );
}

describe('IndicadoresPage backend contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useIndicadores).mockReturnValue({
      data: { items: [indicator], total: 1, page: 1, size: 10, pages: 1 },
      error: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    vi.mocked(useDeleteIndicador).mockReturnValue({ deleteIndicador: vi.fn().mockResolvedValue(undefined) });
  });

  it('renders active list metadata without an unsupported state toggle', () => {
    renderPage();

    expect(screen.getByText('Activo')).toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });

  it('reports deactivation success only after DELETE resolves', async () => {
    const deleteIndicador = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useDeleteIndicador).mockReturnValue({ deleteIndicador });
    renderPage();

    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Desactivar$/ })));

    expect(deleteIndicador).toHaveBeenCalledWith('indicator-a');
    expect(notifySuccess).toHaveBeenCalledWith('Indicador desactivado');
  });

  it('sends only one DELETE while deactivation is pending', async () => {
    let resolveDelete!: () => void;
    const pendingDelete = new Promise<void>((resolve) => {
      resolveDelete = resolve;
    });
    const deleteIndicador = vi.fn(async () => pendingDelete);
    vi.mocked(useDeleteIndicador).mockReturnValue({ deleteIndicador });
    renderPage();
    const button = screen.getByRole('button', { name: /Desactivar$/ });

    act(() => {
      fireEvent.click(button);
      fireEvent.click(button);
    });

    expect(deleteIndicador).toHaveBeenCalledTimes(1);
    expect(notifySuccess).not.toHaveBeenCalled();
    await act(async () => resolveDelete());
    expect(notifySuccess).toHaveBeenCalledWith('Indicador desactivado');
  });

  it.each([422, 500])('does not report success after HTTP %s deactivation failure', async (status) => {
    vi.mocked(useDeleteIndicador).mockReturnValue({
      deleteIndicador: vi.fn().mockRejectedValue({ response: { status } }),
    });
    renderPage();

    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Desactivar$/ })));

    expect(notifySuccess).not.toHaveBeenCalled();
    expect(notifyError).toHaveBeenCalledWith('No se pudo desactivar el indicador.');
  });

  it('does not expose a technical list error', () => {
    vi.mocked(useIndicadores).mockReturnValue({
      data: undefined,
      error: new Error('SQL timeout at host 10.0.0.1'),
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    });
    renderPage();

    expect(screen.getByText('No se pudieron cargar los indicadores.')).toBeInTheDocument();
    expect(screen.queryByText(/SQL timeout/)).not.toBeInTheDocument();
  });
});
