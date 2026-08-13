import { getDefaultsFromConfigSchema, navigate, showSnackbar, useConfig, useSession } from '@openmrs/esm-framework';
import { safeCopyFinanciadorToVisit, type SafeCopyFinanciadorToVisitResult } from '@openmrs/esm-patient-common-lib';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

import { type ActiveVisitsConfigSchema, configSchema } from '../config-schema';
import PendingSisAccreditationsTable, {
  syncPendingSisCoveragePrivileges,
} from './pending-sis-accreditations.component';
import { type PendingSisVisit, usePendingSisAccreditations } from './pending-sis-accreditations.resource';

void React;

vi.mock('./pending-sis-accreditations.resource', async () => ({
  ...(await vi.importActual('./pending-sis-accreditations.resource')),
  usePendingSisAccreditations: vi.fn(),
}));

vi.mock('@openmrs/esm-patient-common-lib', async () => ({
  ...(await vi.importActual('@openmrs/esm-patient-common-lib')),
  safeCopyFinanciadorToVisit: vi.fn(),
}));

const mockUsePendingSisAccreditations = vi.mocked(usePendingSisAccreditations);
const mockUseConfig = vi.mocked(useConfig<ActiveVisitsConfigSchema>);
const mockUseSession = vi.mocked(useSession);
const mockNavigate = vi.mocked(navigate);
const mockShowSnackbar = vi.mocked(showSnackbar);
const mockSafeCopyFinanciadorToVisit = vi.mocked(safeCopyFinanciadorToVisit);
const mockRefreshPendingVisits = vi.fn();

const admisionSession = {
  authenticated: true,
  sessionId: 'session-id',
  user: {
    privileges: [
      { display: 'app:home.admision' },
      { display: 'app:opciones.registrarPaciente' },
      { display: 'Get People' },
      { display: 'Get Patients' },
      { display: 'Get Visits' },
      { display: 'Edit Visits' },
      { display: 'Get Visit Attribute Types' },
    ],
  },
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
    const config = getDefaultsFromConfigSchema(configSchema) as ActiveVisitsConfigSchema;
    mockUseConfig.mockReturnValue(config);
    mockUseSession.mockReturnValue(admisionSession);
    mockSafeCopyFinanciadorToVisit.mockResolvedValue({
      ok: true,
      skipped: false,
      created: 1,
      updated: 0,
    });
    mockRefreshPendingVisits.mockResolvedValue(undefined);
    mockUsePendingSisAccreditations.mockReturnValue({
      pendingVisits,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: mockRefreshPendingVisits,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders pending visits without a dead patient-chart link for an admission-only user', () => {
    render(<PendingSisAccreditationsTable />);

    expect(screen.getByText('Acreditaciones SIS pendientes')).toBeInTheDocument();
    expect(screen.getByText('Maria Quispe')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Maria Quispe' })).not.toBeInTheDocument();

    expect(screen.getByText('79000001')).toBeInTheDocument();
    expect(screen.getByText('79000002')).toBeInTheDocument();
    expect(screen.getByText('Pendiente')).toBeInTheDocument();
    expect(screen.getByText('Sin registrar')).toBeInTheDocument();
    expect(screen.getByText('Emergencia')).toBeInTheDocument();
  });

  it('labels an unknown accreditation status explicitly instead of calling it unrecorded', () => {
    mockUsePendingSisAccreditations.mockReturnValue({
      pendingVisits: [{ ...pendingVisits[1], accreditationStatus: 'unknown' }],
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: mockRefreshPendingVisits,
    });

    render(<PendingSisAccreditationsTable />);

    expect(screen.getByText('Estado no reconocido')).toBeInTheDocument();
    expect(screen.queryByText('Sin registrar')).not.toBeInTheDocument();
  });

  it('links the patient name to the chart only with clinical-chart access', () => {
    mockUseSession.mockReturnValue({
      ...admisionSession,
      user: {
        privileges: [...(admisionSession.user?.privileges ?? []), { display: 'app:hoja.clinica' }],
      },
    } as unknown as ReturnType<typeof useSession>);

    render(<PendingSisAccreditationsTable />);

    expect(screen.getByRole('link', { name: 'Maria Quispe' })).toHaveAttribute(
      'href',
      expect.stringContaining('/patient/patient-1/chart'),
    );
  });

  it('opens patient editing from the accreditation action and returns to home after saving', () => {
    render(<PendingSisAccreditationsTable />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Acreditar' })[0]);

    expect(mockNavigate).toHaveBeenCalledWith({
      to: expect.stringMatching(/\/patient\/patient-1\/edit\?focusSection=insurance&afterUrl=.*%2Fhome$/),
    });
  });

  it('synchronizes the same visit, shows loading, and refreshes the persisted worklist', async () => {
    const config = getDefaultsFromConfigSchema(configSchema) as ActiveVisitsConfigSchema;
    let resolveSync: (result: SafeCopyFinanciadorToVisitResult) => void = () => {};
    mockSafeCopyFinanciadorToVisit.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSync = resolve;
      }),
    );

    render(<PendingSisAccreditationsTable />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Sincronizar cobertura' })[0]);
    expect(screen.getByText('Sincronizando cobertura…')).toBeInTheDocument();

    await act(async () => {
      resolveSync({ ok: true, skipped: false, created: 3, updated: 0 });
    });

    await waitFor(() => expect(mockRefreshPendingVisits).toHaveBeenCalledTimes(1));
    expect(mockSafeCopyFinanciadorToVisit).toHaveBeenCalledWith({
      patientUuid: 'patient-1',
      visitUuid: 'visit-1',
      onlyFillMissing: false,
      sisConceptUuid: config.pendingSisAccreditations.sisConceptUuids[0],
      legacySisProductConceptUuids: config.pendingSisAccreditations.sisConceptUuids.slice(1),
    });
    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'success', title: 'Cobertura sincronizada' }),
    );
    expect(screen.getAllByRole('button', { name: 'Sincronizar cobertura' })[0]).toBeEnabled();
  });

  it('keeps synchronization available and reports a transient failure honestly', async () => {
    mockSafeCopyFinanciadorToVisit.mockResolvedValueOnce({ ok: false, error: new Error('network down') });

    render(<PendingSisAccreditationsTable />);
    const syncButton = screen.getAllByRole('button', { name: 'Sincronizar cobertura' })[0];
    fireEvent.click(syncButton);

    await waitFor(() =>
      expect(mockShowSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'error',
          title: 'No se pudo sincronizar la cobertura',
          subtitle: 'La consulta quedó pendiente. Puede volver a sincronizarla desde esta misma fila.',
        }),
      ),
    );
    expect(mockRefreshPendingVisits).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole('button', { name: 'Sincronizar cobertura' })[0]).toBeEnabled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('removes the dead synchronization action after a deterministic authorization failure', async () => {
    mockSafeCopyFinanciadorToVisit.mockResolvedValueOnce({ ok: false, error: { response: { status: 403 } } });

    render(<PendingSisAccreditationsTable />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Sincronizar cobertura' })[0]);

    await waitFor(() =>
      expect(mockShowSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({
          actionButtonLabel: 'Revisar cobertura',
          kind: 'warning',
          title: 'Sin permisos para sincronizar cobertura',
          subtitle: 'Su rol no puede actualizar la cobertura de la consulta. Derive el caso a un usuario autorizado.',
        }),
      ),
    );
    expect(mockRefreshPendingVisits).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Sincronizar cobertura' })).not.toBeInTheDocument();

    const warning = mockShowSnackbar.mock.calls
      .map(([options]) => options)
      .find((options) => options.title === 'Sin permisos para sincronizar cobertura');
    await act(async () => warning?.onActionButtonClick?.());
    expect(mockNavigate).toHaveBeenCalledWith({
      to: expect.stringMatching(/\/patient\/patient-1\/edit\?focusSection=insurance&afterUrl=.*%2Fhome$/),
    });
  });

  it.each([
    ['missing-financiador', 'La consulta sigue sin financiador'],
    ['incomplete-coverage', 'La cobertura de la consulta sigue incompleta'],
    ['sis-accreditation-conflict', 'La acreditación SIS requiere revisión'],
    ['unknown-accreditation-status', 'Estado de acreditación SIS no reconocido'],
  ] as const)('offers coverage review instead of looping when synchronization returns %s', async (reviewReason, title) => {
    mockSafeCopyFinanciadorToVisit.mockResolvedValueOnce({
      ok: true,
      skipped: reviewReason === 'missing-financiador',
      created: 0,
      updated: 0,
      reviewReason,
    });

    render(<PendingSisAccreditationsTable />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Sincronizar cobertura' })[0]);

    await waitFor(() =>
      expect(mockShowSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({
          actionButtonLabel: 'Revisar cobertura',
          kind: 'warning',
          title,
        }),
      ),
    );
    const warning = mockShowSnackbar.mock.calls.map(([options]) => options).find((options) => options.title === title);
    await act(async () => warning?.onActionButtonClick?.());

    expect(mockNavigate).toHaveBeenCalledWith({
      to: expect.stringMatching(/\/patient\/patient-1\/edit\?focusSection=insurance&afterUrl=.*%2Fhome$/),
    });
    expect(mockSafeCopyFinanciadorToVisit).toHaveBeenCalledTimes(1);
    expect(mockShowSnackbar).not.toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' }));
  });

  it('does not expose patient editing or a dead review action without the registration privilege', async () => {
    mockUseSession.mockReturnValue({
      authenticated: true,
      sessionId: 'session-id',
      user: {
        privileges: [
          { display: 'app:home.admision' },
          { display: 'Get People' },
          { display: 'Get Patients' },
          { display: 'Get Visits' },
          { display: 'Edit Visits' },
          { display: 'Get Visit Attribute Types' },
        ],
      },
    } as unknown as ReturnType<typeof useSession>);
    mockSafeCopyFinanciadorToVisit.mockResolvedValueOnce({
      ok: true,
      skipped: false,
      created: 0,
      updated: 0,
      reviewReason: 'incomplete-coverage',
    });

    render(<PendingSisAccreditationsTable />);
    expect(screen.queryByRole('button', { name: 'Acreditar' })).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Sincronizar cobertura' })[0]);

    await waitFor(() =>
      expect(mockShowSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'La cobertura de la consulta sigue incompleta' }),
      ),
    );
    const warning = mockShowSnackbar.mock.calls
      .map(([options]) => options)
      .find((options) => options.title === 'La cobertura de la consulta sigue incompleta');
    expect(warning).not.toHaveProperty('actionButtonLabel');
    expect(warning).not.toHaveProperty('onActionButtonClick');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('keeps the list and accreditation edit readable but hides sync without its complete backend capability set', () => {
    mockUseSession.mockReturnValue({
      authenticated: true,
      sessionId: 'session-id',
      user: {
        privileges: [{ display: 'app:home.admision' }, { display: 'app:opciones.registrarPaciente' }],
      },
    } as unknown as ReturnType<typeof useSession>);

    render(<PendingSisAccreditationsTable />);

    expect(screen.getByText('Acreditaciones SIS pendientes')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Acreditar' })).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Sincronizar cobertura' })).not.toBeInTheDocument();
    expect(mockSafeCopyFinanciadorToVisit).not.toHaveBeenCalled();
  });

  it.each(syncPendingSisCoveragePrivileges)('requires the native %s capability before showing sync', (missing) => {
    mockUseSession.mockReturnValue({
      authenticated: true,
      sessionId: 'session-id',
      user: {
        privileges: [
          { display: 'app:home.admision' },
          { display: 'app:opciones.registrarPaciente' },
          ...syncPendingSisCoveragePrivileges
            .filter((privilege) => privilege !== missing)
            .map((display) => ({ display })),
        ],
      },
    } as unknown as ReturnType<typeof useSession>);

    render(<PendingSisAccreditationsTable />);

    expect(screen.queryByRole('button', { name: 'Sincronizar cobertura' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Acreditar' })).toHaveLength(2);
    expect(mockSafeCopyFinanciadorToVisit).not.toHaveBeenCalled();
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
      mutate: mockRefreshPendingVisits,
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
      mutate: mockRefreshPendingVisits,
    });

    render(<PendingSisAccreditationsTable />);

    expect(screen.getByText(/Error State/i)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
