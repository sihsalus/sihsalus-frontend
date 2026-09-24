import { fireEvent, render, screen } from '@testing-library/react';
import { userHasAccess } from '@openmrs/esm-framework';
import type { ReactNode } from 'react';
import { deriveStatus, useInterconsultas } from '../interconsultas.resource';
import type { InterconsultaOrder } from '../types';
import InterconsultasTable from './interconsultas-table.component';

const mockUseInterconsultas = vi.mocked(useInterconsultas);
const mockDeriveStatus = vi.mocked(deriveStatus);

const interconsulta = {
  uuid: 'order-1',
  orderNumber: 'IC-001',
  dateActivated: '2026-08-10T10:00:00.000Z',
  patient: { uuid: 'patient-1', display: 'Paciente Uno' },
  concept: { uuid: 'service-1', display: 'Cardiología' },
  orderer: { uuid: 'provider-1', display: 'Dra. Torres' },
  encounter: { location: { uuid: 'location-1', display: 'Consulta externa' } },
  urgency: 'ROUTINE',
} as InterconsultaOrder;

vi.mock('../interconsultas.resource', () => ({
  deriveStatus: vi.fn(),
  useInterconsultas: vi.fn(),
}));

vi.mock('@carbon/react', async () => {
  const actual = await vi.importActual('@carbon/react');

  return {
    ...actual,
    OverflowMenu: ({ children, 'aria-label': ariaLabel }: { children: ReactNode; 'aria-label': string }) => (
      <div role="menu" aria-label={ariaLabel}>
        {children}
      </div>
    ),
    OverflowMenuItem: ({ itemText, onClick }: { itemText: string; onClick?: () => void }) => (
      <button type="button" role="menuitem" onClick={onClick}>
        {itemText}
      </button>
    ),
  };
});

describe('InterconsultasTable', () => {
  beforeEach(() => {
    vi.mocked(userHasAccess).mockReturnValue(false);
    mockDeriveStatus.mockReturnValue('REQUESTED');
  });

  it('explains an empty tray without suggesting filters that are not active', () => {
    mockUseInterconsultas.mockReturnValue({
      interconsultas: [],
      isLoading: false,
      error: undefined,
      isValidating: false,
      mutate: vi.fn(async () => undefined),
    });

    render(<InterconsultasTable filter="REQUESTED" />);

    expect(mockUseInterconsultas).toHaveBeenCalledWith('REQUESTED');
    expect(screen.getByRole('heading', { level: 3, name: 'Esta bandeja no tiene interconsultas' })).toBeInTheDocument();
    expect(screen.getByText('Las solicitudes aparecerán aquí cuando alcancen este estado.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Paciente' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('distinguishes an empty search from an empty tray and clears all filters', () => {
    mockUseInterconsultas.mockReturnValue({
      interconsultas: [interconsulta],
      isLoading: false,
      error: undefined,
      isValidating: false,
      mutate: vi.fn(async () => undefined),
    });

    render(<InterconsultasTable filter="REQUESTED" />);
    fireEvent.change(screen.getByPlaceholderText('Paciente, orden, solicitante o motivo'), {
      target: { value: 'sin coincidencias' },
    });

    expect(screen.getByRole('heading', { name: 'Ninguna interconsulta coincide con los filtros' })).toBeInTheDocument();
    expect(screen.getByText('Resultados: 0 de 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));

    expect(screen.getByRole('cell', { name: 'Paciente Uno' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).not.toBeInTheDocument();
  });

  it('finds a destination service when the search omits accents', () => {
    mockUseInterconsultas.mockReturnValue({
      interconsultas: [interconsulta],
      isLoading: false,
      error: undefined,
      isValidating: false,
      mutate: vi.fn(async () => undefined),
    });

    render(<InterconsultasTable filter="REQUESTED" />);
    fireEvent.change(screen.getByPlaceholderText('Paciente, orden, solicitante o motivo'), {
      target: { value: 'cardiologia' },
    });

    expect(screen.getByRole('cell', { name: 'Paciente Uno' })).toBeInTheDocument();
    expect(screen.getByText('Resultados: 1 de 1')).toBeInTheDocument();
  });

  it('puts urgent orders first, then older routine orders', () => {
    mockUseInterconsultas.mockReturnValue({
      interconsultas: [
        { ...interconsulta, uuid: 'routine', patient: { uuid: 'patient-1', display: 'Paciente Rutina' } },
        {
          ...interconsulta,
          uuid: 'urgent',
          urgency: 'STAT',
          patient: { uuid: 'patient-2', display: 'Paciente Urgente' },
        },
        {
          ...interconsulta,
          uuid: 'older-routine',
          dateActivated: '2026-08-09T10:00:00.000Z',
          patient: { uuid: 'patient-3', display: 'Paciente Anterior' },
        },
      ],
      isLoading: false,
      error: undefined,
      isValidating: false,
      mutate: vi.fn(async () => undefined),
    });

    render(<InterconsultasTable filter="REQUESTED" />);

    const patientCells = screen.getAllByRole('cell').filter((cell) => cell.textContent?.startsWith('Paciente'));
    expect(patientCells.map((cell) => cell.textContent)).toEqual([
      'Paciente Urgente',
      'Paciente Anterior',
      'Paciente Rutina',
    ]);
  });

  it('shows the list but no modification commands to a read-only user', () => {
    mockUseInterconsultas.mockReturnValue({
      interconsultas: [interconsulta],
      isLoading: false,
      error: undefined,
      isValidating: false,
      mutate: vi.fn(async () => undefined),
    });

    render(<InterconsultasTable filter="REQUESTED" />);

    expect(screen.getByRole('cell', { name: 'Paciente Uno' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Ver detalle' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Recibir' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Atender (recoger)' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Rechazar' })).not.toBeInTheDocument();
  });

  it('shows modification commands to a user with an edit privilege', () => {
    vi.mocked(userHasAccess).mockReturnValue(true);
    mockUseInterconsultas.mockReturnValue({
      interconsultas: [interconsulta],
      isLoading: false,
      error: undefined,
      isValidating: false,
      mutate: vi.fn(async () => undefined),
    });

    render(<InterconsultasTable filter="REQUESTED" />);

    expect(screen.getByRole('menuitem', { name: 'Recibir' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Atender (recoger)' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Rechazar' })).toBeInTheDocument();
  });
});
