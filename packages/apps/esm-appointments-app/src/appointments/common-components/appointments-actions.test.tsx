import {
  getDefaultsFromConfigSchema,
  launchWorkspace2,
  useConfig,
  userHasAccess,
  useSession,
} from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ConfigObject, configSchema } from '../../config-schema';
import { useTodaysVisits } from '../../hooks/useTodaysVisits';
import {
  changeAppointmentStatus,
  getAppointmentStatus,
} from '../../patient-appointments/patient-appointments.resource';
import { type Appointment, AppointmentKind, AppointmentStatus } from '../../types';

import AppointmentActions from './appointments-actions.component';

vi.mock('../../patient-appointments/patient-appointments.resource', () => ({
  changeAppointmentStatus: vi.fn(),
  getAppointmentStatus: vi.fn(),
}));

vi.mock('../../form/appointments-form.resource', () => ({
  useMutateAppointments: vi.fn().mockReturnValue({ mutateAppointments: vi.fn() }),
}));

const mockChangeAppointmentStatus = vi.mocked(changeAppointmentStatus);
const mockGetAppointmentStatus = vi.mocked(getAppointmentStatus);
const mockLaunchWorkspace2 = vi.mocked(launchWorkspace2);
const mockUseSession = vi.mocked(useSession);
const mockUserHasAccess = vi.mocked(userHasAccess);

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
          encounters: [],
          visitType: { uuid: '', display: 'Facility Visit' },
        },
      ],
      error: null,
      isLoading: false,
      mutateVisit: vi.fn(),
    });

    render(<AppointmentActions {...defaultProps} />);
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
          encounters: [],
          visitType: { uuid: '', display: 'Facility Visit' },
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
      checkInButton: { enabled: true, showIfActiveVisit: true, customUrl: '' },
    });

    mockUseTodaysVisits.mockReturnValue({
      visits: [
        {
          patient: { uuid: appointment.patient.uuid },
          startDatetime: new Date().toISOString(),
          stopDatetime: null,
          uuid: 'test-visit-uuid',
          encounters: [],
          visitType: { uuid: '', display: 'Facility Visit' },
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
          encounters: [],
          visitType: { uuid: '', display: 'Facility Visit' },
        },
      ],
      mutateVisit: vi.fn(),
      error: null,
      isLoading: false,
    });

    render(<AppointmentActions {...defaultProps} />);
    expect(screen.queryByRole('button', { name: /check in/i })).not.toBeInTheDocument();
  });

  it('calls changeAppointmentStatus when active visit exists and check-in clicked', async () => {
    appointment.status = AppointmentStatus.SCHEDULED;

    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(configSchema),
      checkInButton: { enabled: true, showIfActiveVisit: true, customUrl: '' },
    });

    mockUseTodaysVisits.mockReturnValue({
      visits: [
        {
          patient: { uuid: appointment.patient.uuid },
          startDatetime: new Date().toISOString(),
          stopDatetime: null,
          uuid: 'test-visit-uuid',
          encounters: [],
          visitType: { uuid: '', display: 'Facility Visit' },
        },
      ],
      mutateVisit: vi.fn(),
      error: null,
      isLoading: false,
    });

    mockChangeAppointmentStatus.mockResolvedValue({ data: {} } as Awaited<ReturnType<typeof changeAppointmentStatus>>);
    render(<AppointmentActions {...defaultProps} />);

    const btn = screen.getByRole('button', { name: /check in/i });
    await userEvent.click(btn);

    expect(mockChangeAppointmentStatus).toHaveBeenCalledWith('CheckedIn', appointment.uuid);
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
    await launchOptions.onVisitStarted();

    expect(mockGetAppointmentStatus).toHaveBeenCalledWith(appointment.uuid);
    expect(mockChangeAppointmentStatus).toHaveBeenCalledWith(AppointmentStatus.CHECKEDIN, appointment.uuid);
  });

  it('does not check in again after the start visit workspace if appointment is already checked in', async () => {
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
    const launchOptions = mockLaunchWorkspace2.mock.calls[0][1] as { onVisitStarted: () => Promise<void> };
    await launchOptions.onVisitStarted();

    expect(mockGetAppointmentStatus).toHaveBeenCalledWith(appointment.uuid);
    expect(mockChangeAppointmentStatus).not.toHaveBeenCalled();
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
