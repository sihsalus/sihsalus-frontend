import {
  formatDatetime,
  getDefaultsFromConfigSchema,
  useConfig,
  userHasAccess,
  useSession,
} from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getByTextWithMarkup } from 'test-utils';

import { type ConfigObject, configSchema } from '../../config-schema';
import { exportAppointmentsToSpreadsheet } from '../../helpers/excel';
import { useTodaysVisits } from '../../hooks/useTodaysVisits';
import { type Appointment, type AppointmentKind, AppointmentStatus } from '../../types';

import AppointmentsTable from './appointments-table.component';

const defaultProps = {
  appointments: [],
  isLoading: false,
  scheduleType: 'Scheduled',
  tableHeading: 'scheduled',
  visits: [],
};

const mockAppointments = [
  {
    uuid: '7cd38a6d-377e-491b-8284-b04cf8b8c6d8',
    appointmentNumber: '00001',
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
    appointmentKind: 'WalkIn' as AppointmentKind,
    status: 'Scheduled' as AppointmentStatus,
    comments: 'Some comments',
    additionalInfo: null,
    providers: [{ uuid: '24252571-dd5a-11e6-9d9c-0242ac150002', display: 'Dr James Cook' }],
    recurring: false,
    voided: false,
    teleconsultationLink: null,
    extensions: [],
  },
] as unknown as Array<Appointment>;

const mockUseConfig = vi.mocked(useConfig<ConfigObject>);
const mockExportAppointmentsToSpreadsheet = vi.mocked(exportAppointmentsToSpreadsheet);
const mockUseSession = vi.mocked(useSession);
const mockUserHasAccess = vi.mocked(userHasAccess);
const mockUseTodaysVisits = vi.mocked(useTodaysVisits);

vi.mock('../../helpers/excel', async () => {
  return {
    ...(await vi.importActual('../../helpers/excel')),
    exportAppointmentsToSpreadsheet: vi.fn(),
  };
});

vi.mock('../../hooks/useTodaysVisits', () => ({
  useTodaysVisits: vi.fn(),
}));

describe('AppointmentsTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(configSchema),
      customPatientChartUrl: 'url-to-patient-chart',
      checkInButton: { enabled: false, showIfActiveVisit: false, customUrl: null },
      checkOutButton: { enabled: false, customUrl: null },
    });
    mockUseSession.mockReturnValue({ user: { uuid: 'user-uuid' } } as ReturnType<typeof useSession>);
    mockUserHasAccess.mockReturnValue(true);
    mockUseTodaysVisits.mockReturnValue({
      visits: [],
      error: null,
      isLoading: false,
      mutateVisit: vi.fn(),
    });
  });

  it('renders an empty state if appointments data is unavailable', async () => {
    renderAppointmentsTable();

    await screen.findByRole('heading', { name: /scheduled appointment/i });

    expect(getByTextWithMarkup('There are no scheduled appointments to display')).toBeInTheDocument();
  });

  it.each([
    [AppointmentStatus.SCHEDULED, 'expected', 'Expected appointments'],
    [AppointmentStatus.CHECKEDIN, 'checkedIn', 'Appointments in progress'],
    [AppointmentStatus.COMPLETED, 'completed', 'Completed appointments'],
    [AppointmentStatus.CANCELLED, 'cancelled', 'Cancelled appointments'],
  ])(
    'uses a grammatical collection heading for %s appointments',
    async (appointmentStatus, tableHeading, heading) => {
      renderAppointmentsTable({ appointmentStatus, tableHeading });

      await screen.findByRole('heading', { name: heading });

      expect(getByTextWithMarkup(`There are no ${heading.toLocaleLowerCase()} to display`)).toBeInTheDocument();
    },
  );

  it('labels the current-day collection as appointments scheduled today', async () => {
    renderAppointmentsTable({ tableHeading: 'todaysAppointments' });

    await screen.findByRole('heading', { name: 'Appointments scheduled today' });

    expect(getByTextWithMarkup('There are no appointments scheduled today to display')).toBeInTheDocument();
  });

  it('renders a loading state when fetching data', () => {
    renderAppointmentsTable({ isLoading: true });

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders a tabular overview of the scheduled appointments', async () => {
    renderAppointmentsTable({ appointments: mockAppointments });

    await screen.findByRole('heading', { name: /scheduled appointment/i });
    expect(screen.getByRole('search', { name: /filter table/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /download/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /date & time/i })).toBeInTheDocument();
    expect(screen.getByText('100GEJ')).toBeInTheDocument();
    expect(screen.getByText(formatDatetime(new Date(mockAppointments[0].startDateTime)))).toBeInTheDocument();
    expect(screen.getByText('HIV Clinic')).toBeInTheDocument();
    expect(screen.getByText('Outpatient')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /john wilson/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /john wilson/i })).toHaveAttribute('href', 'url-to-patient-chart');
    expect(mockUseTodaysVisits).toHaveBeenCalledWith([mockAppointments[0].patient.uuid]);
  });

  it('shows both the service and its subtype without mislabelling the service as a subtype', async () => {
    const appointmentWithSubtype = {
      ...mockAppointments[0],
      serviceType: { uuid: 'telehealth-type', name: 'Teleconsulta', duration: 30 },
    };

    renderAppointmentsTable({ appointments: [appointmentWithSubtype] });

    expect(await screen.findByRole('columnheader', { name: /date & time/i })).toBeInTheDocument();
    expect(screen.getByText(formatDatetime(new Date(appointmentWithSubtype.startDateTime)))).toBeInTheDocument();
    expect(await screen.findByRole('columnheader', { name: /service \/ type/i })).toBeInTheDocument();
    expect(screen.getByText('Outpatient — Teleconsulta')).toBeInTheDocument();
  });

  it('does not expose same-day edit actions until active visits are verified', async () => {
    mockUseTodaysVisits.mockReturnValue({
      visits: [],
      error: null,
      isLoading: true,
      mutateVisit: vi.fn(),
    });

    renderAppointmentsTable({ appointments: mockAppointments });

    await screen.findByRole('heading', { name: /scheduled appointment/i });
    expect(screen.queryByRole('button', { name: /^actions$/i })).not.toBeInTheDocument();
  });

  it('does not expose same-day edit actions when active visits cannot be verified', async () => {
    mockUseTodaysVisits.mockReturnValue({
      visits: [],
      error: new Error('Visit query failed'),
      isLoading: false,
      mutateVisit: vi.fn(),
    });

    renderAppointmentsTable({ appointments: mockAppointments });

    await screen.findByRole('heading', { name: /scheduled appointment/i });
    expect(screen.queryByRole('button', { name: /^actions$/i })).not.toBeInTheDocument();
  });

  it('updates the search string when the search input changes', async () => {
    const user = userEvent.setup();

    renderAppointmentsTable({ appointments: mockAppointments });

    await screen.findByRole('heading', { name: /scheduled appointment/i });
    const searchInput = screen.getByRole('searchbox');
    await user.type(searchInput, 'John');
    expect(searchInput).toHaveValue('John');
  });

  it('clicking the download button should download the scheduled appointments as an excel file', async () => {
    const user = userEvent.setup();

    renderAppointmentsTable({ appointments: mockAppointments });

    await screen.findByRole('heading', { name: /scheduled appointment/i });
    const downloadButton = screen.getByRole('button', { name: /download/i });
    await user.click(downloadButton);
    expect(downloadButton).toBeInTheDocument();
    expect(mockExportAppointmentsToSpreadsheet).toHaveBeenCalledWith(
      mockAppointments,
      expect.arrayContaining([
        expect.objectContaining({
          id: '7cd38a6d-377e-491b-8284-b04cf8b8c6d8',
          patientName: expect.anything(),
          identifier: '100GEJ',
        }),
      ]),
      expect.stringContaining('scheduled_appointments'),
    );
  });

  it('offers editing for an editable future appointment', () => {
    const editableAppointment = {
      ...mockAppointments[0],
      startDateTime: new Date(Date.now() + 86_400_000).toISOString(),
      status: AppointmentStatus.SCHEDULED,
    };

    renderAppointmentsTable({ appointments: [editableAppointment] });

    expect(screen.getByRole('button', { name: /actions/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /options/i })).not.toBeInTheDocument();
  });

  it.each([
    AppointmentStatus.CHECKEDIN,
    AppointmentStatus.COMPLETED,
    AppointmentStatus.CANCELLED,
    AppointmentStatus.MISSED,
  ])('does not offer editing for a future appointment in %s state', (status) => {
    const nonEditableAppointment = {
      ...mockAppointments[0],
      startDateTime: new Date(Date.now() + 86_400_000).toISOString(),
      status,
    };

    renderAppointmentsTable({ appointments: [nonEditableAppointment] });

    expect(screen.queryByRole('button', { name: /actions/i })).not.toBeInTheDocument();
  });
});

function renderAppointmentsTable(props = {}) {
  render(<AppointmentsTable {...defaultProps} {...props} />);
}
