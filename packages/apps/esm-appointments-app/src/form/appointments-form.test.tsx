import {
  type FetchResponse,
  getDefaultsFromConfigSchema,
  getUserFacingErrorMessage,
  openmrsFetch,
  showSnackbar,
  useConfig,
  useLocations,
  useSession,
} from '@openmrs/esm-framework';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  mockLocations,
  mockPatient,
  mockProviders,
  mockSession,
  mockUseAppointmentServiceData,
  renderWithSwr,
  waitForLoadingToFinish,
} from 'test-utils';

import { type ConfigObject, configSchema } from '../config-schema';
import { appointmentNoteMaxLength } from '../constants';
import { useProviders } from '../hooks/useProviders';
import { getAppointmentStatus } from '../patient-appointments/patient-appointments.resource';
import { type Appointment, AppointmentKind, AppointmentStatus } from '../types';

import { saveAppointment } from './appointments-form.resource';
import AppointmentForm from './appointments-form.workspace';

const defaultProps = {
  context: 'creating',
  closeWorkspace: vi.fn(),
  patientUuid: mockPatient.id,
  promptBeforeClosing: vi.fn(),
  closeWorkspaceWithSavedChanges: vi.fn(),
  setTitle: vi.fn(),
};

const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const mockGetAppointmentStatus = vi.mocked(getAppointmentStatus);
const mockGetUserFacingErrorMessage = vi.mocked(getUserFacingErrorMessage);
const mockSaveAppointment = vi.mocked(saveAppointment);
const mockShowSnackbar = vi.mocked(showSnackbar);
const mockUseConfig = vi.mocked(useConfig<ConfigObject>);
const mockUseLocations = vi.mocked(useLocations);
const mockUseProviders = vi.mocked(useProviders);
const mockUseSession = vi.mocked(useSession);

async function fillRequiredAppointmentFields(user: ReturnType<typeof userEvent.setup>, allDay = false) {
  await user.selectOptions(screen.getByRole('combobox', { name: /select a location/i }), ['Inpatient Ward']);
  await user.selectOptions(screen.getByRole('combobox', { name: /select a service/i }), ['Outpatient']);
  await user.selectOptions(screen.getByRole('combobox', { name: /select the type of appointment/i }), ['Scheduled']);
  await user.selectOptions(screen.getByRole('combobox', { name: /select a provider/i }), ['doctor - James Cook']);

  if (allDay) {
    await user.click(screen.getByLabelText(/all day/i));
    return;
  }

  const durationInput = screen.getByRole('spinbutton', { name: /duration/i });
  await user.clear(durationInput);
  await user.type(durationInput, '15');

  await user.type(screen.getByRole('textbox', { name: /time/i }), '09:30');
  await user.tab();
  await user.selectOptions(screen.getByRole('combobox', { name: /time/i }), 'AM');
}

function makeEditableAppointment(): Appointment {
  return {
    uuid: 'appointment-uuid',
    appointmentNumber: '0000',
    patient: {
      identifier: '100GEJ',
      identifiers: [],
      name: 'John Wilson',
      uuid: mockPatient.id,
    },
    service: {
      appointmentServiceId: 1,
      creatorName: '',
      description: '',
      durationMins: 15,
      endTime: '',
      initialAppointmentStatus: AppointmentStatus.SCHEDULED,
      location: { uuid: 'service-location-uuid' },
      maxAppointmentsLimit: null,
      name: 'Outpatient',
      startTime: '',
      uuid: 'e2ec9cf0-ec38-4d2b-af6c-59c82fa30b90',
    },
    provider: { uuid: 'f9badd80-ab76-11e2-9e96-0800200c9a66' },
    providers: [{ uuid: 'f9badd80-ab76-11e2-9e96-0800200c9a66', response: 'ACCEPTED' }],
    location: { name: 'Inpatient Ward', uuid: 'b1a8b05e-3542-4037-bbd3-998ee9c40574' },
    startDateTime: new Date(Date.now() + 86_400_000).toISOString(),
    endDateTime: new Date(Date.now() + 86_400_000 + 30 * 60_000).toISOString(),
    dateAppointmentScheduled: new Date().toISOString(),
    appointmentKind: AppointmentKind.SCHEDULED,
    status: AppointmentStatus.SCHEDULED,
    comments: 'Existing appointment',
    recurring: false,
    voided: false,
    extensions: {},
    teleconsultationLink: null,
  };
}

vi.mock('./appointments-form.resource', async () => ({
  ...(await vi.importActual('./appointments-form.resource')),
  saveAppointment: vi.fn(),
}));

vi.mock('../hooks/useProviders', async () => ({
  ...(await vi.importActual('../hooks/useProviders')),
  useProviders: vi.fn(),
}));

vi.mock('../patient-appointments/patient-appointments.resource', async () => ({
  ...(await vi.importActual('../patient-appointments/patient-appointments.resource')),
  getAppointmentStatus: vi.fn(),
}));

vi.mock('../workload/workload.resource', async () => ({
  ...(await vi.importActual('../workload/workload.resource')),
  getMonthlyCalendarDistribution: vi.fn(),
  useAppointmentSummary: vi.fn(),
  useCalendarDistribution: vi.fn(),
  useMonthlyCalendarDistribution: vi.fn().mockReturnValue([]),
  useMonthlyAppointmentSummary: vi.fn().mockReturnValue([]),
}));

describe('AppointmentForm', () => {
  const dateTimeRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3}Z|[+-]\d{2}:\d{2})$/;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSaveAppointment.mockResolvedValue({} as FetchResponse<unknown>);
    mockOpenmrsFetch.mockResolvedValue({ data: {} } as FetchResponse<unknown>);
    mockGetAppointmentStatus.mockResolvedValue(AppointmentStatus.SCHEDULED);
    mockGetUserFacingErrorMessage.mockImplementation((error, fallback, options) => {
      const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
      return code != null ? (options.codeMessages?.[code as string] ?? fallback) : fallback;
    });
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(configSchema),
      appointmentTypes: ['Scheduled', 'WalkIn'],
    });
    mockUseLocations.mockReturnValue(mockLocations.data.results);
    mockUseSession.mockReturnValue(mockSession.data);
    mockUseProviders.mockReturnValue({
      providers: mockProviders.data,
      isLoading: false,
      error: null,
      isValidating: false,
    });
  });

  it('renders the appointments form', async () => {
    mockOpenmrsFetch.mockResolvedValue(mockUseAppointmentServiceData as unknown as FetchResponse);

    renderWithSwr(<AppointmentForm {...defaultProps} />);

    await waitForLoadingToFinish();

    expect(screen.getByLabelText(/select a location/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/select a service/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/select the type of appointment/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/write an additional note/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/write any additional points here/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/write an additional note/i)).toHaveAttribute(
      'maxlength',
      appointmentNoteMaxLength.toString(),
    );
    expect(screen.getByText(`0/${appointmentNoteMaxLength}`)).toBeInTheDocument();
    expect(screen.getAllByDisplayValue(/\d{2}\/\d{2}\/\d{4}/).length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/date appointment issued/i)).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /mosoriot/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /inpatient ward/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/date appointment issued/i)).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /^am$/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /^pm$/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /choose appointment type/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /scheduled/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /walkin/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/date appointment issued/i)).toBeInTheDocument();

    expect(screen.getByRole('textbox', { name: /time/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /discard/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save and close/i })).toBeInTheDocument();
  });

  it('hides all-day scheduling while keeping time and duration', async () => {
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(configSchema),
      allowAllDayAppointments: false,
      appointmentTypes: ['Scheduled', 'WalkIn'],
    });
    mockOpenmrsFetch.mockResolvedValue(mockUseAppointmentServiceData as unknown as FetchResponse);

    renderWithSwr(<AppointmentForm {...defaultProps} />);

    await waitForLoadingToFinish();

    expect(screen.queryByLabelText(/all day/i)).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /time/i })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: /duration/i })).toBeInTheDocument();
  });

  it('defaults the duration to 30 minutes for a new appointment, even after picking a service without durationMins', async () => {
    const user = userEvent.setup();

    // MINSA services come back without a durationMins, so the fallback must hold.
    const servicesWithoutDuration = [
      { uuid: 'svc-no-duration-uuid', name: 'Atención ambulatoria por enfermera(o)', durationMins: null },
    ];
    mockOpenmrsFetch.mockResolvedValue({ data: servicesWithoutDuration } as unknown as FetchResponse);

    renderWithSwr(<AppointmentForm {...defaultProps} />);

    await waitForLoadingToFinish();

    const durationInput = screen.getByRole('spinbutton', { name: /duration/i });
    expect(durationInput).toHaveValue(30);

    // Picking a service whose durationMins is null keeps the 30-minute fallback.
    await user.selectOptions(screen.getByRole('combobox', { name: /select a service/i }), [
      'Atención ambulatoria por enfermera(o)',
    ]);
    expect(durationInput).toHaveValue(30);
  });

  it('prevents scientific notation, signs, and decimals in appointment duration', async () => {
    mockOpenmrsFetch.mockResolvedValue({ data: mockUseAppointmentServiceData } as unknown as FetchResponse);

    renderWithSwr(<AppointmentForm {...defaultProps} />);

    await waitForLoadingToFinish();

    const durationInput = screen.getByRole('spinbutton', { name: /duration/i });
    for (const key of ['e', 'E', '+', '-', '.', ',']) {
      expect(fireEvent.keyDown(durationInput, { key })).toBe(false);
    }
    expect(
      fireEvent.paste(durationInput, {
        clipboardData: { getData: () => '1e2' },
      }),
    ).toBe(false);
  });

  it('closes the workspace when the cancel button is clicked', async () => {
    const user = userEvent.setup();

    mockOpenmrsFetch.mockResolvedValueOnce(mockUseAppointmentServiceData as unknown as FetchResponse);

    renderWithSwr(<AppointmentForm {...defaultProps} />);

    await waitForLoadingToFinish();

    const cancelButton = screen.getByRole('button', { name: /Discard/i });
    await user.click(cancelButton);

    expect(defaultProps.closeWorkspace).toHaveBeenCalledTimes(1);
  });

  it('renders a success snackbar upon successfully scheduling an appointment', async () => {
    const user = userEvent.setup();

    mockOpenmrsFetch.mockResolvedValue({
      data: mockUseAppointmentServiceData,
    } as unknown as FetchResponse);
    mockSaveAppointment.mockResolvedValue({
      status: 201,
      statusText: 'Created',
    } as FetchResponse);

    renderWithSwr(<AppointmentForm {...defaultProps} />);

    await waitForLoadingToFinish();

    const saveButton = screen.getByRole('button', { name: /save and close/i });

    await fillRequiredAppointmentFields(user);
    await user.click(saveButton);

    expect(mockSaveAppointment).toHaveBeenCalledTimes(1);
    expect(mockSaveAppointment).toHaveBeenCalledWith(
      expect.objectContaining({
        appointmentKind: 'Scheduled',
        comments: '',
        dateAppointmentScheduled: expect.stringMatching(dateTimeRegex),
        endDateTime: expect.stringMatching(dateTimeRegex),
        locationUuid: 'b1a8b05e-3542-4037-bbd3-998ee9c40574',
        patientUuid: mockPatient.id,
        providers: [{ uuid: 'f9badd80-ab76-11e2-9e96-0800200c9a66' }],
        serviceUuid: 'e2ec9cf0-ec38-4d2b-af6c-59c82fa30b90',
        startDateTime: expect.stringMatching(dateTimeRegex),
        status: AppointmentStatus.SCHEDULED,
        uuid: undefined,
      }),
      expect.anything(),
    );

    expect(mockShowSnackbar).toHaveBeenCalledTimes(1);
    expect(mockShowSnackbar).toHaveBeenCalledWith({
      kind: 'success',
      isLowContrast: true,
      subtitle: 'It is now visible on the Appointments page',
      title: 'Appointment scheduled',
    });
    await waitFor(() => {
      expect(defaultProps.closeWorkspace).toHaveBeenCalledWith({ discardUnsavedChanges: true });
    });
  });

  it('schedules an all-day appointment using the full selected day', async () => {
    const user = userEvent.setup();

    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(configSchema),
      allowAllDayAppointments: true,
      appointmentTypes: ['Scheduled', 'WalkIn'],
    });
    mockOpenmrsFetch.mockResolvedValue({
      data: mockUseAppointmentServiceData,
    } as unknown as FetchResponse);
    mockSaveAppointment.mockResolvedValue({
      status: 201,
      statusText: 'Created',
    } as FetchResponse);

    renderWithSwr(<AppointmentForm {...defaultProps} />);

    await waitForLoadingToFinish();
    await fillRequiredAppointmentFields(user, true);
    await user.click(screen.getByRole('button', { name: /save and close/i }));

    await waitFor(() => expect(mockSaveAppointment).toHaveBeenCalledTimes(1));
    const payload = mockSaveAppointment.mock.calls[0][0];
    expect(payload.startDateTime).toMatch(/T00:00:00/);
    expect(payload.endDateTime).toMatch(/T23:59:59/);
  });

  it('shows an error and does not save if conflict validation fails', async () => {
    const user = userEvent.setup();

    mockOpenmrsFetch.mockResolvedValue({
      data: mockUseAppointmentServiceData,
    } as unknown as FetchResponse);

    renderWithSwr(<AppointmentForm {...defaultProps} />);

    await waitForLoadingToFinish();
    await fillRequiredAppointmentFields(user);

    const conflictError = new Error('Conflict validation unavailable');
    mockOpenmrsFetch.mockRejectedValueOnce(conflictError);
    await user.click(screen.getByRole('button', { name: /save and close/i }));

    await waitFor(() => {
      expect(mockShowSnackbar).toHaveBeenCalledWith({
        isLowContrast: false,
        kind: 'error',
        subtitle: 'No se pudieron verificar los conflictos de la cita. Intente nuevamente.',
        title: 'Error scheduling appointment',
      });
    });
    expect(mockSaveAppointment).not.toHaveBeenCalled();
  });

  it('renders an error snackbar if there was a problem scheduling an appointment', async () => {
    const user = userEvent.setup();

    const error = {
      message: 'Internal Server Error',
      response: {
        status: 500,
        statusText: 'Internal Server Error',
      },
    };

    mockOpenmrsFetch.mockResolvedValue({
      data: mockUseAppointmentServiceData,
    } as unknown as FetchResponse);
    mockSaveAppointment.mockRejectedValue(error);

    renderWithSwr(<AppointmentForm {...defaultProps} />);

    await waitForLoadingToFinish();

    const saveButton = screen.getByRole('button', { name: /save and close/i });

    await fillRequiredAppointmentFields(user);
    await user.click(saveButton);

    expect(mockSaveAppointment).toHaveBeenCalledTimes(1);
    expect(mockSaveAppointment).toHaveBeenCalledWith(
      expect.objectContaining({
        appointmentKind: 'Scheduled',
        comments: '',
        dateAppointmentScheduled: expect.stringMatching(dateTimeRegex),
        endDateTime: expect.stringMatching(dateTimeRegex),
        locationUuid: 'b1a8b05e-3542-4037-bbd3-998ee9c40574',
        patientUuid: mockPatient.id,
        providers: [{ uuid: 'f9badd80-ab76-11e2-9e96-0800200c9a66' }],
        serviceUuid: 'e2ec9cf0-ec38-4d2b-af6c-59c82fa30b90',
        startDateTime: expect.stringMatching(dateTimeRegex),
        status: AppointmentStatus.SCHEDULED,
        uuid: undefined,
      }),
      expect.anything(),
    );

    expect(mockShowSnackbar).toHaveBeenCalledTimes(1);
    expect(mockShowSnackbar).toHaveBeenCalledWith({
      isLowContrast: false,
      kind: 'error',
      subtitle: 'No se pudo guardar la cita. Revise los datos e intente nuevamente.',
      title: 'Error scheduling appointment',
    });
  });

  it('uses the selected service initial status when creating an appointment', async () => {
    const user = userEvent.setup();
    const requestedService = {
      ...mockUseAppointmentServiceData[0],
      initialAppointmentStatus: AppointmentStatus.REQUESTED,
    };

    mockOpenmrsFetch.mockResolvedValue({ data: [requestedService] } as unknown as FetchResponse);
    mockSaveAppointment.mockResolvedValue({ status: 201 } as FetchResponse);

    renderWithSwr(<AppointmentForm {...defaultProps} />);

    await waitForLoadingToFinish();
    await fillRequiredAppointmentFields(user);
    await user.click(screen.getByRole('button', { name: /save and close/i }));

    await waitFor(() => expect(mockSaveAppointment).toHaveBeenCalledTimes(1));
    expect(mockSaveAppointment.mock.calls[0][0]).toEqual(
      expect.objectContaining({ status: AppointmentStatus.REQUESTED }),
    );
  });

  it('preserves WaitList when the selected service configures it as the initial status', async () => {
    const user = userEvent.setup();
    const waitListService = {
      ...mockUseAppointmentServiceData[0],
      initialAppointmentStatus: AppointmentStatus.WAITLIST,
    };

    mockOpenmrsFetch.mockResolvedValue({ data: [waitListService] } as unknown as FetchResponse);
    mockSaveAppointment.mockResolvedValue({ status: 201 } as FetchResponse);

    renderWithSwr(<AppointmentForm {...defaultProps} />);

    await waitForLoadingToFinish();
    await fillRequiredAppointmentFields(user);
    await user.click(screen.getByRole('button', { name: /save and close/i }));

    await waitFor(() => expect(mockSaveAppointment).toHaveBeenCalledTimes(1));
    expect(mockSaveAppointment.mock.calls[0][0]).toEqual(
      expect.objectContaining({ status: AppointmentStatus.WAITLIST }),
    );
  });

  it('does not allow a workflow status as the initial status of a new appointment', async () => {
    const user = userEvent.setup();
    const serviceWithInvalidInitialStatus = {
      ...mockUseAppointmentServiceData[0],
      initialAppointmentStatus: AppointmentStatus.COMPLETED,
    };

    mockOpenmrsFetch.mockResolvedValue({ data: [serviceWithInvalidInitialStatus] } as unknown as FetchResponse);
    mockSaveAppointment.mockResolvedValue({ status: 201 } as FetchResponse);

    renderWithSwr(<AppointmentForm {...defaultProps} />);

    await waitForLoadingToFinish();
    await fillRequiredAppointmentFields(user);
    await user.click(screen.getByRole('button', { name: /save and close/i }));

    await waitFor(() => expect(mockSaveAppointment).toHaveBeenCalledTimes(1));
    expect(mockSaveAppointment.mock.calls[0][0]).toEqual(
      expect.objectContaining({ status: AppointmentStatus.SCHEDULED }),
    );
  });

  it('does not expose or submit appointment status when editing', async () => {
    const user = userEvent.setup();
    const appointment = makeEditableAppointment();

    mockOpenmrsFetch.mockResolvedValue({ data: mockUseAppointmentServiceData } as unknown as FetchResponse);
    mockSaveAppointment.mockResolvedValue({ status: 200 } as FetchResponse);

    renderWithSwr(<AppointmentForm {...defaultProps} context="editing" appointment={appointment} />);

    await waitForLoadingToFinish();
    expect(screen.queryByLabelText(/select status/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/appointment status/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /save and close/i }));

    await waitFor(() => expect(mockSaveAppointment).toHaveBeenCalledTimes(1));
    expect(mockGetAppointmentStatus).toHaveBeenCalledWith(appointment.uuid);
    expect(mockOpenmrsFetch).toHaveBeenCalledWith(
      expect.stringContaining('/appointments/conflicts'),
      expect.objectContaining({ body: expect.objectContaining({ uuid: appointment.uuid }) }),
    );
    expect(mockSaveAppointment.mock.calls[0][0]).not.toHaveProperty('status');
    expect(mockSaveAppointment.mock.calls[0][0]).toEqual(expect.objectContaining({ uuid: appointment.uuid }));
  });

  it('blocks editing when another appointment causes a patient double-booking conflict', async () => {
    const user = userEvent.setup();
    const appointment = makeEditableAppointment();
    mockOpenmrsFetch
      .mockResolvedValueOnce({ data: mockUseAppointmentServiceData } as unknown as FetchResponse)
      .mockResolvedValueOnce({
        status: 200,
        data: { PATIENT_DOUBLE_BOOKING: true },
      } as unknown as FetchResponse);

    renderWithSwr(<AppointmentForm {...defaultProps} context="editing" appointment={appointment} />);

    await waitForLoadingToFinish();
    await user.click(screen.getByRole('button', { name: /save and close/i }));

    await waitFor(() =>
      expect(mockShowSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'error',
          title: 'Patient already booked for an appointment at this time',
        }),
      ),
    );
    expect(mockSaveAppointment).not.toHaveBeenCalled();
  });

  it('blocks editing when the fresh appointment status is no longer editable', async () => {
    const user = userEvent.setup();
    const appointment = makeEditableAppointment();
    mockOpenmrsFetch.mockResolvedValue({ data: mockUseAppointmentServiceData } as unknown as FetchResponse);
    mockGetAppointmentStatus.mockResolvedValue(AppointmentStatus.CHECKEDIN);

    renderWithSwr(<AppointmentForm {...defaultProps} context="editing" appointment={appointment} />);

    await waitForLoadingToFinish();
    await user.click(screen.getByRole('button', { name: /save and close/i }));

    await waitFor(() =>
      expect(mockShowSnackbar).toHaveBeenCalledWith({
        isLowContrast: false,
        kind: 'error',
        subtitle: 'El estado de la cita cambió y ya no permite editarla. Actualice la lista.',
        title: 'Error editing appointment',
      }),
    );
    expect(mockGetAppointmentStatus).toHaveBeenCalledWith(appointment.uuid);
    expect(mockOpenmrsFetch).not.toHaveBeenCalledWith(
      expect.stringContaining('/appointments/conflicts'),
      expect.anything(),
    );
    expect(mockSaveAppointment).not.toHaveBeenCalled();
  });

  it('blocks an edit when check-in happens after conflict validation but before persistence', async () => {
    const user = userEvent.setup();
    const appointment = makeEditableAppointment();
    mockOpenmrsFetch
      .mockResolvedValueOnce({ data: mockUseAppointmentServiceData } as unknown as FetchResponse)
      .mockResolvedValueOnce({ status: 200, data: null } as unknown as FetchResponse);
    mockGetAppointmentStatus
      .mockResolvedValueOnce(AppointmentStatus.SCHEDULED)
      .mockResolvedValueOnce(AppointmentStatus.CHECKEDIN);

    renderWithSwr(<AppointmentForm {...defaultProps} context="editing" appointment={appointment} />);

    await waitForLoadingToFinish();
    await user.click(screen.getByRole('button', { name: /save and close/i }));

    await waitFor(() => expect(mockGetAppointmentStatus).toHaveBeenCalledTimes(2));
    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'error',
        subtitle: 'El estado de la cita cambió y ya no permite editarla. Actualice la lista.',
      }),
    );
    expect(mockSaveAppointment).not.toHaveBeenCalled();
  });

  it('fails closed without exposing technical details when the fresh status check fails', async () => {
    const user = userEvent.setup();
    const appointment = makeEditableAppointment();
    mockOpenmrsFetch.mockResolvedValue({ data: mockUseAppointmentServiceData } as unknown as FetchResponse);
    mockGetAppointmentStatus.mockRejectedValue(new Error('SQL connection refused at db.internal'));

    renderWithSwr(<AppointmentForm {...defaultProps} context="editing" appointment={appointment} />);

    await waitForLoadingToFinish();
    await user.click(screen.getByRole('button', { name: /save and close/i }));

    await waitFor(() =>
      expect(mockShowSnackbar).toHaveBeenCalledWith({
        isLowContrast: false,
        kind: 'error',
        subtitle: 'No se pudo verificar el estado actual de la cita. Intente nuevamente.',
        title: 'Error editing appointment',
      }),
    );
    expect(mockSaveAppointment).not.toHaveBeenCalled();
  });
});
