import { render, screen } from '@testing-library/react';

import { useFuaRequests } from '../hooks/useFuaRequests';
import { useVisits } from '../hooks/useVisit';

import AllFuaRequestsTile from './all-fua-requests-tile.component';
import CompletedFuaRequestsTile from './completed-fua-requests-tile.component';
import EnviadoFuaRequestsTile from './enviado-fua-requests-tile.component';
import InProgressFuaRequestsTile from './in-progress-fua-requests-tile.component';

vi.mock('../hooks/useFuaRequests');
vi.mock('../hooks/useVisit');

const mockUseFuaRequests = useFuaRequests as vi.MockedFunction<typeof useFuaRequests>;
const mockUseVisits = useVisits as vi.MockedFunction<typeof useVisits>;

const makeMockOrders = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    uuid: `fua-${i}`,
    id: i,
    visitUuid: `visit-${i}`,
    name: `FUA ${i}`,
    payload: '{}',
    fuaEstado: { uuid: `e-${i}`, id: 1, nombre: 'Pendiente' },
    fechaCreacion: Date.now(),
    fechaActualizacion: Date.now(),
  }));

describe('AllFuaRequestsTile', () => {
  it('renders total count', () => {
    mockUseFuaRequests.mockReturnValue({
      fuaOrders: makeMockOrders(7),
      isLoading: false,
      isError: null,
      mutate: vi.fn(),
      isValidating: false,
    });
    render(<AllFuaRequestsTile />);
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('FUAs Solicitados')).toBeInTheDocument();
  });
});

describe('InProgressFuaRequestsTile', () => {
  it('renders in-progress count', () => {
    mockUseVisits.mockReturnValue({
      visits: Array.from({ length: 3 }, (_, i) => ({
        patient: { person: { names: [{ display: `Paciente ${i}` }] } },
        location: { display: 'Area' },
        startDatetime: '2026-04-28T14:10:41.000+0000',
      })),
      isLoading: false,
      isError: null,
      mutate: vi.fn(),
      isValidating: false,
    });
    render(<InProgressFuaRequestsTile />);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getAllByText('Visitas')).toHaveLength(2);
  });

  it('uses the visits hook', () => {
    mockUseVisits.mockReturnValue({
      visits: [],
      isLoading: false,
      isError: null,
      mutate: vi.fn(),
      isValidating: false,
    });
    render(<InProgressFuaRequestsTile />);
    expect(mockUseVisits).toHaveBeenCalled();
  });
});

describe('CompletedFuaRequestsTile', () => {
  it('renders completed count', () => {
    mockUseFuaRequests.mockReturnValue({
      fuaOrders: makeMockOrders(12),
      isLoading: false,
      isError: null,
      mutate: vi.fn(),
      isValidating: false,
    });
    render(<CompletedFuaRequestsTile />);
    expect(screen.getByText('12')).toBeInTheDocument();
  });
});

describe('EnviadoFuaRequestsTile', () => {
  it('renders enviado count', () => {
    mockUseFuaRequests.mockReturnValue({
      fuaOrders: makeMockOrders(5),
      isLoading: false,
      isError: null,
      mutate: vi.fn(),
      isValidating: false,
    });
    render(<EnviadoFuaRequestsTile />);
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('Enviados a SETI-SIS')).toBeInTheDocument();
  });

  it('passes status ENVIADO to hook', () => {
    mockUseFuaRequests.mockReturnValue({
      fuaOrders: [],
      isLoading: false,
      isError: null,
      mutate: vi.fn(),
      isValidating: false,
    });
    render(<EnviadoFuaRequestsTile />);
    expect(mockUseFuaRequests).toHaveBeenCalledWith(expect.objectContaining({ status: 'ENVIADO' }));
  });
});
