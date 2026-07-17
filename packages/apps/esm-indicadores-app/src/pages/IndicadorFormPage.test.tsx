import {
  notifyError,
  notifySuccess,
  useCreateIndicador,
  useIndicador,
  useResolvedOrdenes,
  useUpdateIndicador,
} from '../features/indicadores/hooks';
import { act, fireEvent, screen } from '@testing-library/react';
import { MemoryRouter, useNavigate, useParams } from 'react-router-dom';
import { renderWithSwr } from 'test-utils';
import IndicadorFormPage from './IndicadorFormPage';

vi.mock('../features/indicadores/hooks', () => ({
  getIndicatorsErrorMessage: vi.fn((_error, fallback) => fallback),
  useIndicador: vi.fn(),
  useCreateIndicador: vi.fn(),
  useUpdateIndicador: vi.fn(),
  useResolvedOrdenes: vi.fn(),
  useLocationSearch: vi.fn(() => ({ data: [], error: undefined, isLoading: false })),
  useDiagnosticoSearch: vi.fn(() => ({ data: [], error: undefined, isLoading: false })),
  useOrdenSearch: vi.fn(() => ({ data: [], error: undefined, isLoading: false })),
  notifyError: vi.fn(),
  notifySuccess: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useParams: vi.fn(),
    useNavigate: vi.fn(),
  };
});

const mockNavigate = vi.fn();
const mockCreateIndicador = vi.fn();
const mockUpdateIndicador = vi.fn();

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
  ],
};

function renderCreatePage() {
  return renderWithSwr(
    <MemoryRouter initialEntries={['/new']}>
      <IndicadorFormPage mode="create" />
    </MemoryRouter>,
  );
}

function renderEditPage() {
  return renderWithSwr(
    <MemoryRouter initialEntries={['/ind-001/edit']}>
      <IndicadorFormPage mode="edit" />
    </MemoryRouter>,
  );
}

describe('IndicadorFormPage — create mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useNavigate).mockReturnValue(mockNavigate);
    vi.mocked(useParams).mockReturnValue({});
    vi.mocked(useIndicador).mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);
    vi.mocked(useCreateIndicador).mockReturnValue({ createIndicador: mockCreateIndicador });
    vi.mocked(useUpdateIndicador).mockReturnValue({ updateIndicador: mockUpdateIndicador });
    vi.mocked(useResolvedOrdenes).mockReturnValue({
      data: undefined,
      displayMap: new Map(),
      error: undefined,
      isLoading: false,
    });
  });

  it('renders "Nuevo indicador" heading', () => {
    renderCreatePage();

    expect(screen.getByRole('heading', { name: 'Nuevo indicador' })).toBeInTheDocument();
  });

  it('shows helper text about defining metadata', () => {
    renderCreatePage();

    expect(screen.getByText(/Definí la metadata y la lógica base del indicador/)).toBeInTheDocument();
  });

  it('calls createIndicador on form submit with correct payload', async () => {
    mockCreateIndicador.mockResolvedValue({ id: 'new-id-001', nombre: 'Nuevo Indicador' });

    renderCreatePage();

    const nombreInput = screen.getByLabelText('Nombre');
    await act(async () => {
      fireEvent.change(nombreInput, { target: { value: 'Nuevo Indicador' } });
    });

    const submitButton = screen.getByRole('button', { name: 'Guardar' });
    await act(async () => {
      fireEvent.click(submitButton);
    });

    expect(mockCreateIndicador).toHaveBeenCalledTimes(1);
    expect(mockCreateIndicador).toHaveBeenCalledWith(
      expect.objectContaining({
        nombre: 'Nuevo Indicador',
        descripcion: null,
        definicion: expect.objectContaining({
          tipo: 'conteo_atenciones',
        }),
      }),
    );
  });

  it('shows success notification and navigates after create', async () => {
    mockCreateIndicador.mockResolvedValue({ id: 'new-id-002', nombre: 'Test' });

    renderCreatePage();

    const nombreInput = screen.getByLabelText('Nombre');
    await act(async () => {
      fireEvent.change(nombreInput, { target: { value: 'Test Indicator' } });
    });

    const submitButton = screen.getByRole('button', { name: 'Guardar' });
    await act(async () => {
      fireEvent.click(submitButton);
    });

    expect(notifySuccess).toHaveBeenCalledWith('Indicador creado');
    expect(mockNavigate).toHaveBeenCalledWith('/new-id-002');
  });

  it('shows error notification when createIndicador fails', async () => {
    mockCreateIndicador.mockRejectedValue(new Error('Error del servidor'));

    renderCreatePage();

    const nombreInput = screen.getByLabelText('Nombre');
    await act(async () => {
      fireEvent.change(nombreInput, { target: { value: 'Failing Indicator' } });
    });

    const submitButton = screen.getByRole('button', { name: 'Guardar' });
    await act(async () => {
      fireEvent.click(submitButton);
    });

    expect(notifyError).toHaveBeenCalledWith('No se pudo guardar el indicador.');
    expect(screen.getByText('No se pudo guardar el indicador.')).toBeInTheDocument();
    expect(notifySuccess).not.toHaveBeenCalled();
  });
});

describe('IndicadorFormPage — edit mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useNavigate).mockReturnValue(mockNavigate);
    vi.mocked(useParams).mockReturnValue({ id: 'ind-001' });
    vi.mocked(useCreateIndicador).mockReturnValue({ createIndicador: mockCreateIndicador });
    vi.mocked(useUpdateIndicador).mockReturnValue({ updateIndicador: mockUpdateIndicador });
    vi.mocked(useResolvedOrdenes).mockReturnValue({
      data: {},
      displayMap: new Map(),
      error: undefined,
      isLoading: false,
    });
  });

  it('shows loading state while fetching', () => {
    vi.mocked(useIndicador).mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    } as never);

    renderEditPage();

    expect(screen.getByText('Cargando indicador...')).toBeInTheDocument();
  });

  it('shows error banner when useIndicador fails', () => {
    vi.mocked(useIndicador).mockReturnValue({
      data: undefined,
      error: new Error('Fallo al obtener el indicador'),
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    } as never);

    renderEditPage();

    expect(screen.getByText('No se pudo cargar el indicador.')).toBeInTheDocument();
    expect(screen.queryByText('Fallo al obtener el indicador')).not.toBeInTheDocument();
  });

  it('shows "No se encontró el indicador." when data is null', () => {
    vi.mocked(useIndicador).mockReturnValue({
      data: null,
      error: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);

    renderEditPage();

    expect(screen.getByText('No se encontró el indicador.')).toBeInTheDocument();
  });

  describe('when indicator is loaded', () => {
    beforeEach(() => {
      vi.mocked(useIndicador).mockReturnValue({
        data: sampleIndicator,
        error: undefined,
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      } as never);
    });

    it('renders "Editar indicador" heading', () => {
      renderEditPage();

      expect(screen.getByRole('heading', { name: 'Editar indicador' })).toBeInTheDocument();
    });

    it('pre-fills form with indicator data', () => {
      renderEditPage();

      const nombreInput = screen.getByLabelText('Nombre');
      expect(nombreInput).toHaveValue('Atenciones de control prenatal');

      const descripcionInput = screen.getByLabelText('Descripción');
      expect(descripcionInput).toHaveValue('Gestantes atendidas con control prenatal.');
    });

    it('calls updateIndicador on form submit with correct payload', async () => {
      mockUpdateIndicador.mockResolvedValue(sampleIndicator);

      renderEditPage();

      const submitButton = screen.getByRole('button', { name: 'Guardar' });
      await act(async () => {
        fireEvent.click(submitButton);
      });

      expect(mockUpdateIndicador).toHaveBeenCalledTimes(1);
      expect(mockUpdateIndicador).toHaveBeenCalledWith('ind-001', {
        nombre: 'Atenciones de control prenatal',
        descripcion: 'Gestantes atendidas con control prenatal.',
      });
    });

    it('shows success notification and navigates after update', async () => {
      mockUpdateIndicador.mockResolvedValue(sampleIndicator);

      renderEditPage();

      const submitButton = screen.getByRole('button', { name: 'Guardar' });
      await act(async () => {
        fireEvent.click(submitButton);
      });

      expect(notifySuccess).toHaveBeenCalledWith('Indicador actualizado');
      expect(mockNavigate).toHaveBeenCalledWith('/ind-001');
    });

    it('shows error notification when updateIndicador fails', async () => {
      mockUpdateIndicador.mockRejectedValue(new Error('Error al actualizar'));

      renderEditPage();

      const submitButton = screen.getByRole('button', { name: 'Guardar' });
      await act(async () => {
        fireEvent.click(submitButton);
      });

      expect(notifyError).toHaveBeenCalledWith('No se pudo guardar el indicador.');
      expect(screen.getByText('No se pudo guardar el indicador.')).toBeInTheDocument();
      expect(notifySuccess).not.toHaveBeenCalled();
    });

    it('blocks duplicate update submissions while the first request is pending', async () => {
      let resolveUpdate: (value: unknown) => void = () => {};
      mockUpdateIndicador.mockReturnValue(
        new Promise((resolve) => {
          resolveUpdate = resolve;
        }),
      );
      renderEditPage();

      const submitButton = screen.getByRole('button', { name: 'Guardar' });
      fireEvent.click(submitButton);
      fireEvent.click(submitButton);

      expect(mockUpdateIndicador).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('button', { name: 'Guardando...' })).toBeDisabled();

      await act(async () => resolveUpdate(sampleIndicator));
    });
  });
});
