import {
  getDefaultsFromConfigSchema,
  navigate,
  showModal,
  useConfig,
  userHasAccess,
  useSession,
} from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ConfigObject, configSchema } from '../../config-schema';
import { useTodaysVisits } from '../../hooks/useTodaysVisits';
import { type Appointment, AppointmentKind, AppointmentStatus } from '../../types';
import AppointmentActions from './appointments-actions.component';

const mockNavigate = vi.mocked(navigate);
const mockShowModal = vi.mocked(showModal);
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

  it('authorizes admission reconciliation separately without requiring Add Visits', () => {
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

    expect(screen.getByRole('button', { name: /regularizar admisión/i })).toHaveAttribute(
      'title',
      'La cita tiene la llegada registrada pero no tiene una consulta activa vinculada. Revise y regularice su estado.',
    );
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

  it('opens the arrival modal when clicking check in', async () => {
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
    await userEvent.click(screen.getByRole('button', { name: /check in/i }));

    expect(mockShowModal).toHaveBeenCalledWith(
      'appointment-arrival-modal',
      expect.objectContaining({
        appointment,
        patientUuid: appointment.patient.uuid,
        mutateVisits: expect.any(Function),
        closeModal: expect.any(Function),
      }),
    );
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('navigates to the custom check-in URL instead of opening the arrival modal', async () => {
    appointment.status = AppointmentStatus.SCHEDULED;
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(configSchema),
      checkInButton: { enabled: true, showIfActiveVisit: false, customUrl: '/custom/check-in' },
      checkOutButton: { enabled: true, customUrl: '' },
    });
    mockUseTodaysVisits.mockReturnValue({
      visits: [],
      error: null,
      isLoading: false,
      mutateVisit: vi.fn(),
    });

    render(<AppointmentActions {...defaultProps} />);
    await userEvent.click(screen.getByRole('button', { name: /check in/i }));

    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/custom/check-in',
      templateParams: { patientUuid: appointment.patient.uuid, appointmentUuid: appointment.uuid },
    });
    expect(mockShowModal).not.toHaveBeenCalled();
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
          uuid: 'linked-active-visit-uuid',
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
    expect(screen.getByText(/check out/i)).toBeInTheDocument();
  });

  it.each([
    { case: 'active visits are still loading', error: null, isLoading: true },
    { case: 'active visits failed to load', error: new Error('visit lookup failed'), isLoading: false },
  ])('does not report an orphan admission when $case', ({ error, isLoading }) => {
    appointment.status = AppointmentStatus.CHECKEDIN;
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(configSchema),
      checkInButton: { enabled: true, showIfActiveVisit: false, customUrl: '' },
      checkOutButton: { enabled: true, customUrl: '' },
    });
    mockUseTodaysVisits.mockReturnValue({
      visits: [],
      error,
      isLoading,
      mutateVisit: vi.fn(),
    });

    render(<AppointmentActions {...defaultProps} />);

    expect(screen.getByRole('button', { name: /check out/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /regularizar admisión/i })).not.toBeInTheDocument();
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
});
