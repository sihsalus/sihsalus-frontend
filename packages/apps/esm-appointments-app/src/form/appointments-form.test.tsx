import {
  type FetchResponse,
  getDefaultsFromConfigSchema,
  getUserFacingErrorMessage,
  openmrsFetch,
  showSnackbar,
  useConfig,
  useLocations,
  usePatient,
  userHasAccess,
  useSession,
} from '@openmrs/esm-framework';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import dayjs from 'dayjs';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
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
import {
  appointmentIssuedDateEditPrivilege,
  appointmentNoteMaxLength,
  appointmentStartDateEditPrivilege,
} from '../constants';
import { useProviders } from '../hooks/useProviders';
import { getAppointmentStatus } from '../patient-appointments/patient-appointments.resource';
import { type Appointment, AppointmentKind, type AppointmentPayload, AppointmentStatus } from '../types';

import { getAppointmentCreationCheckpointStorageKey } from './appointment-creation-checkpoint';
import { saveAppointment, saveRecurringAppointments } from './appointments-form.resource';
import AppointmentForm, {
  getRecurringAppointmentPeriodValidationError,
  isRecurringAppointmentHorizonAllowed,
  TimeAndDuration,
} from './appointments-form.workspace';

function TimeAndDurationValidationHarness() {
  const { control, setError } = useForm({
    defaultValues: { startTime: '09:30', timeFormat: 'AM', duration: 30 },
  });

  useEffect(() => {
    setError('startTime', { message: 'Invalid time' });
    setError('duration', { message: 'Duration should be greater than zero' });
  }, [setError]);

  return <TimeAndDuration control={control} t={(_key, fallback) => fallback} />;
}

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
const mockUsePatient = vi.mocked(usePatient);
const mockUseProviders = vi.mocked(useProviders);
const mockUseSession = vi.mocked(useSession);
const mockUserHasAccess = vi.mocked(userHasAccess);
const appointmentCheckpointStorageKey = getAppointmentCreationCheckpointStorageKey(mockPatient.id);

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

function confirmedAppointmentResponse(
  payload: AppointmentPayload,
  status = 200,
  uuid = payload.uuid ?? 'created-uuid',
) {
  return {
    status,
    data: {
      uuid,
      patient: { uuid: payload.patientUuid },
      service: { uuid: payload.serviceUuid },
      serviceType: payload.serviceTypeUuid ? { uuid: payload.serviceTypeUuid } : null,
      location: { uuid: payload.locationUuid },
      startDateTime: payload.startDateTime,
      endDateTime: payload.endDateTime,
      dateAppointmentScheduled: payload.dateAppointmentScheduled,
      appointmentKind: payload.appointmentKind,
      comments: payload.comments,
      status: payload.status,
      providers: (payload.providers ?? []).map((provider) => ({
        response: provider.response ?? 'ACCEPTED',
        uuid: provider.uuid,
      })),
    },
  } as FetchResponse<unknown>;
}

function mockConfirmedAppointmentSave(status = 200) {
  mockSaveAppointment.mockImplementation(async (payload) => confirmedAppointmentResponse(payload, status));
}

function mockConfirmedRecurringSave(status = 200) {
  mockSaveRecurringAppointments.mockImplementation(
    async (payload) =>
      ({
        status,
        data: [
          {
            appointmentDefaultResponse: confirmedAppointmentResponse(payload.appointmentRequest).data,
            recurringPattern: payload.recurringPattern,
          },
        ],
      }) as unknown as FetchResponse,
  );
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
    globalThis.sessionStorage.clear();
    mockConfirmedAppointmentSave();
    mockConfirmedRecurringSave();
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
    mockUsePatient.mockReturnValue({
      patient: { resourceType: 'Patient', id: mockPatient.id },
      patientUuid: mockPatient.id,
      error: null,
      isLoading: false,
    });
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
    expect(screen.getAllByText(/select at least one day of the week/i)).not.toHaveLength(0);
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

  it('confirms a recurring response whose appointments have distinct dates but the requested pattern and context', async () => {
    const user = userEvent.setup();
    mockSaveRecurringAppointments.mockImplementation(async (payload) => {
      const firstAppointment = payload.appointmentRequest;
      const secondAppointment = {
        ...firstAppointment,
        startDateTime: dayjs(firstAppointment.startDateTime).add(1, 'day').toISOString(),
        endDateTime: dayjs(firstAppointment.endDateTime).add(1, 'day').toISOString(),
      };
      return {
        status: 200,
        data: [
          {
            appointmentDefaultResponse: confirmedAppointmentResponse(firstAppointment, 200, 'recurring-uuid-1').data,
            recurringPattern: payload.recurringPattern,
          },
          {
            appointmentDefaultResponse: confirmedAppointmentResponse(secondAppointment, 200, 'recurring-uuid-2').data,
            recurringPattern: payload.recurringPattern,
          },
        ],
      } as FetchResponse;
    });

    renderWithSwr(<AppointmentForm {...defaultProps} />);
    await waitForLoadingToFinish();
    await fillRequiredAppointmentFields(user);
    await user.click(screen.getByLabelText(/is this a recurring appointment/i));
    fireEvent.change(await screen.findByLabelText(/^end date$/i), {
      target: { value: dayjs().add(7, 'day').format('YYYY-MM-DD') },
    });
    await user.click(screen.getByRole('button', { name: /save and close/i }));

    await waitFor(() => expect(mockSaveRecurringAppointments).toHaveBeenCalledTimes(1));
    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'success', title: 'Appointment scheduled' }),
    );
    expect(globalThis.sessionStorage.getItem(appointmentCheckpointStorageKey)).toBeNull();
  });

  it('keeps a recurring response locked when the returned pattern differs from the request', async () => {
    const user = userEvent.setup();
    mockSaveRecurringAppointments.mockImplementation(
      async (payload) =>
        ({
          status: 200,
          data: [
            {
              appointmentDefaultResponse: confirmedAppointmentResponse(payload.appointmentRequest).data,
              recurringPattern: { ...payload.recurringPattern, period: payload.recurringPattern.period + 1 },
            },
          ],
        }) as FetchResponse,
    );

    renderWithSwr(<AppointmentForm {...defaultProps} />);
    await waitForLoadingToFinish();
    await fillRequiredAppointmentFields(user);
    await user.click(screen.getByLabelText(/is this a recurring appointment/i));
    fireEvent.change(await screen.findByLabelText(/^end date$/i), {
      target: { value: dayjs().add(7, 'day').format('YYYY-MM-DD') },
    });
    const saveButton = screen.getByRole('button', { name: /save and close/i });
    await user.click(saveButton);

    await waitFor(() => expect(mockSaveRecurringAppointments).toHaveBeenCalledTimes(1));
    expect(mockShowSnackbar).toHaveBeenCalledWith(expect.objectContaining({ kind: 'warning' }));
    expect(globalThis.sessionStorage.getItem(appointmentCheckpointStorageKey)).not.toBeNull();
    expect(saveButton).toBeDisabled();
  });

  it('treats a recurring HTTP 204 as a definitive empty series instead of a successful save', async () => {
    const user = userEvent.setup();
    mockSaveRecurringAppointments.mockResolvedValue({ status: 204 } as FetchResponse);

    renderWithSwr(<AppointmentForm {...defaultProps} />);
    await waitForLoadingToFinish();
    await fillRequiredAppointmentFields(user);
    await user.click(screen.getByLabelText(/is this a recurring appointment/i));
    fireEvent.change(await screen.findByLabelText(/^end date$/i), {
      target: { value: dayjs().add(7, 'day').format('YYYY-MM-DD') },
    });
    const saveButton = screen.getByRole('button', { name: /save and close/i });
    await user.click(saveButton);

    await waitFor(() => expect(mockSaveRecurringAppointments).toHaveBeenCalledTimes(1));
    expect(mockShowSnackbar).toHaveBeenCalledWith({
      isLowContrast: false,
      kind: 'error',
      subtitle:
        'No se generó ninguna cita recurrente. Revise la fecha de inicio, el fin y el patrón antes de reintentar.',
      title: 'Error scheduling appointment',
    });
    expect(globalThis.sessionStorage.getItem(appointmentCheckpointStorageKey)).toBeNull();
    expect(saveButton).toBeEnabled();
    expect(defaultProps.closeWorkspace).not.toHaveBeenCalled();
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

  it('does not use the login facility as the appointment location and defaults to the selected service location', async () => {
    const user = userEvent.setup();
    const serviceLocation = mockLocations.data.results.at(1);
    const baseService = mockUseAppointmentServiceData.at(0);
    if (!serviceLocation || !baseService) {
      throw new Error('Appointment service and operational location fixtures are required');
    }
    const service = {
      ...baseService,
      location: serviceLocation,
    };
    mockOpenmrsFetch.mockResolvedValue({ data: [service] } as unknown as FetchResponse);

    renderWithSwr(<AppointmentForm {...defaultProps} />);

    await waitForLoadingToFinish();

    const locationSelect = screen.getByRole('combobox', { name: /select a location/i });
    expect(locationSelect).toHaveValue('');
    expect(locationSelect).not.toHaveValue(mockSession.data.sessionLocation.uuid);

    await user.selectOptions(screen.getByRole('combobox', { name: /select a service/i }), [service.name]);

    expect(locationSelect).toHaveValue(serviceLocation.uuid);
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

  it('renders controller validation messages on the time and duration fields', async () => {
    render(<TimeAndDurationValidationHarness />);

    expect(await screen.findByText('Invalid time')).toBeInTheDocument();
    expect(screen.getByText('Duration should be greater than zero')).toBeInTheDocument();
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

    mockConfirmedAppointmentSave(200);

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

  it('keeps HTTP 204 locked because the appointment API did not return an identifiable saved record', async () => {
    const user = userEvent.setup();
    mockSaveAppointment.mockResolvedValue({ status: 204 } as FetchResponse);

    renderWithSwr(<AppointmentForm {...defaultProps} />);
    await waitForLoadingToFinish();
    await fillRequiredAppointmentFields(user);
    await user.click(screen.getByRole('button', { name: /save and close/i }));

    await waitFor(() => expect(mockSaveAppointment).toHaveBeenCalledTimes(1));
    expect(mockShowSnackbar).toHaveBeenCalledWith({
      isLowContrast: false,
      kind: 'warning',
      subtitle:
        'No se pudo confirmar si la cita fue guardada. No vuelva a enviarla; verifique primero la lista de citas.',
      title: 'Error scheduling appointment',
    });
    expect(globalThis.sessionStorage.getItem(appointmentCheckpointStorageKey)).not.toBeNull();
    expect(screen.getByRole('button', { name: /save and close/i })).toBeDisabled();
    expect(defaultProps.closeWorkspace).not.toHaveBeenCalled();
  });

  it('keeps an HTTP 202 creation locked because it does not prove that the appointment was committed', async () => {
    const user = userEvent.setup();
    mockSaveAppointment.mockResolvedValue({ status: 202 } as FetchResponse);

    renderWithSwr(<AppointmentForm {...defaultProps} />);
    await waitForLoadingToFinish();
    await fillRequiredAppointmentFields(user);

    const saveButton = screen.getByRole('button', { name: /save and close/i });
    await user.click(saveButton);

    await waitFor(() => expect(mockSaveAppointment).toHaveBeenCalledTimes(1));
    expect(mockShowSnackbar).toHaveBeenCalledWith({
      isLowContrast: false,
      kind: 'warning',
      subtitle:
        'No se pudo confirmar si la cita fue guardada. No vuelva a enviarla; verifique primero la lista de citas.',
      title: 'Error scheduling appointment',
    });
    expect(globalThis.sessionStorage.getItem(appointmentCheckpointStorageKey)).not.toBeNull();
    expect(saveButton).toBeDisabled();
    expect(defaultProps.closeWorkspace).not.toHaveBeenCalled();
  });

  it('keeps an otherwise valid HTTP 201 creation locked because the deployed backend contract requires HTTP 200', async () => {
    const user = userEvent.setup();
    mockConfirmedAppointmentSave(201);

    renderWithSwr(<AppointmentForm {...defaultProps} />);
    await waitForLoadingToFinish();
    await fillRequiredAppointmentFields(user);

    const saveButton = screen.getByRole('button', { name: /save and close/i });
    await user.click(saveButton);

    await waitFor(() => expect(mockSaveAppointment).toHaveBeenCalledTimes(1));
    expect(mockShowSnackbar).toHaveBeenCalledWith(expect.objectContaining({ kind: 'warning' }));
    expect(globalThis.sessionStorage.getItem(appointmentCheckpointStorageKey)).not.toBeNull();
    expect(saveButton).toBeDisabled();
  });

  it('keeps a malformed HTTP 200 creation locked when the returned record belongs to another patient', async () => {
    const user = userEvent.setup();
    mockSaveAppointment.mockImplementation(async (payload) => {
      const response = confirmedAppointmentResponse(payload);
      return {
        ...response,
        data: { ...(response.data as object), patient: { uuid: 'another-patient' } },
      } as FetchResponse;
    });

    renderWithSwr(<AppointmentForm {...defaultProps} />);
    await waitForLoadingToFinish();
    await fillRequiredAppointmentFields(user);
    const saveButton = screen.getByRole('button', { name: /save and close/i });
    await user.click(saveButton);

    await waitFor(() => expect(mockSaveAppointment).toHaveBeenCalledTimes(1));
    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'warning',
        subtitle: expect.stringContaining('No se pudo confirmar si la cita fue guardada'),
      }),
    );
    expect(globalThis.sessionStorage.getItem(appointmentCheckpointStorageKey)).not.toBeNull();
    expect(saveButton).toBeDisabled();
    expect(defaultProps.closeWorkspace).not.toHaveBeenCalled();
  });

  it('schedules an all-day appointment using the full selected day', async () => {
    const user = userEvent.setup();

    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(configSchema),
      allowAllDayAppointments: true,
      appointmentTypes: ['Scheduled', 'WalkIn'],
    });
    mockConfirmedAppointmentSave(200);

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
    mockConfirmedAppointmentSave(200);

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
      kind: 'warning',
      subtitle:
        'No se pudo confirmar si la cita fue guardada. No vuelva a enviarla; verifique primero la lista de citas.',
      title: 'Error scheduling appointment',
    });

    expect(saveButton).toBeDisabled();
    await user.click(saveButton);
    expect(mockSaveAppointment).toHaveBeenCalledTimes(1);
  });

  it('keeps an ambiguous creation locked after the form is remounted', async () => {
    const user = userEvent.setup();
    mockSaveAppointment.mockRejectedValue({ response: { status: 500 } });

    const firstRender = renderWithSwr(<AppointmentForm {...defaultProps} />);
    await waitForLoadingToFinish();
    await fillRequiredAppointmentFields(user);
    await user.click(screen.getByRole('button', { name: /save and close/i }));

    await waitFor(() => expect(mockSaveAppointment).toHaveBeenCalledTimes(1));
    expect(globalThis.sessionStorage.getItem(appointmentCheckpointStorageKey)).not.toBeNull();
    firstRender.unmount();

    renderWithSwr(<AppointmentForm {...defaultProps} />);
    await waitForLoadingToFinish();

    expect(await screen.findByText('Resultado pendiente de verificación')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save and close/i })).toBeDisabled();
    expect(screen.getByText(/hay una creación de cita pendiente para este paciente/i)).toBeInTheDocument();
    expect(mockSaveAppointment).toHaveBeenCalledTimes(1);
  });

  it('keeps a generic backend HTTP 400 locked because it does not prove that the write was rolled back', async () => {
    const user = userEvent.setup();
    mockSaveAppointment.mockRejectedValue({ response: { status: 400 } });

    renderWithSwr(<AppointmentForm {...defaultProps} />);
    await waitForLoadingToFinish();
    await fillRequiredAppointmentFields(user);

    const saveButton = screen.getByRole('button', { name: /save and close/i });
    await user.click(saveButton);

    await waitFor(() => expect(mockSaveAppointment).toHaveBeenCalledTimes(1));
    expect(saveButton).toBeDisabled();
    expect(mockShowSnackbar).toHaveBeenCalledWith({
      isLowContrast: false,
      kind: 'warning',
      subtitle:
        'No se pudo confirmar si la cita fue guardada. No vuelva a enviarla; verifique primero la lista de citas.',
      title: 'Error scheduling appointment',
    });

    await user.click(saveButton);
    expect(mockSaveAppointment).toHaveBeenCalledTimes(1);
  });

  it('allows correction after a definitive authorization rejection', async () => {
    const user = userEvent.setup();
    mockSaveAppointment.mockRejectedValue({ response: { status: 403 } });

    renderWithSwr(<AppointmentForm {...defaultProps} />);
    await waitForLoadingToFinish();
    await fillRequiredAppointmentFields(user);

    const saveButton = screen.getByRole('button', { name: /save and close/i });
    await user.click(saveButton);

    await waitFor(() => expect(mockSaveAppointment).toHaveBeenCalledTimes(1));
    expect(saveButton).toBeEnabled();
    expect(mockShowSnackbar).toHaveBeenCalledWith({
      isLowContrast: false,
      kind: 'error',
      subtitle: 'La cita no fue guardada. Revise los datos antes de volver a intentar.',
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
    mockConfirmedAppointmentSave(200);

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
    mockConfirmedAppointmentSave(200);

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
    mockConfirmedAppointmentSave(200);

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

    mockConfirmedAppointmentSave(200);

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

  it('fails closed when the loaded patient identity does not match the appointment context', async () => {
    const user = userEvent.setup();
    const appointment = makeEditableAppointment();
    mockUsePatient.mockReturnValue({
      patient: { resourceType: 'Patient', id: 'different-patient-uuid' },
      patientUuid: 'different-patient-uuid',
      error: null,
      isLoading: false,
    });

    renderWithSwr(<AppointmentForm {...defaultProps} context="editing" appointment={appointment} />);
    await waitForLoadingToFinish();
    await user.click(screen.getByRole('button', { name: /save and close/i }));

    expect(mockGetAppointmentStatus).not.toHaveBeenCalled();
    expect(mockSaveAppointment).not.toHaveBeenCalled();
    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'error',
        subtitle:
          'No se pudo verificar el paciente, la sede, el servicio o el proveedor con los catálogos vigentes. Actualice el formulario antes de guardar.',
      }),
    );
  });

  it('fails closed when a selected location cannot be verified in the current catalog', async () => {
    const user = userEvent.setup();
    const appointment = makeEditableAppointment();
    mockUseLocations.mockReturnValue([]);

    renderWithSwr(<AppointmentForm {...defaultProps} context="editing" appointment={appointment} />);
    await waitForLoadingToFinish();
    await user.click(screen.getByRole('button', { name: /save and close/i }));

    expect(mockGetAppointmentStatus).not.toHaveBeenCalled();
    expect(mockSaveAppointment).not.toHaveBeenCalled();
    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'error', subtitle: expect.stringContaining('catálogos vigentes') }),
    );
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
    mockConfirmedAppointmentSave(200);

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

  it('replaces a duration derived from the previous service subtype when changing service', async () => {
    const user = userEvent.setup();
    const appointment = makeEditableAppointment();
    const oldServiceType = { uuid: 'old-subtype', name: 'Procedimiento extendido', duration: 45 };
    appointment.service = {
      ...appointment.service,
      durationMins: 20,
      serviceTypes: [oldServiceType],
    };
    appointment.serviceType = oldServiceType;
    appointment.endDateTime = new Date(new Date(appointment.startDateTime).getTime() + 45 * 60_000).toISOString();
    const nextService = {
      ...mockUseAppointmentServiceData[0],
      uuid: 'next-service-without-subtype',
      name: 'Consulta breve',
      durationMins: 20,
      serviceTypes: [],
    };
    mockAppointmentRequests([appointment.service, nextService]);

    renderWithSwr(<AppointmentForm {...defaultProps} context="editing" appointment={appointment} />);

    await waitForLoadingToFinish();
    expect(screen.getByRole('spinbutton', { name: /duration/i })).toHaveValue(45);
    await user.selectOptions(screen.getByRole('combobox', { name: /^select a service$/i }), [nextService.uuid]);
    expect(screen.getByRole('spinbutton', { name: /duration/i })).toHaveValue(20);
  });

  it('preserves a manually entered duration when changing service during creation', async () => {
    const user = userEvent.setup();
    const firstService = {
      ...mockUseAppointmentServiceData[0],
      uuid: 'first-service',
      durationMins: 30,
    };
    const nextService = {
      ...mockUseAppointmentServiceData[0],
      uuid: 'next-service',
      durationMins: 45,
    };
    mockAppointmentRequests([firstService, nextService]);

    renderWithSwr(<AppointmentForm {...defaultProps} />);

    await waitForLoadingToFinish();
    await user.selectOptions(screen.getByRole('combobox', { name: /^select a service$/i }), [firstService.uuid]);
    const durationInput = screen.getByRole('spinbutton', { name: /duration/i });
    await user.clear(durationInput);
    await user.type(durationInput, '37');
    await user.selectOptions(screen.getByRole('combobox', { name: /^select a service$/i }), [nextService.uuid]);
    expect(durationInput).toHaveValue(37);
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
    mockConfirmedAppointmentSave(200);

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
    mockConfirmedAppointmentSave(200);

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
    mockConfirmedAppointmentSave(200);

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
    mockConfirmedAppointmentSave(200);

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

  it('keeps the appointment start date read-only without the start-date privilege', async () => {
    mockOpenmrsFetch.mockResolvedValue(mockUseAppointmentServiceData as unknown as FetchResponse);

    renderWithSwr(<AppointmentForm {...defaultProps} />);

    await waitForLoadingToFinish();

    expect(mockUserHasAccess).toHaveBeenCalledWith(appointmentStartDateEditPrivilege, mockSession.data.user);
    expect(screen.getByTestId('datePickerInput')).toHaveAttribute('readonly');
  });

  it('allows editing the appointment start date with the start-date privilege', async () => {
    mockUserHasAccess.mockImplementation((privilege) => privilege === appointmentStartDateEditPrivilege);
    mockOpenmrsFetch.mockResolvedValue(mockUseAppointmentServiceData as unknown as FetchResponse);

    renderWithSwr(<AppointmentForm {...defaultProps} />);

    await waitForLoadingToFinish();

    expect(screen.getByTestId('datePickerInput')).not.toHaveAttribute('readonly');
  });

  it('applies the start-date privilege and required marker to recurring appointments', async () => {
    const user = userEvent.setup();

    renderWithSwr(<AppointmentForm {...defaultProps} />);
    await waitForLoadingToFinish();
    await user.click(screen.getByLabelText(/is this a recurring appointment/i));

    const recurringStartDate = await screen.findByTestId('startDatePickerInput');
    expect(recurringStartDate).toHaveAttribute('readonly');
    expect(recurringStartDate).toBeRequired();
  });

  it('allows an authorized user to edit the recurring appointment start date', async () => {
    const user = userEvent.setup();
    mockUserHasAccess.mockImplementation((privilege) => privilege === appointmentStartDateEditPrivilege);

    renderWithSwr(<AppointmentForm {...defaultProps} />);
    await waitForLoadingToFinish();
    await user.click(screen.getByLabelText(/is this a recurring appointment/i));

    expect(await screen.findByTestId('startDatePickerInput')).not.toHaveAttribute('readonly');
  });

  it('persists an authorized appointment issue date change', async () => {
    const user = userEvent.setup();
    const appointment = makeEditableAppointment();
    appointment.dateAppointmentScheduled = '2026-07-01T09:00:00-05:00';
    mockUserHasAccess.mockReturnValue(true);
    mockConfirmedAppointmentSave(200);

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

    expect(await screen.findAllByText(/a valid appointment issue date is required/i)).not.toHaveLength(0);
    expect(mockGetAppointmentStatus).not.toHaveBeenCalled();
    expect(mockSaveAppointment).not.toHaveBeenCalled();
  });

  it('keeps the trusted creation issue date stable across midnight and rerenders', async () => {
    const user = userEvent.setup();
    mockConfirmedAppointmentSave(200);

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

  it('preselects the responsible provider from the session when the user has a provider account', async () => {
    mockUseSession.mockReturnValue({
      ...mockSession.data,
      currentProvider: { ...mockSession.data.currentProvider, uuid: mockProviders.data[0].uuid },
    } as ReturnType<typeof useSession>);
    mockOpenmrsFetch.mockResolvedValue(mockUseAppointmentServiceData as unknown as FetchResponse);

    renderWithSwr(<AppointmentForm {...defaultProps} />);

    await waitForLoadingToFinish();

    expect(screen.getByRole('combobox', { name: /select a provider/i })).toHaveValue(mockProviders.data[0].uuid);
  });

  it('leaves the responsible provider unselected when the user has no provider account', async () => {
    mockUseSession.mockReturnValue({
      ...mockSession.data,
      currentProvider: undefined,
    } as unknown as ReturnType<typeof useSession>);
    mockOpenmrsFetch.mockResolvedValue(mockUseAppointmentServiceData as unknown as FetchResponse);

    renderWithSwr(<AppointmentForm {...defaultProps} />);

    await waitForLoadingToFinish();

    expect(screen.getByRole('combobox', { name: /select a provider/i })).toHaveValue('');
  });

  it('preserves the original issue date when a read-only form value is tampered with', async () => {
    const user = userEvent.setup();
    const appointment = makeEditableAppointment();
    appointment.dateAppointmentScheduled = '2026-07-01T09:00:00-05:00';
    mockConfirmedAppointmentSave(200);

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
