import { getDefaultsFromConfigSchema, navigate, useConfig, useSession } from '@openmrs/esm-framework';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { type ActiveVisitsConfigSchema, configSchema } from '../config-schema';
import PendingSisAccreditationsTable from './pending-sis-accreditations.component';
import { type PendingSisVisit, usePendingSisAccreditations } from './pending-sis-accreditations.resource';

void React;

vi.mock('./pending-sis-accreditations.resource', async () => ({
  ...(await vi.importActual('./pending-sis-accreditations.resource')),
  usePendingSisAccreditations: vi.fn(),
}));

const mockUsePendingSisAccreditations = vi.mocked(usePendingSisAccreditations);
const mockUseConfig = vi.mocked(useConfig<ActiveVisitsConfigSchema>);
const mockUseSession = vi.mocked(useSession);
const mockNavigate = vi.mocked(navigate);

const admisionSession = {
  authenticated: true,
  sessionId: 'session-id',
  user: { privileges: [{ display: 'app:home.admision' }] },
} as unknown as ReturnType<typeof useSession>;

const pendingVisits: Array<PendingSisVisit> = [
  {
    visitUuid: 'visit-1',
    patientUuid: 'patient-1',
    patientName: 'Maria Quispe',
    identifier: '79000001',
    startDatetime: '2026-07-17T08:00:00.000-0500',
    location: 'Admisión',
    accreditationStatus: 'pending',
  },
  {
    visitUuid: 'visit-2',
    patientUuid: 'patient-2',
    patientName: 'Juan Perez',
    identifier: '79000002',
    startDatetime: '2026-07-17T09:15:00.000-0500',
    location: 'Emergencia',
    accreditationStatus: 'missing',
  },
];

describe('PendingSisAccreditationsTable', () => {
  beforeEach(() => {
    mockUseConfig.mockReturnValue(getDefaultsFromConfigSchema(configSchema) as ActiveVisitsConfigSchema);
    mockUseSession.mockReturnValue(admisionSession);
    mockUsePendingSisAccreditations.mockReturnValue({
      pendingVisits,
      error: undefined,
      isLoading: false,
      isValidating: false,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the pending visits with patient link, DNI, accreditation tag, and location', () => {
    render(<PendingSisAccreditationsTable />);

    expect(screen.getByText('Acreditaciones SIS pendientes')).toBeInTheDocument();

    const patientLink = screen.getByRole('link', { name: 'Maria Quispe' });
    expect(patientLink).toHaveAttribute('href', expect.stringContaining('/patient/patient-1/chart'));

    expect(screen.getByText('79000001')).toBeInTheDocument();
    expect(screen.getByText('79000002')).toBeInTheDocument();
    expect(screen.getByText('Pendiente')).toBeInTheDocument();
    expect(screen.getByText('Sin registrar')).toBeInTheDocument();
    expect(screen.getByText('Emergencia')).toBeInTheDocument();
  });

  it('opens patient editing from the accreditation action and returns to home after saving', () => {
    render(<PendingSisAccreditationsTable />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Acreditar' })[0]);

    expect(mockNavigate).toHaveBeenCalledWith({
      to: expect.stringMatching(/\/patient\/patient-1\/edit\?focusSection=insurance&afterUrl=.*%2Fhome$/),
    });
  });

  it('renders nothing (and does not fetch) without the admisión privilege', () => {
    mockUseSession.mockReturnValue({
      authenticated: true,
      sessionId: 'session-id',
      user: { privileges: [{ display: 'app:home.tabla.consultas.activas' }] },
    } as unknown as ReturnType<typeof useSession>);

    const { container } = render(<PendingSisAccreditationsTable />);

    expect(container).toBeEmptyDOMElement();
    expect(mockUsePendingSisAccreditations).toHaveBeenCalledWith(expect.anything(), false);
  });

  it('shows a clear empty state when no visit needs SIS verification', () => {
    mockUsePendingSisAccreditations.mockReturnValue({
      pendingVisits: [],
      error: undefined,
      isLoading: false,
      isValidating: false,
    });

    render(<PendingSisAccreditationsTable />);

    expect(screen.getByText('No hay acreditaciones pendientes')).toBeInTheDocument();
  });

  it('shows the error state when the visits request fails', () => {
    mockUsePendingSisAccreditations.mockReturnValue({
      pendingVisits: [],
      error: new Error('network down'),
      isLoading: false,
      isValidating: false,
    });

    render(<PendingSisAccreditationsTable />);

    expect(screen.getByText(/Error State/i)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
