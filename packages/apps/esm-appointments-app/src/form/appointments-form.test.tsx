import {
  type FetchResponse,
  getDefaultsFromConfigSchema,
  getUserFacingErrorMessage,
  openmrsFetch,
  showSnackbar,
  useConfig,
  useLocations,
  useSession,
  userHasAccess,
} from '@openmrs/esm-framework';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import dayjs from 'dayjs';
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
import { appointmentIssuedDateEditPrivilege, appointmentNoteMaxLength } from '../constants';
import { useProviders } from '../hooks/useProviders';
import { getAppointmentStatus } from '../patient-appointments/patient-appointments.resource';
import { type Appointment, AppointmentKind, AppointmentStatus } from '../types';

import { saveAppointment, saveRecurringAppointments } from './appointments-form.resource';
import AppointmentForm, {
  getRecurringAppointmentPeriodValidationError,
  isRecurringAppointmentHorizonAllowed,
} from './appointments-form.workspace';

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
const mockSaveRecurringAppointments = vi.mocked(saveRecurringAppointments);
const mockShowSnackbar = vi.mocked(showSnackbar);
const mockUseConfig = vi.mocked(useConfig<ConfigObject>);
const mockUseLocations = vi.mocked(useLocations);
const mockUseProviders = vi.mocked(useProviders);
const mockUseSession = vi.mocked(useSession);
const mockUserHasAccess = vi.mocked(userHasAccess);

async function fillRequiredAppointmentFields(
  user: ReturnType<typeof userEvent.setup>,
  allDay = false,
  serviceUuid = mockUseAppointmentServiceData[0].uuid,
) {
  await user.selectOptions(screen.getByRole('combobox', { name: /select a location/i }), ['Inpatient Ward']);
  await user.selectOptions(screen.getByRole('combobox', { name: /^select a service$/i }), [serviceUuid]);
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

function mockAppointmentRequests(
  services: unknown = mockUseAppointmentServiceData,
  conflictResponse: FetchResponse = { status: 204 } as FetchResponse,
) {
  mockOpenmrsFetch.mockImplementation(async (url) => {
    const requestUrl = String(url);
    if (requestUrl.includes('/appointmentService/all/full')) {
      return { status: 200, data: services } as FetchResponse;
    }
    if (requestUrl.includes('/conflicts')) {
      return conflictResponse;
    }
    return { status: 200, data: {} } as FetchResponse;
  });
}

vi.mock('./appointments-form.resource', async () => ({
  ...(await vi.importActual('./appointments-form.resource')),
  saveAppointment: vi.fn(),
  saveRecurringAppointments: vi.fn(),
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
    mockSaveRecurringAppointments.mockResolvedValue({ status: 201 } as FetchResponse<unknown>);
    mockAppointmentRequests();
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
    mockUserHasAccess.mockReturnValue(false);
    mockUseProviders.mockReturnValue({
      providers: mockProviders.data,
      isLoading: false,
      error: null,
      isValidating: false,
    });
  });

  it('caps recurring series at a one-year horizon', () => {
    const startDate = new Date('2026-07-14T09:00:00-05:00');

    expect(isRecurringAppointmentHorizonAllowed(startDate, new Date('2027-07-14T09:00:00-05:00'))).toBe(true);
    expect(isRecurringAppointmentHorizonAllowed(startDate, new Date('2027-07-15T09:00:00-05:00'))).toBe(false);
  });

  it('validates recurrence intervals only while recurrence is enabled', () => {
    expect(getRecurringAppointmentPeriodValidationError(false, null)).toBeNull();
    expect(getRecurringAppointmentPeriodValidationError(true, null)).toBe('outOfRange');
    expect(getRecurringAppointmentPeriodValidationError(true, 1.5)).toBe('notInteger');
    expect(getRecurringAppointmentPeriodValidationError(true, 366)).toBe('outOfRange');
    expect(getRecurringAppointmentPeriodValidationError(true, 1)).toBeNull();
  });

  it('shows the recurring end-date and weekday requirements before any conflict or save request', async () => {
    const user = userEvent.setup();
    mockOpenmrsFetch.mockResolvedValue({ data: mockUseAppointmentServiceData } as unknown as FetchResponse);

    renderWithSwr(<AppointmentForm {...defaultProps} />);

    await waitForLoadingToFinish();
    await fillRequiredAppointmentFields(user);
    await user.click(screen.getByLabelText(/is this a recurring appointment/i));
    await waitFor(() => expect(screen.getByLabelText(/^end date$/i)).toBeInTheDocument());
    await user.click(screen.getByRole('radio', { name: /^week$/i }));
    await user.click(screen.getByRole('button', { name: /save and close/i }));

    expect(await screen.findByText(/a recurring appointment should have an end date/i)).toBeInTheDocument();
    expect(screen.getByText(/select at least one day of the week/i)).toBeInTheDocument();
    expect(mockOpenmrsFetch.mock.calls.some(([url]) => String(url).includes('/recurring-appointments/conflicts'))).toBe(
      false,
    );
    expect(mockSaveAppointment).not.toHaveBeenCalled();
  });

  it('checks and saves a valid recurring series through the recurring API', async () => {
    const user = userEvent.setup();
    mockOpenmrsFetch.mockImplementation(async (url) => {
      const requestUrl = String(url);
      if (requestUrl.includes('/appointmentService/all/full')) {
        return { data: mockUseAppointmentServiceData } as unknown as FetchResponse;
      }
      if (requestUrl.includes('/recurring-appointments/conflicts')) {
        return { status: 204 } as FetchResponse;
      }
      return { data: {} } as FetchResponse;
    });

    renderWithSwr(<AppointmentForm {...defaultProps} />);

    await waitForLoadingToFinish();
    await fillRequiredAppointmentFields(user);
    await user.click(screen.getByLabelText(/is this a recurring appointment/i));

    const endDate = dayjs().add(7, 'day');
    const endDatePicker = await screen.findByLabelText(/^end date$/i);
    fireEvent.change(endDatePicker, { target: { value: endDate.format('YYYY-MM-DD') } });
    await user.click(screen.getByRole('button', { name: /save and close/i }));

    await waitFor(() =>
      expect(
        mockOpenmrsFetch.mock.calls.some(([url]) => String(url).includes('/recurring-appointments/conflicts')),
      ).toBe(true),
    );
    await waitFor(() => expect(mockSaveRecurringAppointments).toHaveBeenCalledTimes(1));

    const conflictRequest = mockOpenmrsFetch.mock.calls.find(([url]) =>
      String(url).includes('/recurring-appointments/conflicts'),
    );
    expect(conflictRequest?.[1]).toEqual(
      expect.objectContaining({
        body: expect.objectContaining({
          recurringPattern: expect.objectContaining({ endDate: expect.any(String), period: 1, type: 'DAY' }),
        }),
      }),
    );
    expect(mockSaveRecurringAppointments).toHaveBeenCalledWith(
      expect.objectContaining({
        recurringPattern: expect.objectContaining({ endDate: expect.any(String), period: 1, type: 'DAY' }),
      }),
      expect.any(AbortController),
    );
  });

  it('renders the appointments form', async () => {
    mockOpenmrsFetch.mockResolvedValue(mockUseAppointmentServiceData as unknown as FetchResponse);

    renderWithSwr(<AppointmentForm {...defaultProps} />);

    await waitForLoadingToFinish();

    expect(screen.getByLabelText(/select a location/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^select a service$/i)).toBeInTheDocument();
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
    await user.selectOptions(screen.getByRole('combobox', { name: /^select a service$/i }), ['svc-no-duration-uuid']);
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

  it('accepts the defensive HTTP 200 empty conflict map', async () => {
    const user = userEvent.setup();
    mockAppointmentRequests(mockUseAppointmentServiceData, { status: 200, data: {} } as FetchResponse);
    mockSaveAppointment.mockResolvedValue({ status: 201 } as FetchResponse);

    renderWithSwr(<AppointmentForm {...defaultProps} />);

    await waitForLoadingToFinish();
    await fillRequiredAppointmentFields(user);
    await user.click(screen.getByRole('button', { name: /save and close/i }));

    await waitFor(() => expect(mockSaveAppointment).toHaveBeenCalledTimes(1));
  });

  it.each([
    ['an unexpected HTTP status', { status: 202, data: {} } as FetchResponse],
    ['a missing HTTP status', { data: {} } as FetchResponse],
    ['a malformed HTTP 200 payload', { status: 200, data: null } as FetchResponse],
  ])('fails closed when the conflict endpoint returns %s', async (_label, conflictResponse) => {
    const user = userEvent.setup();
    mockAppointmentRequests(mockUseAppointmentServiceData, conflictResponse);

    renderWithSwr(<AppointmentForm {...defaultProps} />);

    await waitForLoadingToFinish();
    await fillRequiredAppointmentFields(user);
    await user.click(screen.getByRole('button', { name: /save and close/i }));

    await waitFor(() =>
      expect(mockShowSnackbar).toHaveBeenCalledWith({
        isLowContrast: false,
        kind: 'error',
        subtitle: 'No se pudieron verificar los conflictos de la cita. Intente nuevamente.',
        title: 'Error scheduling appointment',
      }),
    );
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

    mockAppointmentRequests([requestedService]);
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

    mockAppointmentRequests([waitListService]);
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

    mockAppointmentRequests([serviceWithInvalidInitialStatus]);
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

  it('uses service UUIDs so duplicate service names cannot select the wrong service', async () => {
    const user = userEvent.setup();
    const firstService = { ...mockUseAppointmentServiceData[0], uuid: 'service-a', name: 'Consulta', durationMins: 15 };
    const secondService = {
      ...mockUseAppointmentServiceData[0],
      uuid: 'service-b',
      name: 'Consulta',
      durationMins: 45,
    };
    mockAppointmentRequests([firstService, secondService]);
    mockSaveAppointment.mockResolvedValue({ status: 201 } as FetchResponse);

    renderWithSwr(<AppointmentForm {...defaultProps} />);

    await waitForLoadingToFinish();
    await fillRequiredAppointmentFields(user, false, secondService.uuid);
    expect(screen.getByRole('spinbutton', { name: /duration/i })).toHaveValue(15);
    await user.click(screen.getByRole('button', { name: /save and close/i }));

    await waitFor(() => expect(mockSaveAppointment).toHaveBeenCalledTimes(1));
    expect(mockSaveAppointment.mock.calls[0][0]).toEqual(expect.objectContaining({ serviceUuid: secondService.uuid }));
  });

  it('uses the selected service duration when the previous edited service used the 30-minute fallback', async () => {
    const user = userEvent.setup();
    const appointment = makeEditableAppointment();
    appointment.service = { ...appointment.service, durationMins: null };
    const nextService = {
      ...mockUseAppointmentServiceData[0],
      uuid: 'service-with-duration',
      name: 'Service with duration',
      durationMins: 45,
    };
    mockAppointmentRequests([appointment.service, nextService]);

    renderWithSwr(<AppointmentForm {...defaultProps} context="editing" appointment={appointment} />);

    await waitForLoadingToFinish();
    expect(screen.getByRole('spinbutton', { name: /duration/i })).toHaveValue(30);
    await user.selectOptions(screen.getByRole('combobox', { name: /^select a service$/i }), [nextService.uuid]);
    expect(screen.getByRole('spinbutton', { name: /duration/i })).toHaveValue(45);
  });

  it('uses the 30-minute fallback when an edited appointment changes to a service without duration', async () => {
    const user = userEvent.setup();
    const appointment = makeEditableAppointment();
    appointment.endDateTime = new Date(new Date(appointment.startDateTime).getTime() + 15 * 60_000).toISOString();
    const nextService = {
      ...mockUseAppointmentServiceData[0],
      uuid: 'service-without-duration',
      name: 'Service without duration',
      durationMins: null,
    };
    mockAppointmentRequests([appointment.service, nextService]);

    renderWithSwr(<AppointmentForm {...defaultProps} context="editing" appointment={appointment} />);

    await waitForLoadingToFinish();
    expect(screen.getByRole('spinbutton', { name: /duration/i })).toHaveValue(15);
    await user.selectOptions(screen.getByRole('combobox', { name: /^select a service$/i }), [nextService.uuid]);
    expect(screen.getByRole('spinbutton', { name: /duration/i })).toHaveValue(30);
  });

  it('preserves a custom duration when an edited appointment changes service', async () => {
    const user = userEvent.setup();
    const appointment = makeEditableAppointment();
    appointment.endDateTime = new Date(new Date(appointment.startDateTime).getTime() + 20 * 60_000).toISOString();
    const nextService = {
      ...mockUseAppointmentServiceData[0],
      uuid: 'different-service-duration',
      name: 'Different service duration',
      durationMins: 45,
    };
    mockAppointmentRequests([appointment.service, nextService]);

    renderWithSwr(<AppointmentForm {...defaultProps} context="editing" appointment={appointment} />);

    await waitForLoadingToFinish();
    expect(screen.getByRole('spinbutton', { name: /duration/i })).toHaveValue(20);
    await user.selectOptions(screen.getByRole('combobox', { name: /^select a service$/i }), [nextService.uuid]);
    expect(screen.getByRole('spinbutton', { name: /duration/i })).toHaveValue(20);
  });

  it('records the selected service subtype when creating an appointment', async () => {
    const user = userEvent.setup();
    const service = {
      ...mockUseAppointmentServiceData[0],
      serviceTypes: [
        { uuid: 'in-person-type', name: 'Presencial', duration: 30 },
        { uuid: 'telehealth-type', name: 'Teleconsulta', duration: 30 },
      ],
    };
    mockAppointmentRequests([service]);
    mockSaveAppointment.mockResolvedValue({ status: 201 } as FetchResponse);

    renderWithSwr(<AppointmentForm {...defaultProps} />);

    await waitForLoadingToFinish();
    await fillRequiredAppointmentFields(user, false, service.uuid);
    await user.selectOptions(screen.getByRole('combobox', { name: /^select a service type$/i }), ['telehealth-type']);
    expect(screen.getByRole('spinbutton', { name: /duration/i })).toHaveValue(15);
    await user.click(screen.getByRole('button', { name: /save and close/i }));

    await waitFor(() => expect(mockSaveAppointment).toHaveBeenCalledTimes(1));
    expect(mockSaveAppointment.mock.calls[0][0]).toEqual(
      expect.objectContaining({ serviceTypeUuid: 'telehealth-type' }),
    );
  });

  it('clears an incompatible subtype when service changes and records the replacement selected by the user', async () => {
    const user = userEvent.setup();
    const appointment = makeEditableAppointment();
    appointment.serviceType = { uuid: 'old-service-type', name: 'Tipo anterior', duration: 30 };
    const replacementService = {
      ...mockUseAppointmentServiceData[0],
      uuid: 'replacement-service',
      name: 'Replacement service',
      serviceTypes: [{ uuid: 'replacement-service-type', name: 'Tipo nuevo', duration: 45 }],
    };
    mockAppointmentRequests([mockUseAppointmentServiceData[0], replacementService]);
    mockSaveAppointment.mockResolvedValue({ status: 200 } as FetchResponse);

    renderWithSwr(<AppointmentForm {...defaultProps} context="editing" appointment={appointment} />);

    await waitForLoadingToFinish();
    await user.selectOptions(screen.getByRole('combobox', { name: /^select a service$/i }), [replacementService.uuid]);
    expect(screen.getByRole('combobox', { name: /^select a service type$/i })).toHaveValue('');
    expect(screen.getByRole('option', { name: /^no service type$/i })).toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox', { name: /^select a service type$/i }), [
      'replacement-service-type',
    ]);
    expect(screen.getByRole('spinbutton', { name: /duration/i })).toHaveValue(45);
    await user.click(screen.getByRole('button', { name: /save and close/i }));

    await waitFor(() => expect(mockSaveAppointment).toHaveBeenCalledTimes(1));
    const savedPayload = mockSaveAppointment.mock.calls[0][0];
    expect(mockSaveAppointment.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        serviceUuid: replacementService.uuid,
        serviceTypeUuid: 'replacement-service-type',
      }),
    );
    expect(
      (new Date(savedPayload.endDateTime).getTime() - new Date(savedPayload.startDateTime).getTime()) / 60_000,
    ).toBe(45);
  });

  it('preserves hidden clinical fields and every active provider when an edit is saved unchanged', async () => {
    const user = userEvent.setup();
    const appointment = makeEditableAppointment();
    appointment.appointmentKind = AppointmentKind.VIRTUAL;
    appointment.serviceType = { uuid: 'service-type-uuid', name: 'Teleconsulta', duration: 30 };
    appointment.providers = [
      {
        uuid: 'f9badd80-ab76-11e2-9e96-0800200c9a66',
        response: 'ACCEPTED',
        comments: 'Profesional principal',
      },
      { uuid: 'secondary-provider-uuid', response: 'AWAITING', comments: 'Interconsulta' },
      { uuid: 'cancelled-provider-uuid', response: 'CANCELLED', comments: 'Retirado' },
    ];
    mockSaveAppointment.mockResolvedValue({ status: 200 } as FetchResponse);

    renderWithSwr(<AppointmentForm {...defaultProps} context="editing" appointment={appointment} />);

    await waitForLoadingToFinish();
    expect(screen.getByRole('combobox', { name: /^select a service$/i })).toHaveValue(appointment.service.uuid);
    expect(screen.getByRole('combobox', { name: /select the type of appointment/i })).toHaveValue(
      AppointmentKind.VIRTUAL,
    );
    expect(screen.queryByLabelText(/is this a recurring appointment/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /save and close/i }));

    await waitFor(() => expect(mockSaveAppointment).toHaveBeenCalledTimes(1));
    expect(mockSaveAppointment.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        appointmentKind: AppointmentKind.VIRTUAL,
        serviceTypeUuid: 'service-type-uuid',
        providers: [
          {
            uuid: 'f9badd80-ab76-11e2-9e96-0800200c9a66',
            response: 'ACCEPTED',
            comments: 'Profesional principal',
          },
          { uuid: 'secondary-provider-uuid', response: 'AWAITING', comments: 'Interconsulta' },
        ],
      }),
    );
    expect(mockOpenmrsFetch).toHaveBeenCalledWith(
      expect.stringContaining('/appointments/conflicts'),
      expect.objectContaining({
        body: expect.objectContaining({
          providers: expect.not.arrayContaining([expect.objectContaining({ uuid: 'cancelled-provider-uuid' })]),
        }),
      }),
    );
  });

  it('does not silently assign the current user when an edited appointment has no active provider', async () => {
    const user = userEvent.setup();
    const appointment = makeEditableAppointment();
    appointment.providers = [{ uuid: 'cancelled-provider-uuid', response: 'CANCELLED', name: 'Retirado' }];
    mockOpenmrsFetch.mockResolvedValue({ data: mockUseAppointmentServiceData } as unknown as FetchResponse);

    renderWithSwr(<AppointmentForm {...defaultProps} context="editing" appointment={appointment} />);

    await waitForLoadingToFinish();
    expect(screen.getByRole('combobox', { name: /select a provider/i })).toHaveValue('');
    await user.click(screen.getByRole('button', { name: /save and close/i }));

    await waitFor(() => expect(screen.getByRole('combobox', { name: /select a provider/i })).toBeInvalid());
    expect(mockSaveAppointment).not.toHaveBeenCalled();
    expect(mockGetAppointmentStatus).not.toHaveBeenCalled();
  });

  it('does not treat rejected or tentative providers as an active assignment', async () => {
    const user = userEvent.setup();
    const appointment = makeEditableAppointment();
    appointment.providers = [
      { uuid: 'rejected-provider-uuid', response: 'REJECTED', name: 'Profesional rechazado' },
      { uuid: 'tentative-provider-uuid', response: 'TENTATIVE', name: 'Profesional tentativo' },
    ];
    mockOpenmrsFetch.mockResolvedValue({ data: mockUseAppointmentServiceData } as unknown as FetchResponse);

    renderWithSwr(<AppointmentForm {...defaultProps} context="editing" appointment={appointment} />);

    await waitForLoadingToFinish();
    expect(screen.getByRole('combobox', { name: /select a provider/i })).toHaveValue('');
    expect(screen.getByRole('option', { name: 'Profesional rechazado' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Profesional tentativo' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /save and close/i }));

    await waitFor(() => expect(screen.getByRole('combobox', { name: /select a provider/i })).toBeInvalid());
    expect(mockSaveAppointment).not.toHaveBeenCalled();
    expect(mockGetAppointmentStatus).not.toHaveBeenCalled();
  });

  it('promotes an explicitly selected historical provider and preserves other provider history', async () => {
    const user = userEvent.setup();
    const appointment = makeEditableAppointment();
    appointment.providers = [
      { uuid: 'rejected-provider-uuid', response: 'REJECTED', name: 'Profesional rechazado' },
      { uuid: 'tentative-provider-uuid', response: 'TENTATIVE', name: 'Profesional tentativo' },
    ];
    mockSaveAppointment.mockResolvedValue({ status: 200 } as FetchResponse);

    renderWithSwr(<AppointmentForm {...defaultProps} context="editing" appointment={appointment} />);

    await waitForLoadingToFinish();
    await user.selectOptions(screen.getByRole('combobox', { name: /select a provider/i }), ['rejected-provider-uuid']);
    await user.click(screen.getByRole('button', { name: /save and close/i }));

    await waitFor(() => expect(mockSaveAppointment).toHaveBeenCalledTimes(1));
    expect(mockSaveAppointment.mock.calls[0][0].providers).toEqual([
      { uuid: 'tentative-provider-uuid', response: 'TENTATIVE', name: 'Profesional tentativo' },
      { uuid: 'rejected-provider-uuid', response: 'ACCEPTED', name: 'Profesional rechazado' },
    ]);
  });

  it('keeps an active provider selectable when it is no longer returned by the provider catalogue', async () => {
    const appointment = makeEditableAppointment();
    appointment.providers = [{ uuid: 'retired-provider-uuid', response: 'ACCEPTED', name: 'Profesional histórico' }];
    mockOpenmrsFetch.mockResolvedValue({ data: mockUseAppointmentServiceData } as unknown as FetchResponse);

    renderWithSwr(<AppointmentForm {...defaultProps} context="editing" appointment={appointment} />);

    await waitForLoadingToFinish();
    expect(screen.getByRole('option', { name: 'Profesional histórico' })).toHaveValue('retired-provider-uuid');
    expect(screen.getByRole('combobox', { name: /select a provider/i })).toHaveValue('retired-provider-uuid');
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
      .mockResolvedValueOnce({ status: 200, data: {} } as unknown as FetchResponse);
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

  it('keeps the appointment issue date read-only without the special privilege', async () => {
    mockOpenmrsFetch.mockResolvedValue(mockUseAppointmentServiceData as unknown as FetchResponse);

    renderWithSwr(<AppointmentForm {...defaultProps} />);

    await waitForLoadingToFinish();

    expect(mockUserHasAccess).toHaveBeenCalledWith(appointmentIssuedDateEditPrivilege, mockSession.data.user);
    expect(screen.getByTestId('dateAppointmentScheduledPickerInput')).toHaveAttribute('readonly');
  });

  it('allows editing the appointment issue date with the special privilege', async () => {
    mockUserHasAccess.mockReturnValue(true);
    mockOpenmrsFetch.mockResolvedValue(mockUseAppointmentServiceData as unknown as FetchResponse);

    renderWithSwr(<AppointmentForm {...defaultProps} />);

    await waitForLoadingToFinish();

    expect(screen.getByTestId('dateAppointmentScheduledPickerInput')).not.toHaveAttribute('readonly');
  });

  it('keeps the appointment issue date read-only while the session is unavailable', async () => {
    mockUseSession.mockReturnValue(undefined as ReturnType<typeof useSession>);
    mockUserHasAccess.mockImplementation((_privilege, user) => Boolean(user));

    renderWithSwr(<AppointmentForm {...defaultProps} />);

    await waitForLoadingToFinish();

    expect(mockUserHasAccess).toHaveBeenCalledWith(appointmentIssuedDateEditPrivilege, undefined);
    expect(screen.getByTestId('dateAppointmentScheduledPickerInput')).toHaveAttribute('readonly');
  });

  it('persists an authorized appointment issue date change', async () => {
    const user = userEvent.setup();
    const appointment = makeEditableAppointment();
    appointment.dateAppointmentScheduled = '2026-07-01T09:00:00-05:00';
    mockUserHasAccess.mockReturnValue(true);
    mockSaveAppointment.mockResolvedValue({ status: 200 } as FetchResponse);

    renderWithSwr(<AppointmentForm {...defaultProps} context="editing" appointment={appointment} />);

    await waitForLoadingToFinish();
    fireEvent.change(screen.getByTestId('dateAppointmentScheduledPickerInput'), {
      target: { value: '2026-07-02' },
    });
    await user.click(screen.getByRole('button', { name: /save and close/i }));

    await waitFor(() => expect(mockSaveAppointment).toHaveBeenCalledTimes(1));
    expect(dayjs(mockSaveAppointment.mock.calls[0][0].dateAppointmentScheduled).format('YYYY-MM-DD')).toBe(
      '2026-07-02',
    );
  });

  it('does not save an existing appointment whose original issue date cannot be preserved', async () => {
    const user = userEvent.setup();
    const appointment = makeEditableAppointment();
    appointment.dateAppointmentScheduled = undefined as unknown as string;

    renderWithSwr(<AppointmentForm {...defaultProps} context="editing" appointment={appointment} />);

    await waitForLoadingToFinish();
    await user.click(screen.getByRole('button', { name: /save and close/i }));

    expect(await screen.findByText(/a valid appointment issue date is required/i)).toBeInTheDocument();
    expect(mockGetAppointmentStatus).not.toHaveBeenCalled();
    expect(mockSaveAppointment).not.toHaveBeenCalled();
  });

  it('keeps the trusted creation issue date stable across midnight and rerenders', async () => {
    const user = userEvent.setup();
    mockSaveAppointment.mockResolvedValue({ status: 201 } as FetchResponse);

    renderWithSwr(<AppointmentForm {...defaultProps} />);

    await waitForLoadingToFinish();
    await fillRequiredAppointmentFields(user);
    const issueDateInput = screen.getByTestId('dateAppointmentScheduledPickerInput');
    const trustedIssueDate = issueDateInput.getAttribute('value');

    vi.useFakeTimers();
    try {
      await act(async () => {
        vi.setSystemTime(dayjs().add(2, 'day').startOf('day').add(1, 'hour').toDate());
        fireEvent.change(screen.getByLabelText(/write an additional note/i), {
          target: { value: 'Forzar una nueva renderización' },
        });
        fireEvent.click(screen.getByRole('button', { name: /save and close/i }));
        await vi.runAllTimersAsync();
      });
    } finally {
      vi.useRealTimers();
    }

    await waitFor(() => expect(mockSaveAppointment).toHaveBeenCalledTimes(1));
    expect(dayjs(mockSaveAppointment.mock.calls[0][0].dateAppointmentScheduled).format('DD/MM/YYYY')).toBe(
      trustedIssueDate,
    );
  });

  it('preserves the original issue date when a read-only form value is tampered with', async () => {
    const user = userEvent.setup();
    const appointment = makeEditableAppointment();
    appointment.dateAppointmentScheduled = '2026-07-01T09:00:00-05:00';
    mockSaveAppointment.mockResolvedValue({ status: 200 } as FetchResponse);

    renderWithSwr(<AppointmentForm {...defaultProps} context="editing" appointment={appointment} />);

    await waitForLoadingToFinish();
    fireEvent.change(screen.getByTestId('dateAppointmentScheduledPickerInput'), {
      target: { value: '01/06/2026' },
    });
    await user.click(screen.getByRole('button', { name: /save and close/i }));

    await waitFor(() => expect(mockSaveAppointment).toHaveBeenCalledTimes(1));
    expect(new Date(mockSaveAppointment.mock.calls[0][0].dateAppointmentScheduled).toISOString()).toBe(
      new Date(appointment.dateAppointmentScheduled).toISOString(),
    );
  });
});
