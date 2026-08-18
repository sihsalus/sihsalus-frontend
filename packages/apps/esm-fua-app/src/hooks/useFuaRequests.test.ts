import { openmrsFetch, useAppContext } from '@openmrs/esm-framework';
import { renderHook } from '@testing-library/react';
import useSWR from 'swr';

import { cancelFuaRequest, setFuaEstado, useFuaEstados, useFuaRequests, useFuasByPatient } from './useFuaRequests';

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
    fechaCreacion: new Date(2024, 0, 15).getTime(),
    fechaActualizacion: new Date(2024, 0, 15).getTime(),
  },
  {
    uuid: 'fua-2',
    id: 2,
    visitUuid: 'visit-2',
    name: 'FUA Test 2',
    payload: '{}',
    fuaEstado: null,
    fechaCreacion: new Date(2024, 0, 16).getTime(),
    fechaActualizacion: new Date(2024, 0, 16).getTime(),
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAppContext.mockReturnValue({ dateRange: mockDateRange, dateFilterMode: 'none' });
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

  it('builds /solicitudes URL with status', () => {
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
    expect(calledUrl).not.toContain('fechaInicio=');
    expect(calledUrl).not.toContain('fechaFin=');
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

  it('filters by creation date range locally', () => {
    mockUseAppContext.mockReturnValue({ dateRange: mockDateRange, dateFilterMode: 'created' });
    mockUseSWR.mockReturnValue({
      data: {
        data: [
          { ...mockFuaOrders[0], fechaCreacion: new Date(2024, 0, 15).getTime() },
          { ...mockFuaOrders[1], fechaCreacion: new Date(2024, 1, 15).getTime() },
        ],
      },
      error: null,
      isLoading: false,
      mutate: vi.fn(),
      isValidating: false,
    } as any);

    const { result } = renderHook(() => useFuaRequests());

    expect(result.current.fuaOrders).toHaveLength(1);
    expect(result.current.fuaOrders[0].uuid).toBe('fua-1');
  });

  it('filters by update date range when selected', () => {
    mockUseAppContext.mockReturnValue({ dateRange: mockDateRange, dateFilterMode: 'updated' });
    mockUseSWR.mockReturnValue({
      data: {
        data: [
          {
            ...mockFuaOrders[0],
            fechaCreacion: new Date(2023, 11, 15).getTime(),
            fechaActualizacion: new Date(2024, 0, 15).getTime(),
          },
          {
            ...mockFuaOrders[1],
            fechaCreacion: new Date(2024, 0, 15).getTime(),
            fechaActualizacion: new Date(2024, 1, 15).getTime(),
          },
        ],
      },
      error: null,
      isLoading: false,
      mutate: vi.fn(),
      isValidating: false,
    } as any);

    const { result } = renderHook(() => useFuaRequests());

    expect(result.current.fuaOrders).toHaveLength(1);
    expect(result.current.fuaOrders[0].uuid).toBe('fua-1');
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

describe('useFuaEstados', () => {
  it('calls /estado/list/', () => {
    mockUseSWR.mockReturnValue({
      data: { data: [{ uuid: 'estado-1', id: 1, nombre: 'Pendiente' }] },
      error: null,
      isLoading: false,
      mutate: vi.fn(),
      isValidating: false,
    } as any);

    const { result } = renderHook(() => useFuaEstados());

    expect(mockUseSWR).toHaveBeenCalledWith('/ws/module/fua/estado/list/', openmrsFetch);
    expect(result.current.estados).toHaveLength(1);
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
