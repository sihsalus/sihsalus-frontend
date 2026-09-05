import {
  getDefaultsFromConfigSchema,
  launchWorkspace2,
  showModal,
  useConfig,
  usePatient,
  userHasAccess,
  useSession,
} from '@openmrs/esm-framework';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useSWRConfig } from 'swr';
import { getByTextWithMarkup } from 'test-utils';

import { type ConfigObject, configSchema } from '../../config-schema';
import { appointmentsEditPrivileges, clinicalChartPrivilege } from '../../constants';
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
const mockLaunchWorkspace2 = vi.mocked(launchWorkspace2);
const mockShowModal = vi.mocked(showModal);
const mockExportAppointmentsToSpreadsheet = vi.mocked(exportAppointmentsToSpreadsheet);
const mockUseSession = vi.mocked(useSession);
const mockUsePatient = vi.mocked(usePatient);
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

vi.mock('swr', async (importOriginal) => ({
  ...(await importOriginal<typeof import('swr')>()),
  useSWRConfig: vi.fn(),
}));

const mockMutateSWR = vi.fn();
const mockUseSWRConfig = vi.mocked(useSWRConfig);

describe('AppointmentsTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSWRConfig.mockReturnValue({ mutate: mockMutateSWR } as unknown as ReturnType<typeof useSWRConfig>);
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(configSchema),
      customPatientChartUrl: 'url-to-patient-chart',
      checkInButton: { enabled: false, showIfActiveVisit: false, customUrl: null },
      checkOutButton: { enabled: false, customUrl: null },
    });
    mockUseSession.mockReturnValue({ user: { uuid: 'user-uuid' } } as ReturnType<typeof useSession>);
    mockUsePatient.mockReturnValue({
      patient: null,
      patientUuid: mockAppointments[0].patient.uuid,
      isLoading: false,
      error: null,
    });
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
  ])('uses a grammatical collection heading for %s appointments', async (appointmentStatus, tableHeading, heading) => {
    renderAppointmentsTable({ appointmentStatus, tableHeading });

    await screen.findByRole('heading', { name: heading });

    expect(getByTextWithMarkup(`There are no ${heading.toLocaleLowerCase()} to display`)).toBeInTheDocument();
  });

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
    expect(screen.getByRole('row', { name: /john wilson - .* hiv clinic outpatient/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /responsible provider/i })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Dr James Cook' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /john wilson/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /john wilson/i })).toHaveAttribute('href', 'url-to-patient-chart');
  });

  it('shows the latest appointments on the first page without mutating the source collection', () => {
    const appointments = Array.from({ length: 26 }, (_, index) => ({
      ...mockAppointments[0],
      uuid: `appointment-${index.toString().padStart(2, '0')}`,
      startDateTime: new Date(2026, 8, 3, 0, index).toISOString(),
      patient: {
        ...mockAppointments[0].patient,
        uuid: `patient-${index.toString().padStart(2, '0')}`,
        name: `Patient ${index.toString().padStart(2, '0')}`,
      },
    })) as Array<Appointment>;
    const originalOrder = appointments.map(({ uuid }) => uuid);

    renderAppointmentsTable({ appointments, appointmentStatus: AppointmentStatus.SCHEDULED });

    const patientLinks = screen.getAllByRole('link').map((link) => link.textContent);
    expect(patientLinks[0]).toBe('Patient 25');
    expect(screen.getByText('Patient 01')).toBeInTheDocument();
    expect(screen.queryByText('Patient 00')).not.toBeInTheDocument();
    expect(appointments.map(({ uuid }) => uuid)).toEqual(originalOrder);
  });

  it('marks lower-priority columns so responsive layouts can hide them', () => {
    renderAppointmentsTable({ appointments: mockAppointments });

    expect(screen.getByRole('button', { name: /Responsible provider/i })).toHaveAttribute('data-column', 'provider');
    expect(screen.getByRole('button', { name: /Appointment type/i })).toHaveAttribute('data-column', 'appointmentKind');
    expect(screen.getByRole('button', { name: /Atención/i })).toHaveAttribute('data-column', 'care');
  });

  it('renders a cancelled appointment as non-interactive red text', () => {
    const cancelledAppointment = {
      ...mockAppointments[0],
      status: AppointmentStatus.CANCELLED,
    };

    renderAppointmentsTable({ appointments: [cancelledAppointment] });

    const cancelledStatus = screen.getByText('Cancelada');
    expect(cancelledStatus.closest('.cds--tag')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancelada' })).not.toBeInTheDocument();
  });

  it('changes appointment collections without dereferencing a stale table row', () => {
    const inProgressAppointment = {
      ...mockAppointments[0],
      uuid: 'checked-in-appointment',
      status: AppointmentStatus.CHECKEDIN,
      patient: {
        ...mockAppointments[0].patient,
        uuid: 'checked-in-patient',
        name: 'Jane Doe',
      },
    };
    const { rerender } = render(
      <AppointmentsTable
        {...defaultProps}
        appointments={mockAppointments}
        appointmentStatus={AppointmentStatus.SCHEDULED}
        tableHeading="expected"
      />,
    );

    rerender(
      <AppointmentsTable
        {...defaultProps}
        appointments={[inProgressAppointment]}
        appointmentStatus={AppointmentStatus.CHECKEDIN}
        tableHeading="checkedIn"
      />,
    );

    expect(screen.getByRole('heading', { name: /appointments in progress/i })).toBeInTheDocument();
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.queryByText('John Wilson')).not.toBeInTheDocument();
  });

  it('renders the patient name without a clinical-chart link when the user cannot access the chart', () => {
    mockUserHasAccess.mockImplementation((privilege) => privilege !== clinicalChartPrivilege);

    renderAppointmentsTable({ appointments: mockAppointments, tableHeading: 'todaysAppointments' });

    expect(screen.getByText('John Wilson')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'John Wilson' })).not.toBeInTheDocument();
  });

  it('shows a dash in the document column when the patient only has a clinical-history identifier', () => {
    const appointmentWithIdentifiers = {
      ...mockAppointments[0],
      patient: {
        ...mockAppointments[0].patient,
        identifier: '10000NH',
        identifiers: [
          { identifier: '100GEJ', identifierName: 'OpenMRS ID' },
          { identifier: '10000NH', identifierName: 'N° Historia Clínica' },
        ],
      },
    };

    renderAppointmentsTable({ appointments: [appointmentWithIdentifiers], tableHeading: 'todaysAppointments' });

    expect(screen.getByRole('columnheader', { name: /document/i })).toBeInTheDocument();
    const patientRow = screen.getByRole('row', { name: /John Wilson/i });
    expect(within(patientRow).getByRole('cell', { name: '-' })).toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: '10000NH' })).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /appointment time/i })).toBeInTheDocument();
  });

  it('shows appointment modality separately from its workflow status', () => {
    renderAppointmentsTable({ appointments: mockAppointments });

    expect(screen.getByRole('columnheader', { name: /Appointment type/ })).toBeInTheDocument();
    const patientRow = screen.getByRole('row', { name: /John Wilson/i });
    expect(within(patientRow).getByRole('cell', { name: 'No programada presencial' })).toBeInTheDocument();
    expect(within(patientRow).getByText('Programada')).toBeInTheDocument();
  });

  it('shows the identity-document type and number without falling back to the clinical-history number', () => {
    const historyNumberAppointment = {
      ...mockAppointments[0],
      patient: {
        ...mockAppointments[0].patient,
        identifier: '10000NH',
        identifiers: [{ identifier: '10000NH', identifierName: 'N° Historia Clínica' }],
      },
    };
    const dniAppointment = {
      ...mockAppointments[0],
      uuid: 'appointment-with-dni',
      patient: {
        ...mockAppointments[0].patient,
        uuid: 'patient-with-dni',
        name: 'Jane Doe',
        identifier: '12345678',
        identifiers: [{ identifier: '12345678', identifierName: 'DNI' }],
      },
    };
    const foreignerAppointment = {
      ...mockAppointments[0],
      uuid: 'appointment-with-ce',
      patient: {
        ...mockAppointments[0].patient,
        uuid: 'patient-with-ce',
        name: 'María Pérez',
        identifier: 'CE-123456',
        identifiers: [{ identifier: 'CE-123456', identifierName: 'Carné de Extranjería' }],
      },
    };

    renderAppointmentsTable({
      appointments: [historyNumberAppointment, dniAppointment, foreignerAppointment],
      tableHeading: 'todaysAppointments',
    });

    expect(screen.getByRole('columnheader', { name: /document/i })).toBeInTheDocument();
    expect(
      within(screen.getByRole('row', { name: /John Wilson/i })).getByRole('cell', { name: '-' }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('row', { name: /Jane Doe/i })).getByRole('cell', {
        name: 'DNI - 12345678',
      }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('row', { name: /María Pérez/i })).getByRole('cell', { name: 'CE - CE-123456' }),
    ).toBeInTheDocument();
  });

  it('loads a typed civil document from the complete patient resource when the appointment response omits it', () => {
    mockUsePatient.mockReturnValue({
      patient: {
        id: mockAppointments[0].patient.uuid,
        resourceType: 'Patient',
        identifier: [{ type: { text: 'Pasaporte' }, value: 'PAS876543' }],
      },
      patientUuid: mockAppointments[0].patient.uuid,
      isLoading: false,
      error: null,
    });

    renderAppointmentsTable({ appointments: mockAppointments, tableHeading: 'todaysAppointments' });

    expect(screen.getByRole('cell', { name: 'Passport - PAS876543' })).toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: '-' })).not.toBeInTheDocument();
  });

  it('distinguishes a document lookup failure and lets the operator retry it', async () => {
    const user = userEvent.setup();
    mockUsePatient.mockReturnValue({
      patient: null,
      patientUuid: mockAppointments[0].patient.uuid,
      isLoading: false,
      error: new Error('Patient request failed'),
    });

    renderAppointmentsTable({ appointments: mockAppointments, tableHeading: 'todaysAppointments' });

    const retryButton = screen.getByRole('button', { name: 'Retry loading patient document' });
    expect(screen.queryByRole('cell', { name: '-' })).not.toBeInTheDocument();

    await user.click(retryButton);

    expect(mockMutateSWR).toHaveBeenCalledWith(['patient', mockAppointments[0].patient.uuid]);
  });

  it('announces that the patient document is still loading', () => {
    mockUsePatient.mockReturnValue({
      patient: null,
      patientUuid: mockAppointments[0].patient.uuid,
      isLoading: true,
      error: null,
    });

    renderAppointmentsTable({ appointments: mockAppointments, tableHeading: 'todaysAppointments' });

    expect(screen.getByRole('status')).toHaveTextContent('Loading document...');
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
      expect.any(Function),
      expect.stringMatching(/^scheduled_Appointments_\d{4}-\d{2}-\d{2}\.xlsx$/),
    );
  });

  it('offers editing for an editable future appointment', () => {
    const editableAppointment = {
      ...mockAppointments[0],
      startDateTime: new Date(Date.now() + 86_400_000).toISOString(),
      status: AppointmentStatus.SCHEDULED,
    };

    renderAppointmentsTable({ appointments: [editableAppointment] });

    expect(screen.getByRole('button', { name: /acciones para/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /options/i })).not.toBeInTheDocument();
  });

  it('marks the appointment being edited until its workspace closes', async () => {
    const user = userEvent.setup();
    const editableAppointment = {
      ...mockAppointments[0],
      startDateTime: new Date(Date.now() + 86_400_000).toISOString(),
      status: AppointmentStatus.SCHEDULED,
    };
    mockLaunchWorkspace2.mockResolvedValue(true);

    renderAppointmentsTable({ appointments: [editableAppointment] });

    const appointmentRow = screen.getByRole('row', { name: /john wilson - .* hiv clinic outpatient/i });
    await user.click(screen.getByRole('button', { name: /acciones para/i }));
    await user.click(screen.getByText(/edit appointment/i));

    expect(appointmentRow).toHaveAttribute('aria-current', 'true');
    expect(mockLaunchWorkspace2).toHaveBeenCalledWith(
      'appointments-form-workspace',
      expect.objectContaining({
        appointment: editableAppointment,
        context: 'editing',
        onWorkspaceClose: expect.any(Function),
      }),
    );

    const workspaceProps = mockLaunchWorkspace2.mock.calls.at(-1)?.[1] as { onWorkspaceClose: () => void };
    act(() => workspaceProps.onWorkspaceClose());

    expect(appointmentRow).not.toHaveAttribute('aria-current');
  });

  it('offers appointment cancellation as a red text action and opens the protected confirmation modal', async () => {
    const user = userEvent.setup();
    const dispose = vi.fn();
    const cancellableAppointment = {
      ...mockAppointments[0],
      startDateTime: new Date(Date.now() + 86_400_000).toISOString(),
      status: AppointmentStatus.SCHEDULED,
    };
    mockShowModal.mockReturnValue(dispose);

    renderAppointmentsTable({ appointments: [cancellableAppointment] });

    await user.click(screen.getByRole('button', { name: /acciones para/i }));
    const cancelAction = document.getElementById(`cancelAppointment-${cancellableAppointment.uuid}`);

    expect(cancelAction).toBeInTheDocument();
    expect(cancelAction?.closest('li')).toHaveClass('cds--overflow-menu-options__option--danger');
    expect(cancelAction?.querySelector('svg')).not.toBeInTheDocument();
    await user.click(cancelAction);

    expect(mockShowModal).toHaveBeenCalledWith('cancel-appointment-modal', {
      appointment: expect.objectContaining({ uuid: cancellableAppointment.uuid }),
      appointmentUuid: cancellableAppointment.uuid,
      closeCancelModal: expect.any(Function),
    });

    const modalProps = mockShowModal.mock.calls.at(-1)?.[1] as { closeCancelModal: () => void };
    modalProps.closeCancelModal();
    expect(dispose).toHaveBeenCalledOnce();
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

    expect(screen.queryByRole('button', { name: /acciones para/i })).not.toBeInTheDocument();
  });

  it('offers marking a past scheduled appointment as missed and opens the protected confirmation modal', async () => {
    const user = userEvent.setup();
    const dispose = vi.fn();
    const pastAppointment = {
      ...mockAppointments[0],
      startDateTime: new Date(Date.now() - 2 * 86_400_000).toISOString(),
      status: AppointmentStatus.SCHEDULED,
    };
    mockShowModal.mockReturnValue(dispose);

    renderAppointmentsTable({ appointments: [pastAppointment] });

    await user.click(screen.getByRole('button', { name: /acciones para/i }));
    const missedAction = document.getElementById(`markAsMissed-${pastAppointment.uuid}`);

    expect(missedAction).toBeInTheDocument();
    await user.click(missedAction);

    expect(mockShowModal).toHaveBeenCalledWith('missed-appointment-modal', {
      appointmentUuid: pastAppointment.uuid,
      closeModal: expect.any(Function),
    });

    const modalProps = mockShowModal.mock.calls.at(-1)?.[1] as { closeModal: () => void };
    modalProps.closeModal();
    expect(dispose).toHaveBeenCalledOnce();
  });

  it.each([
    ['same-day', new Date().toISOString()],
    ['future', new Date(Date.now() + 86_400_000).toISOString()],
  ])('does not offer marking a %s scheduled appointment as missed', async (_label, startDateTime) => {
    const user = userEvent.setup();
    const appointment = {
      ...mockAppointments[0],
      startDateTime,
      status: AppointmentStatus.SCHEDULED,
    };

    renderAppointmentsTable({ appointments: [appointment] });

    await user.click(screen.getByRole('button', { name: /acciones para/i }));

    expect(document.getElementById(`markAsMissed-${appointment.uuid}`)).not.toBeInTheDocument();
  });

  it('does not offer any action for a past checked-in appointment', () => {
    const pastCheckedInAppointment = {
      ...mockAppointments[0],
      startDateTime: new Date(Date.now() - 2 * 86_400_000).toISOString(),
      status: AppointmentStatus.CHECKEDIN,
    };

    renderAppointmentsTable({ appointments: [pastCheckedInAppointment] });

    expect(screen.queryByRole('button', { name: /acciones para/i })).not.toBeInTheDocument();
  });

  it('enables batch selection on the expected tab and launches the batch status modal', async () => {
    const user = userEvent.setup();
    const dispose = vi.fn();
    const pastAppointment = {
      ...mockAppointments[0],
      startDateTime: new Date(Date.now() - 2 * 86_400_000).toISOString(),
      status: AppointmentStatus.SCHEDULED,
    };
    mockShowModal.mockReturnValue(dispose);

    renderAppointmentsTable({
      appointments: [pastAppointment],
      appointmentStatus: AppointmentStatus.SCHEDULED,
      tableHeading: 'expected',
    });

    // select-all in the header plus one row checkbox
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /change appointments status/i })).not.toBeInTheDocument();

    await user.click(checkboxes[1]);
    await user.click(await screen.findByRole('button', { name: /change appointments status/i }));

    expect(mockShowModal).toHaveBeenCalledWith('batch-change-appointment-statuses-modal', {
      appointments: [pastAppointment],
      closeModal: expect.any(Function),
    });

    const modalProps = mockShowModal.mock.calls.at(-1)?.[1] as { closeModal: () => void };
    modalProps.closeModal();
    expect(dispose).toHaveBeenCalledOnce();
  });

  it('does not offer batch selection outside the expected tab', () => {
    const missedAppointment = {
      ...mockAppointments[0],
      startDateTime: new Date(Date.now() - 2 * 86_400_000).toISOString(),
      status: AppointmentStatus.MISSED,
    };

    renderAppointmentsTable({
      appointments: [missedAppointment],
      appointmentStatus: AppointmentStatus.MISSED,
      tableHeading: 'missed',
    });

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('hides batch selection and row actions without the edit privilege', () => {
    mockUserHasAccess.mockImplementation((privilege) => privilege !== appointmentsEditPrivileges);
    const pastAppointment = {
      ...mockAppointments[0],
      startDateTime: new Date(Date.now() - 2 * 86_400_000).toISOString(),
      status: AppointmentStatus.SCHEDULED,
    };

    renderAppointmentsTable({
      appointments: [pastAppointment],
      appointmentStatus: AppointmentStatus.SCHEDULED,
      tableHeading: 'expected',
    });

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /acciones para/i })).not.toBeInTheDocument();
  });
});

function renderAppointmentsTable(props = {}) {
  render(<AppointmentsTable {...defaultProps} {...props} />);
}
