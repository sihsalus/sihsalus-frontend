import { render, screen } from '@testing-library/react';
import { userHasAccess } from '@openmrs/esm-framework';
import type { ReactNode } from 'react';
import { deriveStatus, useInterconsultas } from '../interconsultas.resource';
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
} as never;

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

  it('uses the shared empty-state card when a tray has no interconsultations', () => {
    mockUseInterconsultas.mockReturnValue({
      interconsultas: [],
      isLoading: false,
      error: undefined,
      isValidating: false,
      mutate: vi.fn(async () => undefined),
    });

    render(<InterconsultasTable filter="REQUESTED" />);

    expect(mockUseInterconsultas).toHaveBeenCalledWith('REQUESTED');
    expect(screen.getByRole('heading', { level: 3, name: 'No hay interconsultas para mostrar' })).toBeInTheDocument();
    expect(screen.getByText('Comprobar los filtros anteriores')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Paciente' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
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
