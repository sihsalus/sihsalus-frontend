import {
  getDefaultsFromConfigSchema,
  launchWorkspace2,
  useConfig,
  userHasAccess,
  useSession,
} from '@openmrs/esm-framework';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ConfigObject, configSchema } from '../../config-schema';
import { useTodaysVisits } from '../../hooks/useTodaysVisits';
import {
  changeAppointmentStatus,
  ensureAppointmentVisitLink,
  getAppointmentStatus,
} from '../../patient-appointments/patient-appointments.resource';
import { type Appointment, AppointmentKind, AppointmentStatus } from '../../types';
import AppointmentActions from './appointments-actions.component';
import { getActiveVisitsForPatient } from './batch-change-appointment-statuses.resources';

vi.mock('../../patient-appointments/patient-appointments.resource', () => ({
  APPOINTMENT_VISIT_LINK_CONFIGURATION_MISSING: 'APPOINTMENT_VISIT_LINK_CONFIGURATION_MISSING',
  changeAppointmentStatus: vi.fn(),
  ensureAppointmentVisitLink: vi.fn(),
  getAppointmentStatus: vi.fn(),
}));

vi.mock('../../form/appointments-form.resource', () => ({
  useMutateAppointments: vi.fn().mockReturnValue({ mutateAppointments: vi.fn() }),
}));

vi.mock('./batch-change-appointment-statuses.resources', () => ({
  getActiveVisitsForPatient: vi.fn(),
}));

const mockChangeAppointmentStatus = vi.mocked(changeAppointmentStatus);
const mockGetAppointmentStatus = vi.mocked(getAppointmentStatus);
const mockEnsureAppointmentVisitLink = vi.mocked(ensureAppointmentVisitLink);
const mockLaunchWorkspace2 = vi.mocked(launchWorkspace2);
const mockUseSession = vi.mocked(useSession);
const mockUserHasAccess = vi.mocked(userHasAccess);
const mockGetActiveVisitsForPatient = vi.mocked(getActiveVisitsForPatient);

const appointment: Appointment = {
  uuid: '7cd38a6d-377e-491b-8284-b04cf8b8c6d8',
  appointmentNumber: '0000',
  patient: {
    identifier: '100GEJ',
    identifiers: [],
    name: 'John Wilson',
    uuid: '8673ee4f-e2ab-4077-ba55-4980f408773e',
    gender: 'M',
    age: '35',
  },
  service: {
    appointmentServiceId: 1,
    name: 'Outpatient',
    description: null,
    startTime: '',
    endTime: '',
    maxAppointmentsLimit: null,
    durationMins: null,
    location: {
      uuid: '8d6c993e-c2cc-11de-8d13-0010c6dffd0f',
    },
    uuid: 'e2ec9cf0-ec38-4d2b-af6c-59c82fa30b90',
    initialAppointmentStatus: 'Scheduled',
    creatorName: null,
  },
  provider: {
    uuid: 'f9badd80-ab76-11e2-9e96-0800200c9a66',
    person: { uuid: '24252571-dd5a-11e6-9d9c-0242ac150002', display: 'Dr James Cook' },
  },
  location: { name: 'HIV Clinic', uuid: '2131aff8-2e2a-480a-b7ab-4ac53250262b' },
  startDateTime: new Date().toISOString(),
  appointmentKind: AppointmentKind.WALKIN,
  status: null,
  comments: 'Some comments',
  additionalInfo: null,
  providers: [{ uuid: '24252571-dd5a-11e6-9d9c-0242ac150002', display: 'Dr James Cook' }],
  recurring: false,
  voided: false,
  teleconsultationLink: null,
  extensions: {},
  endDateTime: null,
  dateAppointmentScheduled: null,
};
const requiredVisitTypeUuid = 'required-visit-type-uuid';

const defaultProps = {
  visits: [],
  appointment: appointment,
  scheduleType: 'Pending',
  mutate: () => {},
};

const mockUseConfig = vi.mocked(useConfig<ConfigObject>);
const mockUseTodaysVisits = vi.mocked(useTodaysVisits);

vi.mock('../../hooks/useTodaysVisits', async () => ({
  ...(await vi.importActual('../../hooks/useTodaysVisits')),
  useTodaysVisits: vi.fn(),
}));

describe('AppointmentActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue({ user: { uuid: 'user-1' } } as ReturnType<typeof useSession>);
    mockUserHasAccess.mockReturnValue(true);
    mockGetAppointmentStatus.mockResolvedValue(AppointmentStatus.SCHEDULED);
    mockEnsureAppointmentVisitLink.mockResolvedValue({ created: false });
    mockGetActiveVisitsForPatient.mockResolvedValue({ data: { results: [] } } as Awaited<
      ReturnType<typeof getActiveVisitsForPatient>
    >);
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it('renders the check in button when appointment is today and enabled', () => {
    appointment.status = AppointmentStatus.SCHEDULED;

    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(configSchema),
      checkInButton: { enabled: true, showIfActiveVisit: false, customUrl: '' },
      checkOutButton: { enabled: true, customUrl: '' },
    });

    mockUseTodaysVisits.mockReturnValue({
      visits: [],
      error: null,
      isLoading: false,
      mutateVisit: vi.fn(),
    });

    render(<AppointmentActions {...defaultProps} />);
    expect(screen.getByText(/check in/i)).toBeInTheDocument();
  });

  it('does not offer check-in unless the user has every native visit and queue privilege', () => {
    appointment.status = AppointmentStatus.SCHEDULED;
    mockUserHasAccess.mockImplementation((requiredPrivileges) =>
      Array.isArray(requiredPrivileges) ? !requiredPrivileges.includes('Add Visits') : true,
    );
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(configSchema),
      checkInButton: { enabled: true, showIfActiveVisit: false, customUrl: '' },
      checkOutButton: { enabled: true, customUrl: '' },
    });
    mockUseTodaysVisits.mockReturnValue({
      visits: [],
      error: null,
      isLoading: false,
      mutateVisit: vi.fn(),
    });

    render(<AppointmentActions {...defaultProps} />);

    expect(screen.queryByRole('button', { name: /check in/i })).not.toBeInTheDocument();
    expect(mockUserHasAccess).toHaveBeenCalledWith(
      [
        'app:home.citas.editar',
        'Get Patients',
        'Get Locations',
        'Get Visits',
        'Add Visits',
        'Edit Visits',
        'Get Visit Types',
        'Get Visit Attribute Types',
        'Get Queue Entries',
        'Get Queues',
        'Manage Queue Entries',
      ],
      expect.anything(),
    );
  });

  it('does not offer check-in without permission to write the appointment visit link', () => {
    appointment.status = AppointmentStatus.SCHEDULED;
    mockUserHasAccess.mockImplementation((requiredPrivileges) =>
      Array.isArray(requiredPrivileges) ? !requiredPrivileges.includes('Edit Visits') : true,
    );
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(configSchema),
      checkInButton: { enabled: true, showIfActiveVisit: false, customUrl: '' },
      checkOutButton: { enabled: true, customUrl: '' },
    });
    mockUseTodaysVisits.mockReturnValue({
      visits: [],
      error: null,
      isLoading: false,
      mutateVisit: vi.fn(),
    });

    render(<AppointmentActions {...defaultProps} />);

    expect(screen.queryByRole('button', { name: /check in/i })).not.toBeInTheDocument();
  });

  it('authorizes checkout separately without requiring Add Visits', () => {
    appointment.status = AppointmentStatus.CHECKEDIN;
    mockUserHasAccess.mockImplementation((requiredPrivileges) =>
      Array.isArray(requiredPrivileges) ? !requiredPrivileges.includes('Add Visits') : true,
    );
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(configSchema),
      checkInButton: { enabled: true, showIfActiveVisit: false, customUrl: '' },
      checkOutButton: { enabled: true, customUrl: '' },
    });
    mockUseTodaysVisits.mockReturnValue({
      visits: [],
      error: null,
      isLoading: false,
      mutateVisit: vi.fn(),
    });

    render(<AppointmentActions {...defaultProps} />);

    expect(screen.getByRole('button', { name: /check out/i })).toBeInTheDocument();
    expect(mockUserHasAccess).toHaveBeenCalledWith(
      ['app:home.citas.editar', 'Get Visits', 'Edit Visits', 'Get Queue Entries', 'Get Queues', 'Manage Queue Entries'],
      expect.anything(),
    );
  });

  it('does not render check in button when disabled', () => {
    appointment.status = AppointmentStatus.SCHEDULED;

    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(configSchema),
      checkInButton: { enabled: false, showIfActiveVisit: false, customUrl: '' },
      checkOutButton: { enabled: true, customUrl: '' },
    });

    mockUseTodaysVisits.mockReturnValue({
      visits: [],
      error: null,
      isLoading: false,
      mutateVisit: vi.fn(),
    });

    render(<AppointmentActions {...defaultProps} />);
    expect(screen.queryByText(/check in/i)).not.toBeInTheDocument();
  });

  it('fails closed without crashing when a legacy appointment has no location', async () => {
    appointment.status = AppointmentStatus.SCHEDULED;
    const legacyAppointment = { ...appointment, location: undefined } as unknown as Appointment;
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(configSchema),
      checkInButton: { enabled: true, showIfActiveVisit: false, customUrl: '' },
      checkOutButton: { enabled: true, customUrl: '' },
    });
    mockUseTodaysVisits.mockReturnValue({
      visits: [],
      error: null,
      isLoading: false,
      mutateVisit: vi.fn(),
    });

    render(<AppointmentActions {...defaultProps} appointment={legacyAppointment} />);

    await userEvent.click(screen.getByRole('button', { name: /check in/i }));
    expect(mockGetAppointmentStatus).not.toHaveBeenCalled();
    expect(mockGetActiveVisitsForPatient).not.toHaveBeenCalled();
    expect(mockLaunchWorkspace2).not.toHaveBeenCalled();
  });

  it('renders checked out button when completed', () => {
    appointment.status = AppointmentStatus.COMPLETED;

    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(configSchema),
      checkInButton: { enabled: true, showIfActiveVisit: false, customUrl: '' },
      checkOutButton: { enabled: true, customUrl: '' },
    });

    mockUseTodaysVisits.mockReturnValue({
      visits: [
        {
          patient: { uuid: appointment.patient.uuid },
          startDatetime: new Date().toISOString(),
          stopDatetime: new Date().toISOString(),
          uuid: '',
        },
      ],
      error: null,
      isLoading: false,
      mutateVisit: vi.fn(),
    });

    render(<AppointmentActions {...defaultProps} />);
    expect(screen.getByText('Checked out')).toBeInTheDocument();
  });

  it('offers checkout reconciliation when a completed appointment still has an active visit', () => {
    appointment.status = AppointmentStatus.COMPLETED;
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(configSchema),
      checkInButton: { enabled: true, showIfActiveVisit: false, customUrl: '' },
      checkOutButton: { enabled: true, customUrl: '' },
    });
    mockUseTodaysVisits.mockReturnValue({
      visits: [
        {
          patient: { uuid: appointment.patient.uuid },
          startDatetime: new Date().toISOString(),
          stopDatetime: null,
          uuid: 'active-visit-uuid',
          attributes: [
            {
              attributeType: { uuid: '193508ab-20c6-5291-9f23-0257335eaabd' },
              value: appointment.uuid,
            },
          ],
        },
      ],
      error: null,
      isLoading: false,
      mutateVisit: vi.fn(),
    });

    render(<AppointmentActions {...defaultProps} />);

    expect(screen.getByRole('button', { name: 'Regularizar cierre' })).toBeInTheDocument();
  });

  it('does not offer checkout reconciliation for an unrelated active visit', () => {
    appointment.status = AppointmentStatus.COMPLETED;
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(configSchema),
      checkInButton: { enabled: true, showIfActiveVisit: false, customUrl: '' },
      checkOutButton: { enabled: true, customUrl: '' },
    });
    mockUseTodaysVisits.mockReturnValue({
      visits: [
        {
          patient: { uuid: appointment.patient.uuid },
          startDatetime: new Date().toISOString(),
          stopDatetime: null,
          uuid: 'unrelated-active-visit-uuid',
          attributes: [
            {
              attributeType: { uuid: '193508ab-20c6-5291-9f23-0257335eaabd' },
              value: 'another-appointment-uuid',
            },
          ],
        },
      ],
      error: null,
      isLoading: false,
      mutateVisit: vi.fn(),
    });

    render(<AppointmentActions {...defaultProps} />);

    expect(screen.queryByRole('button', { name: 'Regularizar cierre' })).not.toBeInTheDocument();
    expect(screen.getByText('Checked out')).toBeInTheDocument();
  });

  it('renders check out button when active visit exists', () => {
    appointment.status = AppointmentStatus.CHECKEDIN;

    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(configSchema),
      checkInButton: { enabled: true, showIfActiveVisit: false, customUrl: '' },
      checkOutButton: { enabled: true, customUrl: '' },
    });

    mockUseTodaysVisits.mockReturnValue({
      visits: [
        {
          patient: { uuid: appointment.patient.uuid },
          startDatetime: new Date().toISOString(),
          stopDatetime: null,
          uuid: '',
        },
      ],
      error: null,
      isLoading: false,
      mutateVisit: vi.fn(),
    });

    render(<AppointmentActions {...defaultProps} />);
    expect(screen.getByText(/check out/i)).toBeInTheDocument();
  });

  it('renders check-in button when active visit exists and showIfActiveVisit is true', () => {
    appointment.status = AppointmentStatus.SCHEDULED;

    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(configSchema),
      appointmentQueueMappings: [
        {
          appointmentServiceUuid: appointment.service.uuid,
          appointmentLocationUuid: appointment.location.uuid,
          queueUuid: 'mapped-queue-uuid',
          queueLocationUuid: 'mapped-queue-location-uuid',
          requiredVisitTypeUuid,
        },
      ],
      checkInButton: { enabled: true, showIfActiveVisit: true, customUrl: '' },
    });

    mockUseTodaysVisits.mockReturnValue({
      visits: [
        {
          patient: { uuid: appointment.patient.uuid },
          startDatetime: new Date().toISOString(),
          stopDatetime: null,
          uuid: 'test-visit-uuid',
        },
      ],
      mutateVisit: vi.fn(),
      error: null,
      isLoading: false,
    });

    render(<AppointmentActions {...defaultProps} />);
    expect(screen.getByRole('button', { name: /check in/i })).toBeInTheDocument();
  });

  it('does not render check-in button when active visit exists and showIfActiveVisit is false', () => {
    appointment.status = AppointmentStatus.SCHEDULED;

    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(configSchema),
      checkInButton: { enabled: true, showIfActiveVisit: false, customUrl: '' },
    });

    mockUseTodaysVisits.mockReturnValue({
      visits: [
        {
          patient: { uuid: appointment.patient.uuid },
          startDatetime: new Date().toISOString(),
          stopDatetime: null,
          uuid: 'test-visit-uuid',
        },
      ],
      mutateVisit: vi.fn(),
      error: null,
      isLoading: false,
    });

    render(<AppointmentActions {...defaultProps} />);
    expect(screen.queryByRole('button', { name: /check in/i })).not.toBeInTheDocument();
  });

  it('adds an active visit to a queue before changing the appointment status', async () => {
    appointment.status = AppointmentStatus.SCHEDULED;

    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(configSchema),
      appointmentQueueMappings: [
        {
          appointmentServiceUuid: appointment.service.uuid,
          appointmentLocationUuid: appointment.location.uuid,
          queueUuid: 'mapped-queue-uuid',
          queueLocationUuid: 'mapped-queue-location-uuid',
          requiredVisitTypeUuid,
        },
      ],
      checkInButton: { enabled: true, showIfActiveVisit: true, customUrl: '' },
    });

    mockUseTodaysVisits.mockReturnValue({
      visits: [
        {
          patient: { uuid: appointment.patient.uuid },
          startDatetime: new Date().toISOString(),
          stopDatetime: null,
          uuid: 'test-visit-uuid',
        },
      ],
      mutateVisit: vi.fn(),
      error: null,
      isLoading: false,
    });

    mockChangeAppointmentStatus.mockResolvedValue({ data: {} } as Awaited<ReturnType<typeof changeAppointmentStatus>>);
    mockGetActiveVisitsForPatient.mockResolvedValue({
      data: {
        results: [
          {
            patient: { uuid: appointment.patient.uuid },
            startDatetime: new Date().toISOString(),
            stopDatetime: null,
            uuid: 'test-visit-uuid',
            encounters: [],
            visitType: { uuid: requiredVisitTypeUuid, display: 'Facility Visit' },
            location: appointment.location,
          },
        ],
      },
    } as Awaited<ReturnType<typeof getActiveVisitsForPatient>>);
    render(<AppointmentActions {...defaultProps} />);

    const btn = screen.getByRole('button', { name: /check in/i });
    await userEvent.click(btn);

    expect(mockLaunchWorkspace2).toHaveBeenCalledWith(
      'appointments-add-active-visit-to-queue-workspace',
      expect.objectContaining({
        selectedPatientUuid: appointment.patient.uuid,
        activeVisit: expect.objectContaining({ uuid: 'test-visit-uuid' }),
        currentQueueLocationUuid: 'mapped-queue-location-uuid',
        currentServiceQueueUuid: 'mapped-queue-uuid',
        requiredVisitLocation: {
          uuid: appointment.location.uuid,
          display: appointment.location.name,
        },
        requiredVisitTypeUuid,
        onBeforeQueueEntrySave: expect.any(Function),
        onQueueEntryAdded: expect.any(Function),
      }),
    );
    expect(mockChangeAppointmentStatus).not.toHaveBeenCalled();

    const launchOptions = mockLaunchWorkspace2.mock.calls[0][1] as { onQueueEntryAdded: () => Promise<void> };
    await act(async () => launchOptions.onQueueEntryAdded());

    expect(mockChangeAppointmentStatus).toHaveBeenCalledWith('CheckedIn', appointment.uuid);
  });

  it('blocks reusing an active visit from another appointment location', async () => {
    appointment.status = AppointmentStatus.SCHEDULED;
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(configSchema),
      appointmentQueueMappings: [
        {
          appointmentServiceUuid: appointment.service.uuid,
          appointmentLocationUuid: appointment.location.uuid,
          queueUuid: 'mapped-queue-uuid',
          queueLocationUuid: 'mapped-queue-location-uuid',
          requiredVisitTypeUuid,
        },
      ],
      checkInButton: { enabled: true, showIfActiveVisit: true, customUrl: '' },
    });
    const listedVisit = {
      patient: { uuid: appointment.patient.uuid },
      startDatetime: new Date().toISOString(),
      stopDatetime: null,
      uuid: 'test-visit-uuid',
      encounters: [],
      visitType: { uuid: requiredVisitTypeUuid, display: 'Facility Visit' },
      location: appointment.location,
    };
    mockUseTodaysVisits.mockReturnValue({
      visits: [listedVisit],
      mutateVisit: vi.fn(),
      error: null,
      isLoading: false,
    });
    mockGetActiveVisitsForPatient.mockResolvedValue({
      data: { results: [{ ...listedVisit, location: { uuid: 'other-location', display: 'Otra sede' } }] },
    } as Awaited<ReturnType<typeof getActiveVisitsForPatient>>);

    render(<AppointmentActions {...defaultProps} />);
    await userEvent.click(screen.getByRole('button', { name: /check in/i }));

    await waitFor(() => expect(mockGetActiveVisitsForPatient).toHaveBeenCalled());
    expect(mockLaunchWorkspace2).not.toHaveBeenCalled();
    expect(mockEnsureAppointmentVisitLink).not.toHaveBeenCalled();
  });

  it('blocks reusing an active visit with an incompatible visit type', async () => {
    appointment.status = AppointmentStatus.SCHEDULED;
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(configSchema),
      appointmentQueueMappings: [
        {
          appointmentServiceUuid: appointment.service.uuid,
          appointmentLocationUuid: appointment.location.uuid,
          queueUuid: 'mapped-queue-uuid',
          queueLocationUuid: 'mapped-queue-location-uuid',
          requiredVisitTypeUuid,
        },
      ],
      checkInButton: { enabled: true, showIfActiveVisit: true, customUrl: '' },
    });
    const listedVisit = {
      patient: { uuid: appointment.patient.uuid },
      startDatetime: new Date().toISOString(),
      stopDatetime: null,
      uuid: 'test-visit-uuid',
      encounters: [],
      visitType: { uuid: requiredVisitTypeUuid, display: 'Facility Visit' },
      location: appointment.location,
    };
    mockUseTodaysVisits.mockReturnValue({
      visits: [listedVisit],
      mutateVisit: vi.fn(),
      error: null,
      isLoading: false,
    });
    mockGetActiveVisitsForPatient.mockResolvedValue({
      data: {
        results: [{ ...listedVisit, visitType: { uuid: 'other-visit-type', display: 'Otro tipo' } }],
      },
    } as Awaited<ReturnType<typeof getActiveVisitsForPatient>>);

    render(<AppointmentActions {...defaultProps} />);
    await userEvent.click(screen.getByRole('button', { name: /check in/i }));

    await waitFor(() => expect(mockGetActiveVisitsForPatient).toHaveBeenCalled());
    expect(mockLaunchWorkspace2).not.toHaveBeenCalled();
    expect(mockEnsureAppointmentVisitLink).not.toHaveBeenCalled();
  });

  it('rejects queue persistence when the same active visit changes location while the workspace is open', async () => {
    appointment.status = AppointmentStatus.SCHEDULED;
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(configSchema),
      appointmentQueueMappings: [
        {
          appointmentServiceUuid: appointment.service.uuid,
          appointmentLocationUuid: appointment.location.uuid,
          queueUuid: 'mapped-queue-uuid',
          queueLocationUuid: 'mapped-queue-location-uuid',
          requiredVisitTypeUuid,
        },
      ],
      checkInButton: { enabled: true, showIfActiveVisit: true, customUrl: '' },
    });
    const expectedVisit = {
      patient: { uuid: appointment.patient.uuid },
      startDatetime: new Date().toISOString(),
      stopDatetime: null,
      uuid: 'test-visit-uuid',
      encounters: [],
      visitType: { uuid: requiredVisitTypeUuid, display: 'Facility Visit' },
      location: appointment.location,
    };
    mockUseTodaysVisits.mockReturnValue({
      visits: [expectedVisit],
      mutateVisit: vi.fn(),
      error: null,
      isLoading: false,
    });
    mockGetActiveVisitsForPatient
      .mockResolvedValueOnce({ data: { results: [expectedVisit] } } as Awaited<
        ReturnType<typeof getActiveVisitsForPatient>
      >)
      .mockResolvedValueOnce({
        data: {
          results: [{ ...expectedVisit, location: { uuid: 'other-location', display: 'Otra sede' } }],
        },
      } as Awaited<ReturnType<typeof getActiveVisitsForPatient>>);

    render(<AppointmentActions {...defaultProps} />);
    await userEvent.click(screen.getByRole('button', { name: /check in/i }));

    const launchOptions = mockLaunchWorkspace2.mock.calls[0][1] as {
      onBeforeQueueEntrySave: (visit: typeof expectedVisit) => Promise<boolean>;
    };
    await expect(launchOptions.onBeforeQueueEntrySave(expectedVisit)).resolves.toBe(false);
    expect(mockGetActiveVisitsForPatient).toHaveBeenCalledTimes(2);
    expect(mockEnsureAppointmentVisitLink).not.toHaveBeenCalled();
  });

  it('allows queue retry when the appointment was already checked in after a lost response', async () => {
    appointment.status = AppointmentStatus.SCHEDULED;
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(configSchema),
      appointmentQueueMappings: [
        {
          appointmentServiceUuid: appointment.service.uuid,
          appointmentLocationUuid: appointment.location.uuid,
          queueUuid: 'mapped-queue-uuid',
          queueLocationUuid: 'mapped-queue-location-uuid',
          requiredVisitTypeUuid,
        },
      ],
      checkInButton: { enabled: true, showIfActiveVisit: true, customUrl: '' },
    });
    const activeVisit = {
      patient: { uuid: appointment.patient.uuid },
      startDatetime: new Date().toISOString(),
      stopDatetime: null,
      uuid: 'test-visit-uuid',
      encounters: [],
      visitType: { uuid: requiredVisitTypeUuid, display: 'Facility Visit' },
      location: appointment.location,
    };
    mockUseTodaysVisits.mockReturnValue({
      visits: [activeVisit],
      mutateVisit: vi.fn(),
      error: null,
      isLoading: false,
    });
    mockGetActiveVisitsForPatient.mockResolvedValue({ data: { results: [activeVisit] } } as Awaited<
      ReturnType<typeof getActiveVisitsForPatient>
    >);
    mockGetAppointmentStatus
      .mockResolvedValueOnce(AppointmentStatus.SCHEDULED)
      .mockResolvedValueOnce(AppointmentStatus.CHECKEDIN);

    render(<AppointmentActions {...defaultProps} />);
    await userEvent.click(screen.getByRole('button', { name: /check in/i }));
    const launchOptions = mockLaunchWorkspace2.mock.calls[0][1] as {
      onBeforeQueueEntrySave: (visit: typeof activeVisit) => Promise<boolean>;
    };

    await expect(launchOptions.onBeforeQueueEntrySave(activeVisit)).resolves.toBe(true);
    expect(mockEnsureAppointmentVisitLink).toHaveBeenCalledWith(
      activeVisit.uuid,
      appointment.uuid,
      '193508ab-20c6-5291-9f23-0257335eaabd',
    );
  });

  it('blocks queue persistence when the appointment status changes while the workspace is open', async () => {
    appointment.status = AppointmentStatus.SCHEDULED;
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(configSchema),
      appointmentQueueMappings: [
        {
          appointmentServiceUuid: appointment.service.uuid,
          appointmentLocationUuid: appointment.location.uuid,
          queueUuid: 'mapped-queue-uuid',
          queueLocationUuid: 'mapped-queue-location-uuid',
          requiredVisitTypeUuid,
        },
      ],
      checkInButton: { enabled: true, showIfActiveVisit: true, customUrl: '' },
    });
    mockUseTodaysVisits.mockReturnValue({
      visits: [],
      mutateVisit: vi.fn(),
      error: null,
      isLoading: false,
    });
    const activeVisit = {
      patient: { uuid: appointment.patient.uuid },
      startDatetime: new Date().toISOString(),
      stopDatetime: null,
      uuid: 'fresh-active-visit',
      encounters: [],
      visitType: { uuid: requiredVisitTypeUuid, display: 'Facility Visit' },
      location: appointment.location,
    };
    mockGetActiveVisitsForPatient.mockResolvedValue({ data: { results: [activeVisit] } } as Awaited<
      ReturnType<typeof getActiveVisitsForPatient>
    >);
    mockGetAppointmentStatus
      .mockResolvedValueOnce(AppointmentStatus.SCHEDULED)
      .mockResolvedValueOnce(AppointmentStatus.CANCELLED);

    render(<AppointmentActions {...defaultProps} />);
    await userEvent.click(screen.getByRole('button', { name: /check in/i }));

    const launchOptions = mockLaunchWorkspace2.mock.calls[0][1] as {
      onBeforeQueueEntrySave: (visit: typeof activeVisit) => Promise<boolean>;
    };
    await expect(launchOptions.onBeforeQueueEntrySave(activeVisit)).resolves.toBe(false);
    expect(mockChangeAppointmentStatus).not.toHaveBeenCalled();
  });

  it('launches the start visit workspace without checking in immediately when no active visit exists', async () => {
    appointment.status = AppointmentStatus.SCHEDULED;

    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(configSchema),
      checkInButton: { enabled: true, showIfActiveVisit: false, customUrl: '' },
    });

    mockUseTodaysVisits.mockReturnValue({
      visits: [],
      mutateVisit: vi.fn(),
      error: null,
      isLoading: false,
    });

    render(<AppointmentActions {...defaultProps} />);

    await userEvent.click(screen.getByRole('button', { name: /check in/i }));

    expect(mockLaunchWorkspace2).toHaveBeenCalledWith(
      'appointments-start-visit-workspace',
      expect.objectContaining({
        patientUuid: appointment.patient.uuid,
        additionalVisitAttributes: [
          {
            attributeType: '193508ab-20c6-5291-9f23-0257335eaabd',
            value: appointment.uuid,
          },
        ],
        visitPersistenceCorrelation: {
          attributeType: '193508ab-20c6-5291-9f23-0257335eaabd',
          value: appointment.uuid,
        },
        openedFrom: 'appointments-check-in',
        onVisitStarted: expect.any(Function),
      }),
    );
    expect(mockChangeAppointmentStatus).not.toHaveBeenCalled();
  });

  it('checks in the appointment after the start visit workspace creates a visit', async () => {
    appointment.status = AppointmentStatus.SCHEDULED;

    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(configSchema),
      checkInButton: { enabled: true, showIfActiveVisit: false, customUrl: '' },
    });

    mockUseTodaysVisits.mockReturnValue({
      visits: [],
      mutateVisit: vi.fn(),
      error: null,
      isLoading: false,
    });
    mockGetAppointmentStatus.mockResolvedValue(AppointmentStatus.SCHEDULED);
    mockChangeAppointmentStatus.mockResolvedValue({ data: {} } as Awaited<ReturnType<typeof changeAppointmentStatus>>);

    render(<AppointmentActions {...defaultProps} />);

    await userEvent.click(screen.getByRole('button', { name: /check in/i }));
    const launchOptions = mockLaunchWorkspace2.mock.calls[0][1] as { onVisitStarted: () => Promise<void> };
    await act(async () => launchOptions.onVisitStarted());

    expect(mockGetAppointmentStatus).toHaveBeenCalledWith(appointment.uuid);
    expect(mockChangeAppointmentStatus).toHaveBeenCalledWith(AppointmentStatus.CHECKEDIN, appointment.uuid);
  });

  it('does not start the workflow if the appointment is already checked in', async () => {
    appointment.status = AppointmentStatus.SCHEDULED;

    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(configSchema),
      checkInButton: { enabled: true, showIfActiveVisit: false, customUrl: '' },
    });

    mockUseTodaysVisits.mockReturnValue({
      visits: [],
      mutateVisit: vi.fn(),
      error: null,
      isLoading: false,
    });
    mockGetAppointmentStatus.mockResolvedValue(AppointmentStatus.CHECKEDIN);

    render(<AppointmentActions {...defaultProps} />);

    await userEvent.click(screen.getByRole('button', { name: /check in/i }));

    expect(mockGetAppointmentStatus).toHaveBeenCalledWith(appointment.uuid);
    expect(mockLaunchWorkspace2).not.toHaveBeenCalled();
    expect(mockChangeAppointmentStatus).not.toHaveBeenCalled();
  });

  it('does not offer check-in for a missed appointment', () => {
    appointment.status = AppointmentStatus.MISSED;
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(configSchema),
      checkInButton: { enabled: true, showIfActiveVisit: true, customUrl: '' },
      checkOutButton: { enabled: true, customUrl: '' },
    });
    mockUseTodaysVisits.mockReturnValue({
      visits: [],
      mutateVisit: vi.fn(),
      error: null,
      isLoading: false,
    });

    render(<AppointmentActions {...defaultProps} />);

    expect(screen.queryByRole('button', { name: /check in/i })).not.toBeInTheDocument();
  });

  // commenting these tests out as this functionality is not implemented yet so not sure how they would have ever passed?
  /*it('renders the correct button when today is the appointment date and the schedule type is pending', () => {
    mockUseConfig.mockReturnValue({
      checkInButton: { enabled: true },
      checkOutButton: { enabled: true },
    }));
    mockUseTodaysVisits.mockReturnValue({
      visits: [],
    }));
    const props = { ...defaultProps, scheduleType: 'Pending' };
    render(<AppointmentActions {...props} />);
    const button = screen.getByRole('button', { name: /Checked out/i });
    expect(button).toBeInTheDocument();
  });

  it('renders the correct button when today is the appointment date and the schedule type is not pending', () => {
    mockUseConfig.mockReturnValue({
      checkInButton: { enabled: true },
      checkOutButton: { enabled: true },
    }));
    mockUseTodaysVisits.mockReturnValue({
      visits: [],
    }));
    const props = { ...defaultProps, scheduleType: 'Confirmed' };
    render(<AppointmentActions {...props} />);
    const button = screen.getByRole('button', { name: /Checked out/i });
    expect(button).toBeInTheDocument();
  });*/
});
