import {
  fetchCurrentPatient,
  launchWorkspace2,
  navigate,
  showModal,
  showSnackbar,
  useLayoutType,
  useSession,
  userHasAccess,
} from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockQueueEntryAlice, mockSession } from 'test-utils';

import { serviceQueuesEditPrivilege, vitalsEditPrivilege } from '../../constants';
import { getAppointmentTriageConfig } from '../../triage-workflow/triage-workflow.resource';

import { QueueTableActionCell } from './queue-table-action-cell.component';

const mockShowModal = vi.mocked(showModal);
const mockFetchCurrentPatient = vi.mocked(fetchCurrentPatient);
const mockUseLayoutType = vi.mocked(useLayoutType);
const mockUseSession = vi.mocked(useSession);
const mockUserHasAccess = vi.mocked(userHasAccess);
const mockLaunchWorkspace2 = vi.mocked(launchWorkspace2);
const mockGetAppointmentTriageConfig = vi.mocked(getAppointmentTriageConfig);
const mockNavigate = vi.mocked(navigate);
const mockShowSnackbar = vi.mocked(showSnackbar);

vi.mock('../../triage-workflow/triage-workflow.resource', () => ({
  getAppointmentTriageConfig: vi.fn(),
  transitionTriagedPatient: vi.fn(),
}));

describe('QueueTableActionCell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLayoutType.mockReturnValue('small-desktop');
    mockUseSession.mockReturnValue(mockSession.data);
    mockUserHasAccess.mockReturnValue(true);
    mockFetchCurrentPatient.mockResolvedValue({
      id: mockQueueEntryAlice.patient.uuid,
      deceasedBoolean: false,
    } as fhir.Patient);
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
        triageState: 'pending' as const,
      },
    };
    mockUserHasAccess.mockImplementation((privilege) => privilege !== serviceQueuesEditPrivilege);
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
        triageState: 'pending' as const,
      },
    };
    mockUserHasAccess.mockImplementation((privilege) => privilege !== serviceQueuesEditPrivilege);

    render(<QueueTableActionCell queueEntry={triageQueueEntry} />);

    expect(screen.queryByRole('button', { name: 'Realizar triaje' })).not.toBeInTheDocument();
  });

  it('keeps administrative cleanup actions but does not offer queue transition for a deceased patient', () => {
    const deceasedQueueEntry = {
      ...mockQueueEntryAlice,
      patient: {
        ...mockQueueEntryAlice.patient,
        person: { uuid: 'person-uuid', dead: true, deathDate: '2026-08-12T15:41:28.000Z' },
      },
    };

    render(<QueueTableActionCell queueEntry={deceasedQueueEntry} />);

    expect(screen.queryByRole('button', { name: 'Transition' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Actions' })).toBeInTheDocument();
  });

  it('fresh-checks vital status before opening triage and blocks a concurrent death', async () => {
    const user = userEvent.setup();
    const triageQueueEntry = {
      ...mockQueueEntryAlice,
      visit: { ...mockQueueEntryAlice.visit, uuid: 'visit-uuid' },
      workflow: {
        isTriageQueue: true,
        sisState: 'active' as const,
        triageState: 'pending' as const,
      },
    };
    mockFetchCurrentPatient.mockResolvedValueOnce({
      id: mockQueueEntryAlice.patient.uuid,
      deceasedDateTime: '2026-08-12T15:41:28.000Z',
    } as fhir.Patient);

    render(<QueueTableActionCell queueEntry={triageQueueEntry} />);
    await user.click(screen.getByRole('button', { name: 'Realizar triaje' }));

    expect(mockFetchCurrentPatient).toHaveBeenCalledWith(mockQueueEntryAlice.patient.uuid, undefined, false);
    expect(mockLaunchWorkspace2).not.toHaveBeenCalled();
    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'error',
        title: 'Triaje no disponible',
      }),
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
});
