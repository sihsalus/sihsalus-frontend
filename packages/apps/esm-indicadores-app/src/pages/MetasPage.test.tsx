import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { renderWithSwr } from 'test-utils';
import type { IndicadorMeta } from '../api/types';
import { notifyError, notifySuccess } from '../features/indicadores/hooks';
import { useDeleteMeta, useMetas, useUpsertMeta } from '../features/metas/hooks';
import MetasPage from './MetasPage';

vi.mock('../features/indicadores/hooks', async () => ({
  ...(await vi.importActual('../features/indicadores/hooks')),
  notifyError: vi.fn(),
}));

vi.mock('../features/metas/hooks', async () => ({
  ...(await vi.importActual('../features/metas/hooks')),
  useMetas: vi.fn(),
  useUpsertMeta: vi.fn(),
  useDeleteMeta: vi.fn(),
}));

const mockUseMetas = vi.mocked(useMetas);
const mockUseUpsertMeta = vi.mocked(useUpsertMeta);
const mockUseDeleteMeta = vi.mocked(useDeleteMeta);

const sampleMetas: Array<IndicadorMeta> = [
  { id: 'meta-1', indicador_version_id: 'ver-001-1', anio: 2026, valor_meta: 1500, creado_en: '2026-01-01', indicador_nombre: 'Control prenatal', version_numero: 1 },
];

function renderPage() {
  return renderWithSwr(
    <MemoryRouter initialEntries={['/metas']}>
      <MetasPage />
    </MemoryRouter>,
  );
}

describe('MetasPage', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();

    mockUseUpsertMeta.mockReturnValue({ upsertMeta: vi.fn().mockResolvedValue(undefined) });
    mockUseDeleteMeta.mockReturnValue({ deleteMeta: vi.fn().mockResolvedValue(undefined) });
  });

  it('renders metas with resolved indicator name and version number', () => {
    mockUseMetas.mockReturnValue({
      data: sampleMetas,
      error: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);

    renderPage();

    expect(screen.getByText('Control prenatal')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2026')).toBeInTheDocument();
    expect(screen.getByText('1500')).toBeInTheDocument();
  });

  it('shows an empty state when no metas exist', () => {
    mockUseMetas.mockReturnValue({
      data: [],
      error: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);

    renderPage();

    expect(screen.getByText(/No hay metas configuradas/i)).toBeInTheDocument();
  });

  it('opens the create modal when clicking "Nueva meta"', async () => {
    mockUseMetas.mockReturnValue({
      data: [],
      error: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);

    renderPage();

    const newButton = screen.getByRole('button', { name: /Nueva meta/i });
    await act(async () => {
      fireEvent.click(newButton);
    });

    expect(screen.getByRole('heading', { name: /Nueva meta/i })).toBeInTheDocument();
  });

  it('opens the edit modal pre-filled with the selected meta', async () => {
    mockUseMetas.mockReturnValue({
      data: sampleMetas,
      error: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);

    renderPage();

    const editButton = screen.getByRole('button', { name: /Editar/i });
    await act(async () => {
      fireEvent.click(editButton);
    });

    expect(screen.getByRole('heading', { name: /Editar meta/i })).toBeInTheDocument();
    expect((screen.getByLabelText('Año') as HTMLInputElement).value).toBe('2026');
  });

  it('calls deleteMeta after confirming the delete action', async () => {
    const deleteMetaMock = vi.fn().mockResolvedValue(undefined);
    mockUseDeleteMeta.mockReturnValue({ deleteMeta: deleteMetaMock });
    mockUseMetas.mockReturnValue({
      data: sampleMetas,
      error: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);

    renderPage();

    // Find the delete button in the table (not the modal one)
    const deleteButtons = screen.getAllByRole('button', { name: /Eliminar/i });
    const tableDeleteButton = deleteButtons.find((button) => !button.classList.contains('cds--btn--danger'));
    expect(tableDeleteButton).toBeDefined();

    await act(async () => {
      fireEvent.click(tableDeleteButton!);
    });

    expect(screen.getByRole('heading', { name: /Eliminar meta/i })).toBeInTheDocument();

    const confirmDeleteButton = screen
      .getAllByRole('button', { name: /Eliminar/i })
      .find((button) => button.classList.contains('cds--btn--danger'));
    expect(confirmDeleteButton).toBeDefined();
    await act(async () => {
      fireEvent.click(confirmDeleteButton!);
    });

    expect(deleteMetaMock).toHaveBeenCalledTimes(1);
    expect(deleteMetaMock).toHaveBeenCalledWith('ver-001-1', 2026);
  });

  it('shows an error notification when deleteMeta fails', async () => {
    mockUseDeleteMeta.mockReturnValue({ deleteMeta: vi.fn().mockRejectedValue(new Error('Network error')) });
    mockUseMetas.mockReturnValue({
      data: sampleMetas,
      error: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);

    renderPage();

    // Find the delete button in the table (not the modal one)
    const deleteButtons = screen.getAllByRole('button', { name: /Eliminar/i });
    const tableDeleteButton = deleteButtons.find((button) => !button.classList.contains('cds--btn--danger'));

    await act(async () => {
      fireEvent.click(tableDeleteButton!);
    });

    const confirmDeleteButton = screen
      .getAllByRole('button', { name: /Eliminar/i })
      .find((button) => button.classList.contains('cds--btn--danger'));
    expect(confirmDeleteButton).toBeDefined();
    await act(async () => {
      fireEvent.click(confirmDeleteButton!);
    });

    expect(notifyError).toHaveBeenCalledWith('Network error');
  });
});
