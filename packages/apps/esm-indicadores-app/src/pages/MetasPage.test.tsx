import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { renderWithSwr } from 'test-utils';
import type { IndicadorMeta, IndicadorMetaCreatePayload } from '../api/types';
import { notifyError, notifySuccess, useIndicadores } from '../features/indicadores/hooks';
import { useDeleteMeta, useMetaByIndicator, useUpsertMeta } from '../features/metas/hooks';
import MetasPage from './MetasPage';

vi.mock('../features/indicadores/hooks', () => ({
  getIndicatorsErrorMessage: vi.fn((_error, fallback) => fallback),
  notifyError: vi.fn(),
  notifySuccess: vi.fn(),
  useIndicadores: vi.fn(),
}));

vi.mock('../features/metas/hooks', () => ({
  useMetaByIndicator: vi.fn(),
  useUpsertMeta: vi.fn(),
  useDeleteMeta: vi.fn(),
}));

vi.mock('../components/MetaFormModal', () => ({
  default: ({
    initialMeta,
    onSubmit,
  }: {
    initialMeta?: IndicadorMeta | null;
    onSubmit: (payload: IndicadorMetaCreatePayload, indicatorId: string) => Promise<void>;
  }) => (
    <div role="dialog" aria-label={initialMeta ? 'Editar meta' : 'Nueva meta'}>
      <button
        type="button"
        onClick={() => onSubmit({ indicador_version_id: 'version-a', anio: 2026, valor_meta: 1500 }, 'indicator-a')}
      >
        Guardar meta de prueba
      </button>
    </div>
  ),
}));

const mockUseIndicadores = vi.mocked(useIndicadores);
const mockUseMetaByIndicator = vi.mocked(useMetaByIndicator);
const mockUseUpsertMeta = vi.mocked(useUpsertMeta);
const mockUseDeleteMeta = vi.mocked(useDeleteMeta);

const sampleMeta: IndicadorMeta = {
  id: 'meta-a',
  indicador_version_id: 'version-a',
  anio: 2026,
  valor_meta: 1500,
  creado_en: '2026-01-01',
  indicador_nombre: 'Control prenatal',
  version_numero: 2,
};

function renderPage() {
  return renderWithSwr(
    <MemoryRouter initialEntries={['/metas']}>
      <MetasPage />
    </MemoryRouter>,
  );
}

async function selectIndicator(container: HTMLElement) {
  const input = container.querySelector('#meta-filter-indicator') as HTMLInputElement;
  fireEvent.input(input, { target: { value: 'Control prenatal' } });
  await act(async () => fireEvent.click(screen.getByText('Control prenatal')));
}

describe('MetasPage', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mockUseIndicadores.mockReturnValue({
      data: {
        items: [
          {
            id: 'indicator-a',
            nombre: 'Control prenatal',
            descripcion: null,
            activo: true,
            creado_en: '2026-01-01',
          },
        ],
        total: 1,
        page: 1,
        size: 100,
        pages: 1,
      },
      error: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    mockUseMetaByIndicator.mockReturnValue({
      data: sampleMeta,
      error: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    mockUseUpsertMeta.mockReturnValue({ upsertMeta: vi.fn().mockResolvedValue(undefined) });
    mockUseDeleteMeta.mockReturnValue({ deleteMeta: vi.fn().mockResolvedValue(undefined) });
  });

  it('requires an indicator and year lookup instead of requesting a nonexistent global list', () => {
    renderPage();

    expect(screen.getByText(/Seleccioná un indicador y un año/i)).toBeInTheDocument();
    expect(mockUseMetaByIndicator).toHaveBeenCalledWith('', null);
  });

  it('renders the meta returned for the selected indicator and year', async () => {
    const { container } = renderPage();
    await selectIndicator(container);

    expect(mockUseMetaByIndicator).toHaveBeenLastCalledWith('indicator-a', 2026);
    expect(screen.getByText('1500')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('shows an unconfigured state for a 404-normalized null result', async () => {
    mockUseMetaByIndicator.mockReturnValue({
      data: null,
      error: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    const { container } = renderPage();
    await selectIndicator(container);

    expect(screen.getByText(/No hay una meta configurada/i)).toBeInTheDocument();
  });

  it('shows a stable Spanish error for a 500 instead of an empty state or technical detail', async () => {
    mockUseMetaByIndicator.mockReturnValue({
      data: undefined,
      error: new Error('SQL connection refused'),
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    });
    const { container } = renderPage();
    await selectIndicator(container);

    expect(screen.getByText('No se pudo consultar la meta.')).toBeInTheDocument();
    expect(screen.queryByText('SQL connection refused')).not.toBeInTheDocument();
    expect(screen.queryByText(/No hay una meta configurada/i)).not.toBeInTheDocument();
  });

  it('opens the create modal without claiming a save', async () => {
    renderPage();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Nueva meta/i })));

    expect(screen.getByRole('dialog', { name: 'Nueva meta' })).toBeInTheDocument();
    expect(notifySuccess).not.toHaveBeenCalled();
  });

  it('saves only once while the PUT request is pending', async () => {
    let resolveUpsert!: () => void;
    const pendingUpsert = new Promise<void>((resolve) => {
      resolveUpsert = resolve;
    });
    const upsertMeta = vi.fn(async (payload: IndicadorMetaCreatePayload) => {
      await pendingUpsert;
      return { id: 'meta-a', ...payload, creado_en: '2026-01-01' };
    });
    mockUseUpsertMeta.mockReturnValue({ upsertMeta });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Nueva meta/i }));

    const save = screen.getByRole('button', { name: /Guardar meta de prueba/i });
    fireEvent.click(save);
    fireEvent.click(save);

    expect(upsertMeta).toHaveBeenCalledTimes(1);
    expect(notifySuccess).not.toHaveBeenCalled();
    await act(async () => resolveUpsert());
    await waitFor(() => expect(notifySuccess).toHaveBeenCalledWith('Meta guardada'));
  });

  it.each([
    ['HTTP 422', { response: { status: 422 } }],
    ['HTTP 500', { response: { status: 500 } }],
    ['un error de red', new TypeError('Failed to fetch')],
  ])('does not report a saved meta after %s', async (_scenario, error) => {
    mockUseUpsertMeta.mockReturnValue({ upsertMeta: vi.fn().mockRejectedValue(error) });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Nueva meta/i }));

    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Guardar meta de prueba/i })));

    expect(notifySuccess).not.toHaveBeenCalled();
    expect(notifyError).toHaveBeenCalledWith('No se pudo guardar la meta.');
  });

  it('calls the real delete hook and reports success only after it resolves', async () => {
    const deleteMeta = vi.fn().mockResolvedValue(undefined);
    mockUseDeleteMeta.mockReturnValue({ deleteMeta });
    const { container } = renderPage();
    await selectIndicator(container);
    await act(async () => fireEvent.click(screen.getAllByRole('button', { name: /Eliminar$/ })[0]));
    const confirmButtons = screen.getAllByRole('button', { name: /Eliminar$/ });
    await act(async () => fireEvent.click(confirmButtons[confirmButtons.length - 1]));

    expect(deleteMeta).toHaveBeenCalledWith('version-a', 2026);
    expect(notifySuccess).toHaveBeenCalledWith('Meta eliminada');
  });

  it.each([422, 500])('does not report success when delete fails with HTTP %s', async (status) => {
    const error = { response: { status } };
    mockUseDeleteMeta.mockReturnValue({ deleteMeta: vi.fn().mockRejectedValue(error) });
    const { container } = renderPage();
    await selectIndicator(container);
    await act(async () => fireEvent.click(screen.getAllByRole('button', { name: /Eliminar$/ })[0]));
    const confirmButtons = screen.getAllByRole('button', { name: /Eliminar$/ });
    await act(async () => fireEvent.click(confirmButtons[confirmButtons.length - 1]));

    expect(notifySuccess).not.toHaveBeenCalled();
    expect(notifyError).toHaveBeenCalledWith('No se pudo eliminar la meta.');
  });

  it('calls delete only once while the request is pending', async () => {
    let resolveDelete!: () => void;
    const deleteMeta = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveDelete = resolve;
        }),
    );
    mockUseDeleteMeta.mockReturnValue({ deleteMeta });
    const { container } = renderPage();
    await selectIndicator(container);
    fireEvent.click(screen.getAllByRole('button', { name: /Eliminar$/ })[0]);
    const confirmButtons = screen.getAllByRole('button', { name: /Eliminar$/ });
    const confirm = confirmButtons[confirmButtons.length - 1];

    fireEvent.click(confirm);
    fireEvent.click(confirm);

    expect(deleteMeta).toHaveBeenCalledTimes(1);
    expect(notifySuccess).not.toHaveBeenCalled();
    await act(async () => resolveDelete());
    await waitFor(() => expect(notifySuccess).toHaveBeenCalledWith('Meta eliminada'));
  });
});
