import {
  launchWorkspace2,
  navigate,
  showModal,
  showSnackbar,
  useLayoutType,
  useSession,
  userHasAccess,
} from '@openmrs/esm-framework';
import { fetchFreshPatientVitalStatus } from '@openmrs/esm-patient-common-lib';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockQueueEntryAlice, mockSession } from 'test-utils';

import {
  admissionPrivilege,
  serviceQueuesEditPrivilege,
  serviceQueuesPrivilege,
  vitalsEditPrivilege,
} from '../../constants';
import {
  getAppointmentTriageConfig,
  revalidateCurrentSisState,
  transitionTriagedPatient,
} from '../../triage-workflow/triage-workflow.resource';

import { QueueTableActionCell } from './queue-table-action-cell.component';

const mockShowModal = vi.mocked(showModal);
const mockFetchFreshPatientVitalStatus = vi.mocked(fetchFreshPatientVitalStatus);
const mockUseLayoutType = vi.mocked(useLayoutType);
const mockUseSession = vi.mocked(useSession);
const mockUserHasAccess = vi.mocked(userHasAccess);
const mockLaunchWorkspace2 = vi.mocked(launchWorkspace2);
const mockGetAppointmentTriageConfig = vi.mocked(getAppointmentTriageConfig);
const mockRevalidateCurrentSisState = vi.mocked(revalidateCurrentSisState);
const mockTransitionTriagedPatient = vi.mocked(transitionTriagedPatient);
const mockNavigate = vi.mocked(navigate);
const mockShowSnackbar = vi.mocked(showSnackbar);

vi.mock('../../triage-workflow/triage-workflow.resource', () => ({
  getAppointmentTriageConfig: vi.fn(),
  revalidateCurrentSisState: vi.fn(),
  transitionTriagedPatient: vi.fn(),
}));

vi.mock('@openmrs/esm-patient-common-lib', async () => ({
  ...(await vi.importActual('@openmrs/esm-patient-common-lib')),
  fetchFreshPatientVitalStatus: vi.fn(),
}));

describe('QueueTableActionCell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLayoutType.mockReturnValue('small-desktop');
    mockUseSession.mockReturnValue(mockSession.data);
    mockUserHasAccess.mockReturnValue(true);
    mockFetchFreshPatientVitalStatus.mockResolvedValue({ dead: false, deathDate: null, isDeceased: false });
    mockRevalidateCurrentSisState.mockResolvedValue('active');
  });

  it('labels the overflow menu as actions instead of Carbon default options', async () => {
    const user = userEvent.setup();

    render(<QueueTableActionCell queueEntry={mockQueueEntryAlice} />);

    const actionsButton = screen.getByRole('button', { name: 'Actions' });
    expect(actionsButton).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Options' })).not.toBeInTheDocument();

    await user.click(actionsButton);
    await user.click(screen.getByText('Edit'));

    expect(mockShowModal).toHaveBeenCalledWith(
      'edit-queue-entry-modal',
      expect.objectContaining({ queueEntry: mockQueueEntryAlice, closeModal: expect.any(Function) }),
    );
    expect(mockUserHasAccess).toHaveBeenCalledWith(serviceQueuesEditPrivilege, mockSession.data.user);
  });

  it('does not expose queue actions without the edit privilege', () => {
    mockUserHasAccess.mockReturnValue(false);

    render(<QueueTableActionCell queueEntry={mockQueueEntryAlice} />);

    expect(screen.queryByRole('button', { name: 'Actions' })).not.toBeInTheDocument();
  });

  it('does not expose patient status actions to an admission-only user', () => {
    mockUserHasAccess.mockImplementation(
      (privilege) =>
        privilege === admissionPrivilege ||
        privilege === serviceQueuesEditPrivilege ||
        privilege === 'Get Queue Entries' ||
        privilege === 'Get Queues' ||
        privilege === 'Manage Queue Entries',
    );

    render(<QueueTableActionCell queueEntry={mockQueueEntryAlice} />);

    expect(screen.queryByRole('button', { name: 'Transition' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Actions' })).not.toBeInTheDocument();
  });

  it('does not expose a generic queue action while the triage contract is loading', () => {
    const loadingEntry = {
      ...mockQueueEntryAlice,
      workflow: {
        isTriageQueue: false,
        sisState: 'notConsulted' as const,
        isSisStateResolved: false,
        triageState: 'loading' as const,
      },
    };

    render(<QueueTableActionCell queueEntry={loadingEntry} />);

    expect(screen.queryByRole('button', { name: 'Transition' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Actions' })).not.toBeInTheDocument();
  });

  it('no pide Caja mientras la cobertura del paciente aun no se pudo leer', async () => {
    // Regresion: con la cobertura sin resolver (carga inicial o fallo de red)
    // sisState cae a 'notConsulted' y la fila mostraba "Derivar a Caja",
    // mandando a Caja pacientes con SIS vigente.
    const unresolvedEntry = {
      ...mockQueueEntryAlice,
      visit: {
        ...mockQueueEntryAlice.visit,
        uuid: 'visit-uuid',
        location: { uuid: 'visit-location-uuid' },
      },
      workflow: {
        isTriageQueue: true,
        sisState: 'notConsulted' as const,
        isSisStateResolved: false,
        triageState: 'pending' as const,
      },
    };

    render(<QueueTableActionCell queueEntry={unresolvedEntry} />);

    expect(screen.queryByRole('button', { name: /Derivar a Caja|Requiere Caja/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Realizar triaje' })).toBeDisabled();
  });

  it('opens the triage workspace for a patient waiting in the triage queue', async () => {
    const user = userEvent.setup();
    const triageQueueEntry = {
      ...mockQueueEntryAlice,
      visit: {
        ...mockQueueEntryAlice.visit,
        uuid: 'visit-uuid',
        location: { uuid: 'visit-location-uuid' },
      },
      workflow: {
        isTriageQueue: true,
        sisState: 'active' as const,
        isSisStateResolved: true,
        triageState: 'pending' as const,
      },
    };
    mockGetAppointmentTriageConfig.mockResolvedValue({
      appointmentArrivalRules: [],
      appointmentVisitAttributeTypeUuid: 'appointment-attribute-type-uuid',
      triageRouting: {
        enabled: true,
        encounterTypeUuid: 'triage-encounter-type-uuid',
        queueLocationUuid: 'triage-location-uuid',
        queueUuid: 'triage-queue-uuid',
      },
    });

    render(<QueueTableActionCell queueEntry={triageQueueEntry} />);
    await user.click(screen.getByRole('button', { name: 'Realizar triaje' }));

    expect(mockLaunchWorkspace2).toHaveBeenCalledWith(
      'service-queues-patient-vitals-workspace',
      expect.objectContaining({
        encounterTypeUuid: 'triage-encounter-type-uuid',
        locationUuid: 'triage-location-uuid',
        onVitalsSaved: expect.any(Function),
      }),
      null,
      { patientUuid: mockQueueEntryAlice.patient.uuid },
    );
  });

  it('allows a nurse to perform triage without exposing administrative queue actions', async () => {
    const user = userEvent.setup();
    const triageQueueEntry = {
      ...mockQueueEntryAlice,
      visit: { ...mockQueueEntryAlice.visit, uuid: 'visit-uuid' },
      workflow: {
        isTriageQueue: true,
        sisState: 'active' as const,
        isSisStateResolved: true,
        triageState: 'pending' as const,
      },
    };
    mockUserHasAccess.mockImplementation(
      (privilege) => privilege === serviceQueuesPrivilege || privilege === vitalsEditPrivilege,
    );
    mockGetAppointmentTriageConfig.mockResolvedValue({
      appointmentArrivalRules: [],
      appointmentVisitAttributeTypeUuid: 'appointment-attribute-type-uuid',
      triageRouting: {
        enabled: true,
        encounterTypeUuid: 'triage-encounter-type-uuid',
        queueLocationUuid: 'triage-location-uuid',
        queueUuid: 'triage-queue-uuid',
      },
    });

    render(<QueueTableActionCell queueEntry={triageQueueEntry} />);

    expect(mockUserHasAccess).toHaveBeenCalledWith(vitalsEditPrivilege, mockSession.data.user);
    expect(mockUserHasAccess).toHaveBeenCalledWith(serviceQueuesPrivilege, mockSession.data.user);
    expect(mockUserHasAccess).not.toHaveBeenCalledWith('Manage Queue Entries', mockSession.data.user);
    expect(screen.queryByRole('button', { name: 'Actions' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Realizar triaje' }));
    expect(mockLaunchWorkspace2).toHaveBeenCalled();
  });

  it('does not offer triage for a deceased patient returned by the queue API', () => {
    const triageQueueEntry = {
      ...mockQueueEntryAlice,
      patient: {
        ...mockQueueEntryAlice.patient,
        person: { uuid: 'person-uuid', dead: true, deathDate: '2026-08-12T15:41:28.000Z' },
      },
      visit: { ...mockQueueEntryAlice.visit, uuid: 'visit-uuid' },
      workflow: {
        isTriageQueue: true,
        sisState: 'active' as const,
        isSisStateResolved: true,
        triageState: 'pending' as const,
      },
    };
    mockUserHasAccess.mockImplementation((privilege) => privilege !== serviceQueuesEditPrivilege);

    render(<QueueTableActionCell queueEntry={triageQueueEntry} />);

    expect(screen.queryByRole('button', { name: 'Realizar triaje' })).not.toBeInTheDocument();
  });

  it('keeps only administrative cleanup actions for a deceased patient', async () => {
    const user = userEvent.setup();
    const deceasedQueueEntry = {
      ...mockQueueEntryAlice,
      patient: {
        ...mockQueueEntryAlice.patient,
        person: { uuid: 'person-uuid', dead: true, deathDate: '2026-08-12T15:41:28.000Z' },
      },
    };

    render(<QueueTableActionCell queueEntry={deceasedQueueEntry} />);

    expect(screen.queryByRole('button', { name: 'Transition' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Actions' }));
    expect(screen.queryByText('Edit')).not.toBeInTheDocument();
    expect(screen.queryByText('Undo transition')).not.toBeInTheDocument();
    expect(screen.getByText('Remove patient')).toBeInTheDocument();
  });

  it('fresh-checks vital status before opening triage and blocks a concurrent death', async () => {
    const user = userEvent.setup();
    const triageQueueEntry = {
      ...mockQueueEntryAlice,
      visit: { ...mockQueueEntryAlice.visit, uuid: 'visit-uuid' },
      workflow: {
        isTriageQueue: true,
        sisState: 'active' as const,
        isSisStateResolved: true,
        triageState: 'pending' as const,
      },
    };
    mockFetchFreshPatientVitalStatus.mockResolvedValueOnce({
      dead: true,
      deathDate: '2026-08-12T15:41:28.000Z',
      isDeceased: true,
    });

    render(<QueueTableActionCell queueEntry={triageQueueEntry} />);
    await user.click(screen.getByRole('button', { name: 'Realizar triaje' }));

    expect(mockFetchFreshPatientVitalStatus).toHaveBeenCalledWith(mockQueueEntryAlice.patient.uuid);
    expect(mockLaunchWorkspace2).not.toHaveBeenCalled();
    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'error',
        title: 'Triaje no disponible',
      }),
    );
  });

  it('fresh-checks again after vitals and does not route a patient who died while triage was open', async () => {
    const user = userEvent.setup();
    const triageQueueEntry = {
      ...mockQueueEntryAlice,
      visit: { ...mockQueueEntryAlice.visit, uuid: 'visit-uuid' },
      workflow: {
        isTriageQueue: true,
        sisState: 'active' as const,
        isSisStateResolved: true,
        triageState: 'pending' as const,
      },
    };
    mockGetAppointmentTriageConfig.mockResolvedValue({
      appointmentArrivalRules: [],
      appointmentVisitAttributeTypeUuid: 'appointment-attribute-type-uuid',
      triageRouting: {
        enabled: true,
        encounterTypeUuid: 'triage-encounter-type-uuid',
        queueLocationUuid: 'triage-location-uuid',
        queueUuid: 'triage-queue-uuid',
      },
    });
    mockFetchFreshPatientVitalStatus
      .mockResolvedValueOnce({ dead: false, deathDate: null, isDeceased: false })
      .mockResolvedValueOnce({
        dead: true,
        deathDate: '2026-08-12T15:41:28.000Z',
        isDeceased: true,
      });

    render(<QueueTableActionCell queueEntry={triageQueueEntry} />);
    await user.click(screen.getByRole('button', { name: 'Realizar triaje' }));
    const workspaceOptions = mockLaunchWorkspace2.mock.calls[0][1] as { onVitalsSaved: () => Promise<void> };
    await workspaceOptions.onVitalsSaved();

    expect(mockFetchFreshPatientVitalStatus).toHaveBeenCalledTimes(2);
    expect(mockTransitionTriagedPatient).not.toHaveBeenCalled();
    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'error', title: 'El triaje se guardó, pero no se pudo derivar al paciente' }),
    );
  });

  it('blocks triage and directs a patient without active SIS financing to the cashier', async () => {
    const user = userEvent.setup();
    const triageQueueEntry = {
      ...mockQueueEntryAlice,
      visit: { ...mockQueueEntryAlice.visit, uuid: 'visit-uuid' },
      workflow: {
        isTriageQueue: true,
        sisState: 'inactive' as const,
        isSisStateResolved: true,
        triageState: 'pending' as const,
      },
    };

    render(<QueueTableActionCell queueEntry={triageQueueEntry} />);
    expect(screen.queryByRole('button', { name: 'Realizar triaje' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Derivar a Caja/ }));

    expect(mockLaunchWorkspace2).not.toHaveBeenCalled();
    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Triaje bloqueado por financiamiento', kind: 'warning' }),
    );
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/openmrs/spa/home/billing' });
  });

  it('revalidates current coverage and blocks a stale active row before opening triage', async () => {
    const user = userEvent.setup();
    const triageQueueEntry = {
      ...mockQueueEntryAlice,
      visit: { ...mockQueueEntryAlice.visit, uuid: 'visit-uuid' },
      workflow: {
        isTriageQueue: true,
        sisState: 'active' as const,
        isSisStateResolved: true,
        triageState: 'pending' as const,
      },
    };
    mockRevalidateCurrentSisState.mockResolvedValue('inactive');

    render(<QueueTableActionCell queueEntry={triageQueueEntry} />);
    await user.click(screen.getByRole('button', { name: 'Realizar triaje' }));

    expect(mockRevalidateCurrentSisState).toHaveBeenCalledWith(triageQueueEntry, true);
    expect(mockLaunchWorkspace2).not.toHaveBeenCalled();
    expect(mockFetchFreshPatientVitalStatus).not.toHaveBeenCalled();
    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Triaje bloqueado por financiamiento', kind: 'warning' }),
    );
  });
});
