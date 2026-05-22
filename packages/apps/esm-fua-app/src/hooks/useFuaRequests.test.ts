import { openmrsFetch, useAppContext } from '@openmrs/esm-framework';
import { renderHook } from '@testing-library/react';
import useSWR from 'swr';

import { cancelFuaRequest, setFuaEstado, useFuaRequests, useFuasByPatient } from './useFuaRequests';

vi.mock('swr');
vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  openmrsFetch: vi.fn(),
  useAppContext: vi.fn(),
}));

const mockUseSWR = useSWR as vi.MockedFunction<typeof useSWR>;
const mockUseAppContext = useAppContext as vi.MockedFunction<typeof useAppContext>;
const mockOpenmrsFetch = openmrsFetch as vi.MockedFunction<typeof openmrsFetch>;

// Use local-date constructor to avoid UTC-midnight timezone shifts
const mockDateRange: [Date, Date] = [new Date(2024, 0, 1), new Date(2024, 0, 31)];

const mockFuaOrders = [
  {
    uuid: 'fua-1',
    id: 1,
    visitUuid: 'visit-1',
    name: 'FUA Test',
    payload: '{}',
    fuaEstado: { uuid: 'estado-1', id: 1, nombre: 'Pendiente' },
    fechaCreacion: Date.now(),
    fechaActualizacion: Date.now(),
  },
  {
    uuid: 'fua-2',
    id: 2,
    visitUuid: 'visit-2',
    name: 'FUA Test 2',
    payload: '{}',
    fuaEstado: null,
    fechaCreacion: Date.now(),
    fechaActualizacion: Date.now(),
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAppContext.mockReturnValue({ dateRange: mockDateRange });
});

describe('useFuaRequests', () => {
  it('calls /list when no status provided', () => {
    mockUseSWR.mockReturnValue({
      data: { data: mockFuaOrders },
      error: null,
      isLoading: false,
      mutate: vi.fn(),
      isValidating: false,
    } as any);

    const { result } = renderHook(() => useFuaRequests());

    expect(mockUseSWR).toHaveBeenCalledWith('/ws/module/fua/list', openmrsFetch);
    expect(result.current.fuaOrders).toHaveLength(2);
  });

  it('builds /solicitudes URL with status and date range', () => {
    mockUseSWR.mockReturnValue({
      data: { data: mockFuaOrders },
      error: null,
      isLoading: false,
      mutate: vi.fn(),
      isValidating: false,
    } as any);

    renderHook(() => useFuaRequests({ status: 'IN_PROGRESS' }));

    const calledUrl = (mockUseSWR as vi.Mock).mock.calls[0][0] as string;
    expect(calledUrl).toContain('/ws/module/fua/solicitudes');
    expect(calledUrl).toContain('status=En%20Proceso');
    expect(calledUrl).toContain('fechaInicio=2024-01-01');
    expect(calledUrl).toContain('fechaFin=2024-01-31');
  });

  it('maps COMPLETED status to Completado', () => {
    mockUseSWR.mockReturnValue({
      data: { data: [] },
      error: null,
      isLoading: false,
      mutate: vi.fn(),
      isValidating: false,
    } as any);

    renderHook(() => useFuaRequests({ status: 'COMPLETED' }));

    const calledUrl = (mockUseSWR as vi.Mock).mock.calls[0][0] as string;
    expect(calledUrl).toContain('status=Completado');
  });

  it('maps DECLINED status to Rechazado', () => {
    mockUseSWR.mockReturnValue({
      data: { data: [] },
      error: null,
      isLoading: false,
      mutate: vi.fn(),
      isValidating: false,
    } as any);

    renderHook(() => useFuaRequests({ status: 'DECLINED' }));

    const calledUrl = (mockUseSWR as vi.Mock).mock.calls[0][0] as string;
    expect(calledUrl).toContain('status=Rechazado');
  });

  it('filters newOrdersOnly (fuaEstado is null)', () => {
    mockUseSWR.mockReturnValue({
      data: { data: mockFuaOrders },
      error: null,
      isLoading: false,
      mutate: vi.fn(),
      isValidating: false,
    } as any);

    const { result } = renderHook(() => useFuaRequests({ newOrdersOnly: true }));

    expect(result.current.fuaOrders).toHaveLength(1);
    expect(result.current.fuaOrders[0].uuid).toBe('fua-2');
  });

  it('returns isLoading true while fetching', () => {
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: null,
      isLoading: true,
      mutate: vi.fn(),
      isValidating: false,
    } as any);

    const { result } = renderHook(() => useFuaRequests());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.fuaOrders).toEqual([]);
  });

  it('returns error when fetch fails', () => {
    const mockError = new Error('Network error');
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: mockError,
      isLoading: false,
      mutate: vi.fn(),
      isValidating: false,
    } as any);

    const { result } = renderHook(() => useFuaRequests());

    expect(result.current.isError).toBe(mockError);
  });
});

describe('setFuaEstado', () => {
  it('calls PUT /module/fua/estado/update/{fuaId} with estadoId', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({ data: {} } as any);
    const abortController = new AbortController();

    await setFuaEstado(42, 3, abortController);

    expect(mockOpenmrsFetch).toHaveBeenCalledWith(
      '/ws/module/fua/estado/update/42',
      expect.objectContaining({ method: 'PUT', body: { estadoId: 3 } }),
    );
  });
});

describe('cancelFuaRequest', () => {
  it('calls PUT with estadoId=6 (CANCELADO) and comment', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({ data: {} } as any);
    const abortController = new AbortController();

    await cancelFuaRequest(7, 'Duplicado', abortController);

    expect(mockOpenmrsFetch).toHaveBeenCalledWith(
      '/ws/module/fua/estado/update/7',
      expect.objectContaining({
        method: 'PUT',
        body: { estadoId: 6, comentario: 'Duplicado' },
      }),
    );
  });
});

describe('useFuasByPatient', () => {
  it('calls /module/fua/patient/{patientUuid}', () => {
    mockUseSWR.mockReturnValue({
      data: { data: mockFuaOrders },
      error: null,
      isLoading: false,
      mutate: vi.fn(),
      isValidating: false,
    } as any);

    renderHook(() => useFuasByPatient('patient-uuid-123'));

    expect(mockUseSWR).toHaveBeenCalledWith('/ws/module/fua/patient/patient-uuid-123', openmrsFetch);
  });

  it('passes null URL when patientUuid is null (skip fetch)', () => {
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: null,
      isLoading: false,
      mutate: vi.fn(),
      isValidating: false,
    } as any);

    renderHook(() => useFuasByPatient(null));

    expect(mockUseSWR).toHaveBeenCalledWith(null, openmrsFetch);
  });
});
