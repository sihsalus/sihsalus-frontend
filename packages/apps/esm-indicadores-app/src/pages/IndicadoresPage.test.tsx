import { act, fireEvent, screen, within } from '@testing-library/react';
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

function getTableDeactivateButton() {
  return within(screen.getByRole('table')).getByRole('button', { name: /Desactivar$/ });
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

  it('renders inactive indicators returned by the data source', () => {
    vi.mocked(useIndicadores).mockReturnValue({
      data: { items: [{ ...indicator, activo: false }], total: 1, page: 1, size: 10, pages: 1 },
      error: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderPage();

    expect(screen.getByText('Inactivo')).toBeInTheDocument();
  });

  it('reports deactivation success only after DELETE resolves', async () => {
    const deleteIndicador = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useDeleteIndicador).mockReturnValue({ deleteIndicador });
    renderPage();

    fireEvent.click(getTableDeactivateButton());
    expect(deleteIndicador).not.toHaveBeenCalled();

    await act(async () =>
      fireEvent.click(
        within(screen.getByRole('dialog', { name: 'Desactivar indicador' })).getByRole('button', {
          name: /Desactivar$/,
        }),
      ),
    );

    expect(deleteIndicador).toHaveBeenCalledWith('indicator-a');
    expect(notifySuccess).toHaveBeenCalledWith('Indicador desactivado');
    expect(screen.getByRole('dialog', { name: 'Desactivar indicador' })).not.toHaveTextContent(
      'Atenciones de control prenatal',
    );
  });

  it('identifies the indicator and waits for confirmation before DELETE', () => {
    const deleteIndicador = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useDeleteIndicador).mockReturnValue({ deleteIndicador });
    renderPage();

    fireEvent.click(getTableDeactivateButton());

    expect(screen.getByRole('dialog', { name: 'Desactivar indicador' })).toHaveTextContent(
      'Atenciones de control prenatal',
    );
    expect(deleteIndicador).not.toHaveBeenCalled();
  });

  it('closes the confirmation without DELETE when cancelled', () => {
    const deleteIndicador = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useDeleteIndicador).mockReturnValue({ deleteIndicador });
    renderPage();

    fireEvent.click(getTableDeactivateButton());
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Desactivar indicador' })).getByRole('button', { name: 'Cancelar' }),
    );

    expect(screen.getByRole('dialog', { name: 'Desactivar indicador' })).not.toHaveTextContent(
      'Atenciones de control prenatal',
    );
    expect(deleteIndicador).not.toHaveBeenCalled();
  });

  it('sends only one DELETE while deactivation is pending', async () => {
    let resolveDelete!: () => void;
    const pendingDelete = new Promise<void>((resolve) => {
      resolveDelete = resolve;
    });
    const deleteIndicador = vi.fn(async () => pendingDelete);
    vi.mocked(useDeleteIndicador).mockReturnValue({ deleteIndicador });
    renderPage();
    const button = getTableDeactivateButton();

    act(() => {
      fireEvent.click(button);
    });

    const confirm = within(screen.getByRole('dialog', { name: 'Desactivar indicador' })).getByRole('button', {
      name: /Desactivar$/,
    });
    fireEvent.click(confirm);
    expect(confirm).toBeDisabled();
    fireEvent.click(confirm);

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

    fireEvent.click(getTableDeactivateButton());
    await act(async () =>
      fireEvent.click(
        within(screen.getByRole('dialog', { name: 'Desactivar indicador' })).getByRole('button', {
          name: /Desactivar$/,
        }),
      ),
    );

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
