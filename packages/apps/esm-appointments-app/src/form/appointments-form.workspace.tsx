import {
  Button,
  ButtonSet,
  Form,
  InlineNotification,
  InlineLoading,
  MultiSelect,
  NumberInput,
  RadioButton,
  RadioButtonGroup,
  Select,
  SelectItem,
  Stack,
  TextArea,
  TimePicker,
  TimePickerSelect,
  Toggle,
} from '@carbon/react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ExtensionSlot,
  type FetchResponse,
  getUserFacingErrorMessage,
  logError,
  OpenmrsDatePicker,
  ResponsiveWrapper,
  showSnackbar,
  translateFrom,
  useConfig,
  useLayoutType,
  useLocations,
  usePatient,
  useSession,
  userHasAccess,
  Workspace2,
  type Workspace2DefinitionProps,
} from '@openmrs/esm-framework';
import {
  type PlainNumberInputConstraints,
  shouldPreventPlainNumberKey,
  shouldPreventPlainNumberPaste,
  validatePlainNumberInput,
} from '@openmrs/esm-utils';
import dayjs from 'dayjs';
import React, { useContext, useEffect, useRef, useState } from 'react';
import { Controller, useController, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { type ConfigObject } from '../config-schema';
import {
  appointmentIssuedDateEditPrivilege,
  appointmentLocationTagName,
  appointmentNoteMaxLength,
  appointmentStartDateEditPrivilege,
  dateFormat,
  moduleName,
  weekDays,
} from '../constants';
import { isAppointmentEditable } from '../helpers';
import SelectedDateContext from '../hooks/selectedDateContext';
import { useProviders } from '../hooks/useProviders';
import { getAppointmentStatus } from '../patient-appointments/patient-appointments.resource';
import {
  type Appointment,
  AppointmentKind,
  type AppointmentPayload,
  type AppointmentProviderDetails,
  type AppointmentService,
  AppointmentStatus,
  type RecurringPattern,
} from '../types';
import Workload from '../workload/workload.component';
import {
  checkAppointmentConflict,
  checkRecurringAppointmentConflict,
  saveAppointment,
  saveRecurringAppointments,
  useAppointmentService,
  useMutateAppointments,
} from './appointments-form.resource';
import {
  clearAppointmentCreationCheckpoint,
  fingerprintAppointmentCreationPayload,
  loadAppointmentCreationCheckpoint,
  saveAppointmentCreationCheckpoint,
} from './appointment-creation-checkpoint';
import styles from './appointments-form.scss';

const preventInvalidIntegerKey =
  (constraints: PlainNumberInputConstraints) => (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    if (shouldPreventPlainNumberKey(event.key, constraints)) {
      event.preventDefault();
    }
  };

const preventInvalidIntegerPaste =
  (constraints: PlainNumberInputConstraints) => (event: React.ClipboardEvent<HTMLInputElement>) => {
    if (shouldPreventPlainNumberPaste(event.clipboardData.getData('text'), constraints)) {
      event.preventDefault();
    }
  };

const getIntegerValue = (value: string | number, constraints: PlainNumberInputConstraints) =>
  validatePlainNumberInput(value, constraints).parsedValue ?? null;

function getConflictErrorMessage(
  responseData: Record<string, unknown>,
  t: (key: string, defaultValue: string) => string,
): string | null {
  if (Object.keys(responseData).length === 0) {
    return null;
  }

  const defaultMessage = t('appointmentConflict', 'Appointment conflict');
  if (Object.hasOwn(responseData, 'SERVICE_UNAVAILABLE')) {
    return t('serviceUnavailable', 'Appointment time is outside of service hours');
  }
  if (Object.hasOwn(responseData, 'PATIENT_DOUBLE_BOOKING')) {
    return t('patientDoubleBooking', 'Patient already booked for an appointment at this time');
  }
  return defaultMessage;
}

function isConflictMap(responseData: unknown): responseData is Record<string, unknown> {
  return Boolean(responseData) && typeof responseData === 'object' && !Array.isArray(responseData);
}

interface AppointmentsFormProps {
  appointment?: Appointment;
  recurringPattern?: RecurringPattern;
  patientUuid?: string;
  context?: string;
  workspaceTitle?: string;
}

// MINSA appointment services are configured without a default `durationMins`,
// so new appointments fall back to this duration until the user overrides it.
const DEFAULT_APPOINTMENT_DURATION_MINUTES = 30;
// Frontend safety boundary until the recurring-appointments API enforces its own limit.
// With a daily period of one, this caps a series at 366 generated appointments.
const MAX_RECURRING_APPOINTMENT_HORIZON_DAYS = 365;
const APPOINTMENT_EDIT_STATUS_CONFLICT = 'APPOINTMENT_EDIT_STATUS_CONFLICT';
const APPOINTMENT_RECURRING_EMPTY = 'APPOINTMENT_RECURRING_EMPTY';

const time12HourFormatRegexPattern = '^(1[0-2]|0?[1-9]):[0-5][0-9]$';

// Same visual convention as patient registration: a red asterisk on required fields.
function RequiredFieldLabel({ label }: { label: string }) {
  return <span className={styles.requiredLabel}>{label}</span>;
}

const isValidTime = (timeStr: string) => timeStr.match(new RegExp(time12HourFormatRegexPattern));

type AppointmentConfirmation = {
  uuid?: unknown;
  patient?: { uuid?: unknown };
  service?: { uuid?: unknown };
  serviceType?: { uuid?: unknown } | null;
  location?: { uuid?: unknown };
  startDateTime?: unknown;
  endDateTime?: unknown;
  dateAppointmentScheduled?: unknown;
  appointmentKind?: unknown;
  status?: unknown;
  comments?: unknown;
  providers?: unknown;
};

type RecurringPatternConfirmation = {
  type?: unknown;
  period?: unknown;
  endDate?: unknown;
  daysOfWeek?: unknown;
};

function isSameInstant(left: unknown, right: string) {
  if (typeof left !== 'string' && typeof left !== 'number' && !(left instanceof Date)) {
    return false;
  }
  const leftTime = new Date(left).getTime();
  const rightTime = new Date(right).getTime();
  return Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime === rightTime;
}

function getConfirmedAppointmentEntity(value: unknown, payload: AppointmentPayload) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const confirmation = value as AppointmentConfirmation;
  const responseUuid = typeof confirmation.uuid === 'string' ? confirmation.uuid.trim() : '';
  const responseServiceTypeUuid =
    confirmation.serviceType && typeof confirmation.serviceType.uuid === 'string'
      ? confirmation.serviceType.uuid
      : undefined;
  const expectedProviders = (payload.providers ?? [])
    .map((provider) => ({
      response: provider.response?.toUpperCase() ?? 'ACCEPTED',
      uuid: provider.uuid,
    }))
    .sort((left, right) => left.uuid.localeCompare(right.uuid));
  const responseProviders = Array.isArray(confirmation.providers)
    ? confirmation.providers
        .filter((provider): provider is { uuid: string; response?: string } =>
          Boolean(
            provider &&
              typeof provider === 'object' &&
              typeof (provider as { uuid?: unknown }).uuid === 'string' &&
              (typeof (provider as { response?: unknown }).response === 'string' ||
                (provider as { response?: unknown }).response === undefined),
          ),
        )
        .map((provider) => ({
          response: provider.response?.toUpperCase() ?? 'ACCEPTED',
          uuid: provider.uuid,
        }))
        .filter((provider) => provider.response !== 'CANCELLED')
        .sort((left, right) => left.uuid.localeCompare(right.uuid))
    : null;

  const contextMatches =
    responseUuid.length > 0 &&
    (!payload.uuid || responseUuid === payload.uuid) &&
    confirmation.patient?.uuid === payload.patientUuid &&
    confirmation.service?.uuid === payload.serviceUuid &&
    responseServiceTypeUuid === payload.serviceTypeUuid &&
    confirmation.location?.uuid === payload.locationUuid &&
    confirmation.appointmentKind === payload.appointmentKind &&
    confirmation.comments === payload.comments &&
    (!payload.status || confirmation.status === payload.status) &&
    isSameInstant(confirmation.dateAppointmentScheduled, payload.dateAppointmentScheduled) &&
    responseProviders !== null &&
    JSON.stringify(responseProviders) === JSON.stringify(expectedProviders);

  return contextMatches ? confirmation : null;
}

function isConfirmedAppointmentEntity(value: unknown, payload: AppointmentPayload) {
  const confirmation = getConfirmedAppointmentEntity(value, payload);
  return (
    Boolean(confirmation) &&
    isSameInstant(confirmation?.startDateTime, payload.startDateTime) &&
    isSameInstant(confirmation?.endDateTime, payload.endDateTime)
  );
}

function normalizeDaysOfWeek(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((day): day is string => typeof day === 'string')
        .map((day) => day.toUpperCase())
        .sort()
    : [];
}

function isConfirmedRecurringPattern(value: unknown, requestedPattern: RecurringPattern) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const confirmation = value as RecurringPatternConfirmation;
  return (
    typeof confirmation.type === 'string' &&
    confirmation.type.toUpperCase() === requestedPattern.type &&
    confirmation.period === requestedPattern.period &&
    Boolean(requestedPattern.endDate) &&
    isSameInstant(confirmation.endDate, requestedPattern.endDate ?? '') &&
    JSON.stringify(normalizeDaysOfWeek(confirmation.daysOfWeek)) ===
      JSON.stringify(normalizeDaysOfWeek(requestedPattern.daysOfWeek))
  );
}

function getConfirmedRecurringAppointmentStart(value: unknown, payload: AppointmentPayload) {
  const confirmation = getConfirmedAppointmentEntity(value, payload);
  if (!confirmation) {
    return null;
  }

  const startTime = new Date(confirmation.startDateTime as string | number | Date).getTime();
  const endTime = new Date(confirmation.endDateTime as string | number | Date).getTime();
  const requestedStartTime = new Date(payload.startDateTime).getTime();
  const requestedDuration = new Date(payload.endDateTime).getTime() - requestedStartTime;

  return Number.isFinite(startTime) &&
    Number.isFinite(endTime) &&
    startTime >= requestedStartTime &&
    endTime > startTime &&
    endTime - startTime === requestedDuration
    ? startTime
    : null;
}

function isConfirmedAppointmentSaveResponse(
  response: FetchResponse<unknown>,
  payload: AppointmentPayload,
  recurringPattern?: RecurringPattern,
) {
  if (response.status !== 200) {
    return false;
  }

  if (!recurringPattern) {
    return isConfirmedAppointmentEntity(response.data, payload);
  }

  if (!Array.isArray(response.data) || response.data.length === 0) {
    return false;
  }

  const confirmations = response.data.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return null;
    }
    const recurringConfirmation = entry as {
      appointmentDefaultResponse?: unknown;
      recurringPattern?: unknown;
    };
    const appointment = recurringConfirmation.appointmentDefaultResponse;
    const confirmedStart = getConfirmedRecurringAppointmentStart(appointment, payload);
    if (
      confirmedStart === null ||
      !isConfirmedRecurringPattern(recurringConfirmation.recurringPattern, recurringPattern)
    ) {
      return null;
    }
    const appointmentUuid = (appointment as AppointmentConfirmation).uuid;
    return typeof appointmentUuid === 'string' ? { appointmentUuid, confirmedStart } : null;
  });

  if (confirmations.some((confirmation) => confirmation === null)) {
    return false;
  }

  const validConfirmations = confirmations as Array<{ appointmentUuid: string; confirmedStart: number }>;
  const recurringEndTime = new Date(recurringPattern.endDate ?? '').getTime();
  const appointmentUuids = validConfirmations.map(({ appointmentUuid }) => appointmentUuid);
  const appointmentStarts = validConfirmations.map(({ confirmedStart }) => confirmedStart);

  return (
    Number.isFinite(recurringEndTime) &&
    appointmentStarts.every((startTime) => startTime <= recurringEndTime) &&
    new Set(appointmentUuids).size === appointmentUuids.length &&
    new Set(appointmentStarts).size === appointmentStarts.length
  );
}

function isDefinitiveEmptyRecurringSaveResponse(response: FetchResponse<unknown>, recurring: boolean) {
  return (
    recurring &&
    (response.status === 204 || (response.status === 200 && Array.isArray(response.data) && response.data.length === 0))
  );
}

function getErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const candidate = error as { status?: unknown; responseStatus?: unknown; response?: { status?: unknown } };
  const status = candidate.status ?? candidate.responseStatus ?? candidate.response?.status;
  return typeof status === 'number' ? status : undefined;
}

function isDefinitiveAppointmentSaveRejection(error: unknown) {
  if (error && typeof error === 'object' && (error as { code?: unknown }).code === APPOINTMENT_RECURRING_EMPTY) {
    return true;
  }

  const status = getErrorStatus(error);
  // The appointments module catches mapping, persistence and response-construction failures in the same 400 block.
  // Only transport/authentication rejections that cannot enter the save controller are safe to retry automatically.
  return Boolean(status && [401, 403, 404, 405, 413, 415].includes(status));
}

function getConfiguredAppointmentDuration(service?: AppointmentService, serviceTypeUuid?: string) {
  const serviceTypeDuration = serviceTypeUuid
    ? service?.serviceTypes?.find((serviceType) => serviceType.uuid === serviceTypeUuid)?.duration
    : undefined;
  return serviceTypeDuration ?? service?.durationMins ?? DEFAULT_APPOINTMENT_DURATION_MINUTES;
}

function isValidDate(value: Date | undefined): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function resolveAppointmentIssuedDate(
  canEditIssuedDate: boolean,
  submittedDate: Date | undefined,
  originalDate: Date | undefined,
): Date {
  const effectiveDate = canEditIssuedDate && isValidDate(submittedDate) ? submittedDate : originalDate;
  if (!isValidDate(effectiveDate)) {
    throw new Error('A trusted appointment issue date is unavailable.');
  }
  return effectiveDate;
}

// CANCELLED associations must never be sent back because the appointments API
// reactivates every provider included in an update payload. REJECTED and
// TENTATIVE associations are preserved as history, but do not count as an
// assigned provider.
const shouldPreserveAppointmentProvider = (provider: AppointmentProviderDetails) => provider.response !== 'CANCELLED';

const isAssignedAppointmentProvider = (provider: AppointmentProviderDetails) =>
  provider.response === 'ACCEPTED' || provider.response === 'AWAITING';

export function isRecurringAppointmentHorizonAllowed(startDate: Date, endDate: Date) {
  return (
    dayjs(endDate).startOf('day').diff(dayjs(startDate).startOf('day'), 'day') <= MAX_RECURRING_APPOINTMENT_HORIZON_DAYS
  );
}

export function getRecurringAppointmentPeriodValidationError(isRecurring: boolean, period: number | null) {
  if (!isRecurring) {
    return null;
  }
  if (period === null || period < 1 || period > MAX_RECURRING_APPOINTMENT_HORIZON_DAYS) {
    return 'outOfRange';
  }
  return Number.isInteger(period) ? null : 'notInteger';
}

const normalizeAppointmentKind = (appointmentType: string): AppointmentKind => {
  const normalizedType = appointmentType.trim().toLowerCase();

  const legacyMappings: Record<string, AppointmentKind> = {
    scheduled: AppointmentKind.SCHEDULED,
    walkin: AppointmentKind.WALKIN,
    'walk in': AppointmentKind.WALKIN,
    'walk-in': AppointmentKind.WALKIN,
    virtual: AppointmentKind.VIRTUAL,
    nuevo: AppointmentKind.SCHEDULED,
    continuador: AppointmentKind.SCHEDULED,
    reingresante: AppointmentKind.SCHEDULED,
  };

  const directMappings = {
    [AppointmentKind.SCHEDULED.toLowerCase()]: AppointmentKind.SCHEDULED,
    [AppointmentKind.WALKIN.toLowerCase()]: AppointmentKind.WALKIN,
    [AppointmentKind.VIRTUAL.toLowerCase()]: AppointmentKind.VIRTUAL,
  };

  return directMappings[normalizedType] ?? legacyMappings[normalizedType] ?? AppointmentKind.SCHEDULED;
};

const getInitialAppointmentStatus = (initialStatus: string | undefined): AppointmentStatus => {
  if (initialStatus === AppointmentStatus.REQUESTED || initialStatus === AppointmentStatus.WAITLIST) {
    return initialStatus;
  }

  return AppointmentStatus.SCHEDULED;
};

const getAppointmentTypeFromKind = (
  appointmentKind: string | undefined,
  appointmentTypes: Array<string> = [],
): string => {
  if (!appointmentKind) {
    return '';
  }

  const configuredType = appointmentTypes.find((type) => normalizeAppointmentKind(type) === appointmentKind);
  const canonicalType = Object.values(AppointmentKind).find((kind) => kind === appointmentKind);
  return configuredType ?? canonicalType ?? '';
};

interface AppointmentFormDefaults {
  defaultTimeFormat: 'AM' | 'PM';
  defaultStartDate: Date;
  defaultEndDate: Date | null;
  defaultEndDateText: string;
  defaultStartDateText: string;
  defaultAppointmentStartTime: string;
  defaultDuration: number | undefined;
  defaultRecurringPatternType: 'DAY' | 'WEEK';
  defaultRecurringPatternPeriod: number;
  defaultRecurringPatternDaysOfWeek: string[];
}

function resolveAppointmentFormDefaults(
  appointment: Appointment | undefined,
  recurringPattern: RecurringPattern | undefined,
  selectedDate: string | Date | undefined,
): AppointmentFormDefaults {
  const editedTimeFormat: 'AM' | 'PM' = new Date(appointment?.startDateTime).getHours() >= 12 ? 'PM' : 'AM';
  const currentTimeFormat: 'AM' | 'PM' = new Date().getHours() >= 12 ? 'PM' : 'AM';

  return {
    defaultTimeFormat: appointment?.startDateTime ? editedTimeFormat : currentTimeFormat,
    defaultStartDate: appointment?.startDateTime
      ? new Date(appointment.startDateTime)
      : selectedDate
        ? new Date(selectedDate)
        : new Date(),
    defaultEndDate: recurringPattern?.endDate ? new Date(recurringPattern.endDate) : null,
    defaultEndDateText: recurringPattern?.endDate ? dayjs(new Date(recurringPattern.endDate)).format(dateFormat) : '',
    defaultStartDateText: appointment?.startDateTime
      ? dayjs(new Date(appointment.startDateTime)).format(dateFormat)
      : selectedDate
        ? dayjs(selectedDate).format(dateFormat)
        : dayjs(new Date()).format(dateFormat),
    defaultAppointmentStartTime: appointment?.startDateTime
      ? dayjs(new Date(appointment.startDateTime)).format('hh:mm')
      : dayjs(new Date()).format('hh:mm'),
    defaultDuration:
      appointment?.startDateTime && appointment?.endDateTime
        ? dayjs(appointment.endDateTime).diff(dayjs(appointment.startDateTime), 'minutes')
        : DEFAULT_APPOINTMENT_DURATION_MINUTES,
    defaultRecurringPatternType: (recurringPattern?.type || 'DAY') as 'DAY' | 'WEEK',
    defaultRecurringPatternPeriod: recurringPattern?.period || 1,
    defaultRecurringPatternDaysOfWeek: recurringPattern?.daysOfWeek || [],
  };
}

const AppointmentsForm: React.FC<
  AppointmentsFormProps &
    Partial<Workspace2DefinitionProps<AppointmentsFormProps, object>> & {
      closeWorkspace?: (options?: {
        closeWindow?: boolean;
        discardUnsavedChanges?: boolean;
      }) => void | Promise<boolean>;
      promptBeforeClosing?: (testFcn: () => boolean) => void;
    }
> = (props) => {
  const workspaceProps = (props.workspaceProps ?? {}) as Partial<AppointmentsFormProps>;
  const appointment = props.appointment ?? workspaceProps.appointment;
  const recurringPattern = props.recurringPattern ?? workspaceProps.recurringPattern;
  const patientUuid = props.patientUuid ?? workspaceProps.patientUuid;
  const context = props.context ?? workspaceProps.context ?? 'creating';
  const workspaceTitle = props.workspaceTitle ?? workspaceProps.workspaceTitle;
  const closeWorkspace = props.closeWorkspace ?? (() => Promise.resolve(true));
  const promptBeforeClosing = props.promptBeforeClosing;
  const { patient, error: patientError, isLoading: patientIsLoading } = usePatient(patientUuid);
  const { mutateAppointments } = useMutateAppointments();
  const { t } = useTranslation();
  const isTablet = useLayoutType() === 'tablet';
  const locations = useLocations(appointmentLocationTagName);
  const providers = useProviders();
  const session = useSession();
  const canEditAppointmentIssuedDate = userHasAccess(appointmentIssuedDateEditPrivilege, session?.user);
  const canEditAppointmentStartDate = userHasAccess(appointmentStartDateEditPrivilege, session?.user);
  const { selectedDate } = useContext(SelectedDateContext);
  const { data: services, error: servicesError, isLoading } = useAppointmentService();
  const { appointmentTypes, allowAllDayAppointments } = useConfig<ConfigObject>();
  const availableServices =
    appointment?.service && !services?.some((service) => service.uuid === appointment.service.uuid)
      ? [appointment.service, ...(services ?? [])]
      : (services ?? []);
  const preservedAppointmentProviders = appointment?.providers?.filter(shouldPreserveAppointmentProvider) ?? [];
  const assignedAppointmentProviders = preservedAppointmentProviders.filter(isAssignedAppointmentProvider);
  const currentPrimaryProviderUuid =
    assignedAppointmentProviders.find((provider) => provider.response === 'ACCEPTED')?.uuid ??
    assignedAppointmentProviders[0]?.uuid;
  const providerOptions = [
    ...(providers?.providers ?? []).map((provider) => ({ uuid: provider.uuid, display: provider.display })),
    ...preservedAppointmentProviders
      .filter(
        (appointmentProvider) =>
          !(providers?.providers ?? []).some((provider) => provider.uuid === appointmentProvider.uuid),
      )
      .map((provider) => ({
        uuid: provider.uuid,
        display: provider.display ?? provider.name ?? provider.uuid,
      })),
  ];
  const mappedAppointmentTypes = appointmentTypes ?? [];
  const existingAppointmentType = getAppointmentTypeFromKind(appointment?.appointmentKind, mappedAppointmentTypes);
  const appointmentTypeOptions =
    existingAppointmentType && !mappedAppointmentTypes.includes(existingAppointmentType)
      ? [existingAppointmentType, ...mappedAppointmentTypes]
      : mappedAppointmentTypes;
  const title =
    workspaceTitle ??
    (context === 'editing'
      ? t('editAppointment', 'Edit appointment')
      : t('createNewAppointment', 'Create new appointment'));

  const [isRecurringAppointment, setIsRecurringAppointment] = useState(false);
  const [isAllDayAppointment, setIsAllDayAppointment] = useState(false);
  const [isSuccessful, setIsSuccessful] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaveOutcomeAmbiguous, setIsSaveOutcomeAmbiguous] = useState(false);
  const [saveOutcomeSafetyMessage, setSaveOutcomeSafetyMessage] = useState<string>();
  const saveAttemptInFlightRef = useRef(false);
  // Keep the trusted issue date stable for the lifetime of this form. Recomputing
  // `new Date()` on every render could silently change the submitted day if a
  // creation form remains open across midnight. Existing records fail closed
  // when their persisted issue date is absent or invalid.
  const [defaultDateAppointmentScheduled] = useState<Date | undefined>(() => {
    if (context !== 'editing') {
      return new Date();
    }
    if (!appointment?.dateAppointmentScheduled) {
      return undefined;
    }

    const persistedIssueDate = new Date(appointment.dateAppointmentScheduled);
    return isValidDate(persistedIssueDate) ? persistedIssueDate : undefined;
  });

  useEffect(() => {
    if (context === 'editing') {
      return;
    }

    try {
      if (loadAppointmentCreationCheckpoint(patientUuid ?? '')) {
        setIsSaveOutcomeAmbiguous(true);
        setSaveOutcomeSafetyMessage(
          t(
            'appointmentCreationCheckpointPending',
            'Hay una creación de cita pendiente para este paciente. No vuelva a guardar hasta verificar la lista de citas; si requiere liberarla, cierre esta pestaña después de la verificación.',
          ),
        );
      }
    } catch {
      setIsSaveOutcomeAmbiguous(true);
      setSaveOutcomeSafetyMessage(
        t(
          'appointmentCreationCheckpointInvalid',
          'Existe un intento de cita pendiente que no puede leerse. No vuelva a guardar; solicite verificación de la cita y de esta sesión.',
        ),
      );
    }
  }, [context, patientUuid, t]);

  // TODO can we clean this all up to be more consistent between using Date and dayjs?
  const {
    defaultTimeFormat,
    defaultStartDate,
    defaultEndDate,
    defaultEndDateText,
    defaultStartDateText,
    defaultAppointmentStartTime,
    defaultDuration,
    defaultRecurringPatternType,
    defaultRecurringPatternPeriod,
    defaultRecurringPatternDaysOfWeek,
  } = resolveAppointmentFormDefaults(appointment, recurringPattern, selectedDate);

  // t('durationErrorMessage', 'Duration should be greater than zero')
  const appointmentsFormSchema = z
    .object({
      duration: z
        .number()
        .nullable()
        .refine((duration) => (isAllDayAppointment ? true : duration > 0), {
          message: translateFrom(moduleName, 'durationErrorMessage', 'Duration should be greater than zero'),
        }),
      location: z.string().refine((value) => value !== '', {
        message: translateFrom(moduleName, 'locationRequired', 'Location is required'),
      }),
      provider: z.string().refine((value) => value !== '', {
        message: translateFrom(moduleName, 'providerRequired', 'Provider is required'),
      }),
      appointmentNote: z.string().max(appointmentNoteMaxLength, {
        message: translateFrom(
          moduleName,
          'appointmentNoteTooLong',
          `Appointment note cannot exceed ${appointmentNoteMaxLength} characters`,
        ),
      }),
      appointmentType: z.string().refine((value) => value !== '', {
        message: translateFrom(moduleName, 'appointmentTypeRequired', 'Appointment type is required'),
      }),
      selectedService: z.string().refine((value) => value !== '', {
        message: translateFrom(moduleName, 'serviceRequired', 'Service is required'),
      }),
      selectedServiceType: z.string(),
      recurringPatternType: z.enum(['DAY', 'WEEK']),
      recurringPatternPeriod: z.number().nullable(),
      recurringPatternDaysOfWeek: z.array(z.string()),
      selectedDaysOfWeekText: z.string().optional(),
      startTime: z.string().refine((value) => isValidTime(value), {
        message: translateFrom(moduleName, 'invalidTime', 'Invalid time'),
      }),
      timeFormat: z.enum(['AM', 'PM']),
      appointmentDateTime: z.object({
        startDate: z.date(),
        startDateText: z.string(),
        recurringPatternEndDate: z.date().nullable(),
        recurringPatternEndDateText: z.string().nullable(),
      }),
      formIsRecurringAppointment: z.boolean(),
      dateAppointmentScheduled: z.date({
        required_error: t('appointmentIssuedDateRequired', 'A valid appointment issue date is required'),
        invalid_type_error: t('appointmentIssuedDateRequired', 'A valid appointment issue date is required'),
      }),
    })
    .superRefine((formValues, context) => {
      const periodError = getRecurringAppointmentPeriodValidationError(
        formValues.formIsRecurringAppointment,
        formValues.recurringPatternPeriod,
      );
      if (periodError === 'outOfRange') {
        context.addIssue({
          code: 'custom',
          path: ['recurringPatternPeriod'],
          message: t(
            'recurringPeriodOutOfRange',
            `The recurrence interval must be between 1 and ${MAX_RECURRING_APPOINTMENT_HORIZON_DAYS}`,
          ),
        });
      } else if (periodError === 'notInteger') {
        context.addIssue({
          code: 'custom',
          path: ['recurringPatternPeriod'],
          message: t('recurringPeriodMustBeInteger', 'The recurrence interval must be a whole number'),
        });
      }
    })
    .refine(
      (formValues) => {
        if (formValues.formIsRecurringAppointment === true) {
          return z.date().safeParse(formValues.appointmentDateTime.recurringPatternEndDate).success;
        }
        return true;
      },
      {
        path: ['appointmentDateTime.recurringPatternEndDate'],
        message: t('recurringAppointmentShouldHaveEndDate', 'A recurring appointment should have an end date'),
      },
    )
    .refine(
      (formValues) => {
        const { startDate, recurringPatternEndDate } = formValues.appointmentDateTime;
        if (!formValues.formIsRecurringAppointment || !recurringPatternEndDate) {
          return true;
        }

        return isRecurringAppointmentHorizonAllowed(startDate, recurringPatternEndDate);
      },
      {
        path: ['appointmentDateTime.recurringPatternEndDate'],
        message: t(
          'recurringHorizonExceeded',
          `A recurring series cannot extend more than ${MAX_RECURRING_APPOINTMENT_HORIZON_DAYS} days`,
        ),
      },
    )
    .refine(
      (formValues) => {
        if (!formValues.formIsRecurringAppointment || !formValues.appointmentDateTime.recurringPatternEndDate) {
          return true;
        }
        return (
          formValues.appointmentDateTime.recurringPatternEndDate.getTime() >=
          formValues.appointmentDateTime.startDate.getTime()
        );
      },
      {
        path: ['appointmentDateTime.recurringPatternEndDate'],
        message: t('recurringEndDateBeforeStart', 'The recurrence end date cannot be before the start date'),
      },
    )
    .refine(
      (formValues) =>
        !formValues.formIsRecurringAppointment ||
        formValues.recurringPatternType !== 'WEEK' ||
        formValues.recurringPatternDaysOfWeek.length > 0,
      {
        path: ['recurringPatternDaysOfWeek'],
        message: t('recurringWeekdayRequired', 'Select at least one day of the week'),
      },
    )
    .refine(
      (formValues) => {
        if (!formValues.selectedServiceType) {
          return true;
        }

        const selectedService = availableServices.find((service) => service.uuid === formValues.selectedService);
        const isCurrentRetiredType =
          appointment?.service.uuid === formValues.selectedService &&
          appointment?.serviceType?.uuid === formValues.selectedServiceType;

        return (
          isCurrentRetiredType ||
          Boolean(
            selectedService?.serviceTypes?.some((serviceType) => serviceType.uuid === formValues.selectedServiceType),
          )
        );
      },
      {
        path: ['selectedServiceType'],
        message: t('invalidServiceType', 'The selected service type does not belong to this service'),
      },
    )
    .refine(
      (formValues) => {
        const { appointmentDateTime, dateAppointmentScheduled } = formValues;

        const startDate = appointmentDateTime?.startDate;

        if (!startDate || !dateAppointmentScheduled) return true;

        const normalizeDate = (date: Date) => {
          const normalizedDate = new Date(date);
          normalizedDate.setHours(0, 0, 0, 0);
          return normalizedDate;
        };

        const startDateObj = normalizeDate(startDate);
        const scheduledDateObj = normalizeDate(dateAppointmentScheduled);

        return scheduledDateObj <= startDateObj;
      },
      {
        path: ['dateAppointmentScheduled'],
        message: t(
          'dateAppointmentIssuedCannotBeAfterAppointmentDate',
          'Date appointment issued cannot be after the appointment date',
        ),
      },
    )
    .refine(() => canEditAppointmentIssuedDate || isValidDate(defaultDateAppointmentScheduled), {
      path: ['dateAppointmentScheduled'],
      message: t(
        'appointmentOriginalIssuedDateInvalid',
        'The original appointment issue date is missing or invalid and cannot be preserved',
      ),
    });

  type AppointmentFormData = z.infer<typeof appointmentsFormSchema>;

  const {
    control,
    getValues,
    setValue,
    watch,
    handleSubmit,
    reset,
    formState: { dirtyFields, errors, isDirty },
  } = useForm<AppointmentFormData>({
    mode: 'all',
    resolver: zodResolver(appointmentsFormSchema),
    defaultValues: {
      location: appointment?.location?.uuid ?? session?.sessionLocation?.uuid ?? '',
      provider: currentPrimaryProviderUuid ?? (context === 'creating' ? (session?.currentProvider?.uuid ?? '') : ''),
      appointmentNote: appointment?.comments || '',
      appointmentType: existingAppointmentType,
      selectedService: appointment?.service?.uuid || '',
      selectedServiceType: appointment?.serviceType?.uuid ?? '',
      recurringPatternType: defaultRecurringPatternType,
      recurringPatternPeriod: defaultRecurringPatternPeriod,
      recurringPatternDaysOfWeek: defaultRecurringPatternDaysOfWeek,
      startTime: defaultAppointmentStartTime,
      duration: defaultDuration ?? null,
      timeFormat: defaultTimeFormat,
      appointmentDateTime: {
        startDate: defaultStartDate,
        startDateText: defaultStartDateText,
        recurringPatternEndDate: defaultEndDate,
        recurringPatternEndDateText: defaultEndDateText,
      },
      formIsRecurringAppointment: isRecurringAppointment,
      dateAppointmentScheduled: defaultDateAppointmentScheduled,
    },
  });

  const selectedServiceUuid = watch('selectedService');
  const selectedServiceDefinition = availableServices.find((service) => service.uuid === selectedServiceUuid);
  const serviceTypeOptions = [...(selectedServiceDefinition?.serviceTypes ?? [])];
  if (
    appointment?.serviceType &&
    appointment.service.uuid === selectedServiceUuid &&
    !serviceTypeOptions.some((serviceType) => serviceType.uuid === appointment.serviceType.uuid)
  ) {
    serviceTypeOptions.unshift(appointment.serviceType);
  }

  useEffect(
    () =>
      setValue('formIsRecurringAppointment', isRecurringAppointment, {
        shouldValidate: true,
      }),
    [isRecurringAppointment, setValue],
  );

  // Retrive ref callback for appointmentDateTime (startDate & recurringPatternEndDate)
  const {
    field: { ref: startDateRef },
  } = useController({ name: 'appointmentDateTime.startDate', control });
  const {
    field: { ref: endDateRef },
  } = useController({
    name: 'appointmentDateTime.recurringPatternEndDate',
    control,
  });

  // Manually call ref callback from 'react-hook-form' with the element(s) we want to be focused
  useEffect(() => {
    const startDateElement = document.getElementById('startDatePickerInput');
    const endDateElement = document.getElementById('endDatePickerInput');
    startDateRef(startDateElement);
    endDateRef(endDateElement);
  }, [startDateRef, endDateRef]);

  useEffect(() => {
    if (isSuccessful) {
      reset();
      promptBeforeClosing?.(() => false);
      Promise.resolve(closeWorkspace({ discardUnsavedChanges: true })).catch(() => {
        showSnackbar({
          kind: 'warning',
          title: t('appointmentSavedWorkspaceOpen', 'La cita ya fue guardada'),
          subtitle: t(
            'appointmentSavedWorkspaceOpenSubtitle',
            'No se pudo cerrar el formulario. No vuelva a guardar; revise la cita en la lista.',
          ),
        });
      });
      return;
    }
    promptBeforeClosing?.(() => isDirty);
  }, [isDirty, promptBeforeClosing, isSuccessful, reset, closeWorkspace, t]);

  const handleWorkloadDateChange = (date: Date) => {
    const appointmentDate = getValues('appointmentDateTime');
    setValue('appointmentDateTime', { ...appointmentDate, startDate: date });
  };

  const handleSelectChange = (e) => {
    const daysText =
      e?.selectedItems?.length < 1
        ? t('daysOfWeek', 'Days of the week')
        : e.selectedItems.map((weekDay) => weekDay.label).join(', ');
    setValue('selectedDaysOfWeekText', daysText);
    setValue(
      'recurringPatternDaysOfWeek',
      e.selectedItems.map((s) => s.id),
    );
  };

  const selectedDays = getValues('recurringPatternDaysOfWeek') ?? [];
  const defaultSelectedDaysOfWeekText: string =
    selectedDays.length < 1
      ? t('daysOfWeek', 'Days of the week')
      : weekDays
          .filter((weekDay) => selectedDays.includes(weekDay.id))
          .map((weekDay) => weekDay.label)
          .join(', ');

  const validateAppointmentIsStillEditable = async () => {
    if (context !== 'editing') {
      return true;
    }

    try {
      const currentStatus = await getAppointmentStatus(appointment.uuid);
      if (!isAppointmentEditable(currentStatus)) {
        throw Object.assign(new Error('The appointment status no longer permits editing.'), {
          code: APPOINTMENT_EDIT_STATUS_CONFLICT,
        });
      }
      return true;
    } catch (error) {
      showSnackbar({
        title: t('appointmentEditError', 'Error editing appointment'),
        kind: 'error',
        isLowContrast: false,
        subtitle: getUserFacingErrorMessage(
          error,
          t(
            'appointmentEditStatusCheckFailed',
            'No se pudo verificar el estado actual de la cita. Intente nuevamente.',
          ),
          {
            codeMessages: {
              [APPOINTMENT_EDIT_STATUS_CONFLICT]: t(
                'appointmentEditStatusChanged',
                'El estado de la cita cambió y ya no permite editarla. Actualice la lista.',
              ),
            },
            logContext: 'Validate appointment status before editing',
          },
        ),
      });
      return false;
    }
  };

  // Same for creating and editing
  const handleSaveAppointment = async (data: AppointmentFormData) => {
    if (saveAttemptInFlightRef.current || isSuccessful || isSaveOutcomeAmbiguous) {
      return;
    }
    saveAttemptInFlightRef.current = true;
    const releaseSaveAttempt = () => {
      saveAttemptInFlightRef.current = false;
      setIsSubmitting(false);
    };

    const patientIdentityIsVerified = Boolean(patientUuid?.trim() && patient?.id === patientUuid);
    const serviceIsVerified = availableServices.some((service) => service.uuid === data.selectedService);
    const locationIsVerified = locations.some((location) => location.uuid === data.location);
    const providerIsVerified = providerOptions.some((provider) => provider.uuid === data.provider);
    if (
      patientIsLoading ||
      patientError ||
      !patientIdentityIsVerified ||
      servicesError ||
      !serviceIsVerified ||
      !locationIsVerified ||
      providers.isLoading ||
      providers.error ||
      !providerIsVerified
    ) {
      showSnackbar({
        title:
          context === 'editing'
            ? t('appointmentEditError', 'Error editing appointment')
            : t('appointmentFormError', 'Error scheduling appointment'),
        kind: 'error',
        isLowContrast: false,
        subtitle: t(
          'appointmentCatalogVerificationFailed',
          'No se pudo verificar el paciente, la sede, el servicio o el proveedor con los catálogos vigentes. Actualice el formulario antes de guardar.',
        ),
      });
      releaseSaveAttempt();
      return;
    }

    setIsSubmitting(true);
    let appointmentPayload: AppointmentPayload;
    let recurringAppointmentPayload: {
      appointmentRequest: AppointmentPayload;
      recurringPattern: RecurringPattern;
    };

    try {
      appointmentPayload = constructAppointmentPayload(data);
      recurringAppointmentPayload = {
        appointmentRequest: appointmentPayload,
        recurringPattern: constructRecurringPattern(data),
      };
    } catch (error) {
      releaseSaveAttempt();
      showSnackbar({
        title:
          context === 'editing'
            ? t('appointmentEditError', 'Error editing appointment')
            : t('appointmentFormError', 'Error scheduling appointment'),
        kind: 'error',
        isLowContrast: false,
        subtitle: getUserFacingErrorMessage(
          error,
          t(
            'appointmentPayloadValidationFailed',
            'No se pudieron validar los datos de la cita. Revise el registro e intente nuevamente.',
          ),
          { logContext: 'Construct appointment payload' },
        ),
      });
      return;
    }

    if (!(await validateAppointmentIsStillEditable())) {
      releaseSaveAttempt();
      return;
    }

    // check if Duplicate Response Occurs
    let response: FetchResponse;
    try {
      response = isRecurringAppointment
        ? await checkRecurringAppointmentConflict(recurringAppointmentPayload)
        : await checkAppointmentConflict(appointmentPayload);
    } catch (error) {
      releaseSaveAttempt();
      showSnackbar({
        title:
          context === 'editing'
            ? t('appointmentEditError', 'Error editing appointment')
            : t('appointmentFormError', 'Error scheduling appointment'),
        kind: 'error',
        isLowContrast: false,
        subtitle: getUserFacingErrorMessage(
          error,
          t('appointmentConflictCheckError', 'No se pudieron verificar los conflictos de la cita. Intente nuevamente.'),
          { logContext: 'Check appointment conflicts' },
        ),
      });
      return;
    }

    if (response?.status === 200 && isConflictMap(response.data)) {
      const errorMessage = getConflictErrorMessage(response.data, t);
      if (errorMessage) {
        releaseSaveAttempt();
        showSnackbar({
          isLowContrast: true,
          kind: 'error',
          title: errorMessage,
        });
        return;
      }
    } else if (response?.status !== 204) {
      releaseSaveAttempt();
      showSnackbar({
        title:
          context === 'editing'
            ? t('appointmentEditError', 'Error editing appointment')
            : t('appointmentFormError', 'Error scheduling appointment'),
        kind: 'error',
        isLowContrast: false,
        subtitle: t(
          'appointmentConflictCheckError',
          'No se pudieron verificar los conflictos de la cita. Intente nuevamente.',
        ),
      });
      return;
    }

    // Narrow the race between conflict validation and persistence. The backend API has no status CAS,
    // so re-read immediately before the update and fail closed if check-in happened meanwhile.
    if (!(await validateAppointmentIsStillEditable())) {
      releaseSaveAttempt();
      return;
    }

    let creationAttemptId: string | undefined;
    if (context !== 'editing') {
      const checkpointPayload = isRecurringAppointment ? recurringAppointmentPayload : appointmentPayload;
      const payloadFingerprint = await fingerprintAppointmentCreationPayload(checkpointPayload);
      const attemptId = globalThis.crypto?.randomUUID?.();
      const hasAuthenticatedUserAndPatient = Boolean(session?.user?.uuid?.trim() && patientUuid?.trim());

      if (!payloadFingerprint || !attemptId || !hasAuthenticatedUserAndPatient) {
        releaseSaveAttempt();
        showSnackbar({
          title: t('appointmentFormError', 'Error scheduling appointment'),
          kind: 'error',
          isLowContrast: false,
          subtitle: t(
            'appointmentCreationCheckpointUnavailable',
            'No se pudo preparar un guardado seguro en este navegador. Verifique la sesión y habilite el almacenamiento antes de guardar.',
          ),
        });
        return;
      }

      if (
        !saveAppointmentCreationCheckpoint(
          {
            version: 1,
            state: 'create-pending',
            attemptId,
            createdAt: Date.now(),
            payloadFingerprint,
            recurring: isRecurringAppointment,
          },
          patientUuid ?? '',
        )
      ) {
        let hasPendingCheckpoint = false;
        try {
          hasPendingCheckpoint = Boolean(loadAppointmentCreationCheckpoint(patientUuid ?? ''));
        } catch {
          hasPendingCheckpoint = true;
        }

        if (hasPendingCheckpoint) {
          setIsSubmitting(false);
          setIsSaveOutcomeAmbiguous(true);
          const checkpointMessage = t(
            'appointmentCreationCheckpointPending',
            'Hay una creación de cita pendiente para este paciente. No vuelva a guardar hasta verificar la lista de citas; si requiere liberarla, cierre esta pestaña después de la verificación.',
          );
          setSaveOutcomeSafetyMessage(checkpointMessage);
          showSnackbar({
            title: t('appointmentFormError', 'Error scheduling appointment'),
            kind: 'warning',
            isLowContrast: false,
            subtitle: checkpointMessage,
          });
        } else {
          releaseSaveAttempt();
          showSnackbar({
            title: t('appointmentFormError', 'Error scheduling appointment'),
            kind: 'error',
            isLowContrast: false,
            subtitle: t(
              'appointmentCreationCheckpointUnavailable',
              'No se pudo preparar un guardado seguro en este navegador. Verifique la sesión y habilite el almacenamiento antes de guardar.',
            ),
          });
        }
        return;
      }
      creationAttemptId = attemptId;
    }

    const abortController = new AbortController();

    try {
      const saveResponse = isRecurringAppointment
        ? await saveRecurringAppointments(recurringAppointmentPayload, abortController)
        : await saveAppointment(appointmentPayload, abortController);

      if (
        !isConfirmedAppointmentSaveResponse(
          saveResponse,
          appointmentPayload,
          isRecurringAppointment ? recurringAppointmentPayload.recurringPattern : undefined,
        )
      ) {
        const emptyRecurringResponse = isDefinitiveEmptyRecurringSaveResponse(saveResponse, isRecurringAppointment);
        throw Object.assign(new Error('The appointment save response did not confirm the requested write.'), {
          status: emptyRecurringResponse ? 422 : saveResponse.status,
          ...(emptyRecurringResponse ? { code: APPOINTMENT_RECURRING_EMPTY } : {}),
        });
      }

      if (creationAttemptId && !clearAppointmentCreationCheckpoint(creationAttemptId, patientUuid ?? '')) {
        const checkpointMessage = t(
          'appointmentCreationCheckpointClearFailed',
          'La cita fue guardada, pero no se pudo cerrar su control de seguridad. No cree otra cita hasta verificar la lista y actualizar la pantalla.',
        );
        logError(new Error('The confirmed appointment creation checkpoint could not be cleared.'), 'Save appointment');
        setIsSubmitting(false);
        setIsSaveOutcomeAmbiguous(true);
        setSaveOutcomeSafetyMessage(checkpointMessage);
        setIsSuccessful(true);
        showSnackbar({
          title: t('appointmentScheduled', 'Appointment scheduled'),
          kind: 'warning',
          isLowContrast: false,
          subtitle: checkpointMessage,
        });
        try {
          await mutateAppointments();
        } catch (error) {
          logError(error, 'Refresh appointments after confirmed save');
        }
        return;
      }

      setIsSubmitting(false);
      setIsSuccessful(true);
      showSnackbar({
        isLowContrast: true,
        kind: 'success',
        subtitle: t('appointmentNowVisible', 'It is now visible on the Appointments page'),
        title:
          context === 'editing'
            ? t('appointmentEdited', 'Appointment edited')
            : t('appointmentScheduled', 'Appointment scheduled'),
      });

      try {
        await mutateAppointments();
      } catch {
        showSnackbar({
          kind: 'warning',
          title: t('appointmentSavedRefreshFailed', 'La cita ya fue guardada'),
          subtitle: t(
            'appointmentSavedRefreshFailedSubtitle',
            'No se pudo actualizar la lista. No vuelva a guardar; recargue la lista de citas.',
          ),
        });
      }
    } catch (error) {
      setIsSubmitting(false);
      const definitiveRejection = isDefinitiveAppointmentSaveRejection(error);
      const checkpointWasCleared =
        definitiveRejection && creationAttemptId
          ? clearAppointmentCreationCheckpoint(creationAttemptId, patientUuid ?? '')
          : definitiveRejection;
      const outcomeSafetyMessage = definitiveRejection
        ? t(
            'appointmentRejectedCheckpointClearFailed',
            'La cita no fue guardada, pero no se pudo cerrar su control de seguridad. No reintente hasta actualizar la pantalla.',
          )
        : t(
            'appointmentSaveOutcomeUnknown',
            'No se pudo confirmar si la cita fue guardada. No vuelva a enviarla; verifique primero la lista de citas.',
          );
      if (checkpointWasCleared) {
        saveAttemptInFlightRef.current = false;
      } else {
        setIsSaveOutcomeAmbiguous(true);
        setSaveOutcomeSafetyMessage(outcomeSafetyMessage);
        logError(error, 'Save appointment outcome requires verification');
      }

      showSnackbar({
        title:
          context === 'editing'
            ? t('appointmentEditError', 'Error editing appointment')
            : t('appointmentFormError', 'Error scheduling appointment'),
        kind: checkpointWasCleared ? 'error' : 'warning',
        isLowContrast: false,
        subtitle: checkpointWasCleared
          ? getUserFacingErrorMessage(
              error,
              t('appointmentSaveRejected', 'La cita no fue guardada. Revise los datos antes de volver a intentar.'),
              {
                codeMessages: {
                  [APPOINTMENT_RECURRING_EMPTY]: t(
                    'appointmentRecurringSaveEmpty',
                    'No se generó ninguna cita recurrente. Revise la fecha de inicio, el fin y el patrón antes de reintentar.',
                  ),
                },
                logContext: 'Save appointment rejected',
              },
            )
          : outcomeSafetyMessage,
      });
    }
  };

  const constructAppointmentPayload = (data: AppointmentFormData): AppointmentPayload => {
    const {
      selectedService,
      startTime,
      timeFormat,
      appointmentDateTime: { startDate },
      duration,
      appointmentType: selectedAppointmentType,
      selectedServiceType,
      location,
      provider,
      appointmentNote,
      dateAppointmentScheduled,
    } = data;

    const selectedAppointmentService = availableServices.find((service) => service.uuid === selectedService);
    const existingProviders =
      appointment?.providers?.filter(shouldPreserveAppointmentProvider).map((existingProvider) => ({
        uuid: existingProvider.uuid,
        ...(existingProvider.response ? { response: existingProvider.response } : {}),
        ...(existingProvider.comments ? { comments: existingProvider.comments } : {}),
        ...(existingProvider.name ? { name: existingProvider.name } : {}),
      })) ?? [];
    const selectedExistingProvider = existingProviders.find((existingProvider) => existingProvider.uuid === provider);
    const selectedProviders =
      context === 'editing' && provider === currentPrimaryProviderUuid
        ? existingProviders
        : [
            ...existingProviders.filter(
              (existingProvider) =>
                existingProvider.uuid !== currentPrimaryProviderUuid && existingProvider.uuid !== provider,
            ),
            selectedExistingProvider
              ? { ...selectedExistingProvider, response: 'ACCEPTED' as const }
              : { uuid: provider },
          ];
    const [hourValue, minuteValue] = startTime.split(':').map((item) => parseInt(item, 10));
    const hours = (hourValue % 12) + (timeFormat === 'PM' ? 12 : 0);
    const startDateTime = isAllDayAppointment
      ? dayjs(startDate).startOf('day')
      : dayjs(startDate).hour(hours).minute(minuteValue).second(0).millisecond(0);
    const endDateTime = isAllDayAppointment
      ? dayjs(startDate).endOf('day')
      : startDateTime.add(duration ?? 0, 'minutes');
    const effectiveDateAppointmentScheduled = resolveAppointmentIssuedDate(
      canEditAppointmentIssuedDate,
      dateAppointmentScheduled,
      defaultDateAppointmentScheduled,
    );

    const payload: AppointmentPayload = {
      appointmentKind:
        context === 'editing' && selectedAppointmentType === existingAppointmentType
          ? appointment.appointmentKind
          : normalizeAppointmentKind(selectedAppointmentType),
      serviceUuid: selectedService,
      serviceTypeUuid: selectedServiceType || undefined,
      startDateTime: startDateTime.format(),
      endDateTime: endDateTime.format(),
      locationUuid: location,
      providers: selectedProviders,
      patientUuid: patientUuid,
      comments: appointmentNote,
      uuid: context === 'editing' ? appointment.uuid : undefined,
      dateAppointmentScheduled: dayjs(effectiveDateAppointmentScheduled).format(),
    };

    if (context === 'creating') {
      payload.status = getInitialAppointmentStatus(selectedAppointmentService?.initialAppointmentStatus);
    }

    return payload;
  };

  const constructRecurringPattern = (data: AppointmentFormData): RecurringPattern => {
    const {
      appointmentDateTime: { recurringPatternEndDate },
      recurringPatternType,
      recurringPatternPeriod,
      recurringPatternDaysOfWeek,
    } = data;

    const [hours, minutes] = [23, 59];
    const endDate = recurringPatternEndDate ? new Date(recurringPatternEndDate) : null;
    endDate?.setHours(hours, minutes);

    return {
      type: recurringPatternType,
      period: recurringPatternPeriod ?? 1,
      endDate: endDate ? dayjs(endDate).format() : null,
      daysOfWeek: recurringPatternDaysOfWeek,
    };
  };

  if (isLoading)
    return (
      <Workspace2 title={title} hasUnsavedChanges={false}>
        <InlineLoading className={styles.loader} description={`${t('loading', 'Loading')} ...`} role="progressbar" />
      </Workspace2>
    );

  return (
    <Workspace2 title={title} hasUnsavedChanges={isDirty && !isSuccessful}>
      <Form onSubmit={handleSubmit(handleSaveAppointment)}>
        <Stack gap={4}>
          {isSaveOutcomeAmbiguous && (
            <InlineNotification
              className={styles.formErrorSummary}
              kind="warning"
              lowContrast={false}
              title={t('appointmentSavePendingVerificationTitle', 'Resultado pendiente de verificación')}
              subtitle={
                saveOutcomeSafetyMessage ??
                t(
                  'appointmentSaveOutcomeUnknown',
                  'No se pudo confirmar si la cita fue guardada. No vuelva a enviarla; verifique primero la lista de citas.',
                )
              }
            />
          )}
          {Object.keys(errors).length > 0 && (
            <InlineNotification
              className={styles.formErrorSummary}
              kind="error"
              lowContrast={false}
              title={t('appointmentFormValidationTitle', 'Revise los campos marcados')}
              subtitle={getAppointmentValidationSummary(errors, t)}
            />
          )}
          {patient && (
            <ExtensionSlot
              name="patient-header-slot"
              state={{
                patient,
                patientUuid: patientUuid,
                hideActionsOverflow: true,
              }}
            />
          )}
          <section className={styles.formGroup}>
            <span className={styles.heading}>{t('location', 'Location')}</span>
            <ResponsiveWrapper>
              <Controller
                name="location"
                control={control}
                render={({ field: { onChange, value, onBlur, ref } }) => (
                  <Select
                    id="location"
                    invalid={!!errors?.location}
                    invalidText={errors?.location?.message}
                    labelText={<RequiredFieldLabel label={t('selectALocation', 'Select a location')} />}
                    onChange={onChange}
                    onBlur={onBlur}
                    ref={ref}
                    value={value}
                  >
                    <SelectItem text={t('chooseLocation', 'Choose a location')} value="" />
                    {locations?.length > 0 &&
                      locations.map((location) => (
                        <SelectItem key={location.uuid} text={location.display} value={location.uuid}>
                          {location.display}
                        </SelectItem>
                      ))}
                  </Select>
                )}
              />
            </ResponsiveWrapper>
          </section>
          <section className={styles.formGroup}>
            <span className={styles.heading}>{t('service', 'Service')}</span>
            <ResponsiveWrapper>
              <Controller
                name="selectedService"
                control={control}
                render={({ field: { onBlur, onChange, value, ref } }) => (
                  <Select
                    id="service"
                    invalid={!!errors?.selectedService}
                    invalidText={errors?.selectedService?.message}
                    labelText={<RequiredFieldLabel label={t('selectService', 'Select a service')} />}
                    onBlur={onBlur}
                    onChange={(event) => {
                      const previousService = availableServices.find(
                        (service) => service.uuid === getValues('selectedService'),
                      );
                      const selectedService = availableServices.find((service) => service.uuid === event.target.value);
                      const previousConfiguredDuration = getConfiguredAppointmentDuration(
                        previousService,
                        getValues('selectedServiceType'),
                      );
                      if (!dirtyFields.duration && getValues('duration') === previousConfiguredDuration) {
                        setValue('duration', getConfiguredAppointmentDuration(selectedService));
                      }
                      if (event.target.value !== getValues('selectedService')) {
                        setValue('selectedServiceType', '', { shouldDirty: true, shouldValidate: true });
                      }
                      onChange(event);
                    }}
                    ref={ref}
                    value={value}
                  >
                    <SelectItem text={t('chooseService', 'Select service')} value="" />
                    {availableServices.map((service) => (
                      <SelectItem key={service.uuid} text={service.name} value={service.uuid}>
                        {service.name}
                      </SelectItem>
                    ))}
                  </Select>
                )}
              />
            </ResponsiveWrapper>
          </section>
          {serviceTypeOptions.length > 0 && (
            <section className={styles.formGroup}>
              <span className={styles.heading}>{t('serviceType', 'Service type')}</span>
              <ResponsiveWrapper>
                <Controller
                  name="selectedServiceType"
                  control={control}
                  render={({ field: { onBlur, onChange, value, ref } }) => (
                    <Select
                      id="serviceType"
                      invalid={!!errors?.selectedServiceType}
                      invalidText={errors?.selectedServiceType?.message}
                      labelText={t('selectServiceType', 'Select a service type')}
                      onBlur={onBlur}
                      onChange={(event) => {
                        const selectedServiceType = serviceTypeOptions.find(
                          (serviceType) => serviceType.uuid === event.target.value,
                        );
                        if (!dirtyFields.duration) {
                          setValue(
                            'duration',
                            selectedServiceType?.duration ??
                              getConfiguredAppointmentDuration(selectedServiceDefinition),
                          );
                        }
                        onChange(event);
                      }}
                      ref={ref}
                      value={value}
                    >
                      <SelectItem text={t('noServiceType', 'No service type')} value="" />
                      {serviceTypeOptions.map((serviceType) => (
                        <SelectItem key={serviceType.uuid} text={serviceType.name} value={serviceType.uuid}>
                          {serviceType.name}
                        </SelectItem>
                      ))}
                    </Select>
                  )}
                />
              </ResponsiveWrapper>
            </section>
          )}
          <section className={styles.formGroup}>
            <span className={styles.heading}>{t('appointmentType_title', 'Appointment Type')}</span>
            <ResponsiveWrapper>
              <Controller
                name="appointmentType"
                control={control}
                render={({ field: { onBlur, onChange, value, ref } }) => (
                  <Select
                    disabled={!appointmentTypeOptions.length}
                    id="appointmentType"
                    invalid={!!errors?.appointmentType}
                    invalidText={errors?.appointmentType?.message}
                    labelText={
                      <RequiredFieldLabel label={t('selectAppointmentType', 'Select the type of appointment')} />
                    }
                    onBlur={onBlur}
                    onChange={onChange}
                    ref={ref}
                    value={value}
                  >
                    <SelectItem text={t('chooseAppointmentType', 'Choose appointment type')} value="" />
                    {appointmentTypeOptions.length > 0 &&
                      appointmentTypeOptions.map((appointmentType) => (
                        <SelectItem key={appointmentType} text={appointmentType} value={appointmentType}>
                          {appointmentType}
                        </SelectItem>
                      ))}
                  </Select>
                )}
              />
            </ResponsiveWrapper>
          </section>

          {context === 'creating' && (
            <section className={styles.formGroup}>
              <span className={styles.heading}>{t('recurringAppointment', 'Recurring Appointment')}</span>
              <Toggle
                id="recurringToggle"
                labelB={t('yes', 'Yes')}
                labelA={t('no', 'No')}
                labelText={t('isRecurringAppointment', 'Is this a recurring appointment?')}
                onToggle={setIsRecurringAppointment}
                toggled={isRecurringAppointment}
              />
            </section>
          )}

          <section className={styles.formGroup}>
            <span className={styles.heading}>{t('dateTime', 'Date & Time')}</span>
            <div className={styles.dateTimeFields}>
              {isRecurringAppointment && (
                <div className={styles.inputContainer}>
                  {allowAllDayAppointments && (
                    <Toggle
                      id="allDayToggle"
                      labelB={t('yes', 'Yes')}
                      labelA={t('no', 'No')}
                      labelText={t('allDay', 'All day')}
                      onClick={() => setIsAllDayAppointment(!isAllDayAppointment)}
                      toggled={isAllDayAppointment}
                    />
                  )}
                  <ResponsiveWrapper>
                    <Controller
                      name="appointmentDateTime"
                      control={control}
                      render={({ field: { onChange, value }, fieldState }) => (
                        <div className={styles.dateTimeFields}>
                          <OpenmrsDatePicker
                            id="startDatePickerInput"
                            data-testid="startDatePickerInput"
                            invalid={Boolean(fieldState?.error?.message)}
                            invalidText={fieldState?.error?.message}
                            isReadOnly={!canEditAppointmentStartDate}
                            isRequired
                            labelText={<RequiredFieldLabel label={t('startDate', 'Start date')} />}
                            onChange={(startDate) => {
                              if (!canEditAppointmentStartDate || !startDate) {
                                return;
                              }
                              onChange({
                                startDate: new Date(startDate),
                                recurringPatternEndDate: value.recurringPatternEndDate,
                                recurringPatternEndDateText: value.recurringPatternEndDateText,
                                startDateText: dayjs(new Date(startDate)).format(dateFormat),
                              });
                            }}
                            value={value.startDate}
                          />
                          <OpenmrsDatePicker
                            id="endDatePickerInput"
                            invalid={Boolean(errors.appointmentDateTime?.recurringPatternEndDate)}
                            invalidText={errors.appointmentDateTime?.recurringPatternEndDate?.message}
                            labelText={t('endDate', 'End date')}
                            maxDate={dayjs(value.startDate).add(MAX_RECURRING_APPOINTMENT_HORIZON_DAYS, 'day').toDate()}
                            minDate={value.startDate}
                            onChange={(endDate) => {
                              onChange({
                                ...value,
                                recurringPatternEndDate: endDate ? new Date(endDate) : null,
                                recurringPatternEndDateText: endDate ? dayjs(new Date(endDate)).format(dateFormat) : '',
                              });
                            }}
                            value={value.recurringPatternEndDate ?? undefined}
                          />
                        </div>
                      )}
                    />
                  </ResponsiveWrapper>

                  {!isAllDayAppointment && <TimeAndDuration control={control} t={t} />}

                  <ResponsiveWrapper>
                    <Controller
                      name="recurringPatternPeriod"
                      control={control}
                      render={({ field: { onBlur, onChange, value } }) => (
                        <NumberInput
                          hideSteppers
                          id="repeatNumber"
                          min={1}
                          max={MAX_RECURRING_APPOINTMENT_HORIZON_DAYS}
                          invalid={Boolean(errors.recurringPatternPeriod)}
                          label={t('repeatEvery', 'Repeat every')}
                          invalidText={errors.recurringPatternPeriod?.message}
                          size="md"
                          value={value}
                          onKeyDown={preventInvalidIntegerKey({
                            integer: true,
                            max: MAX_RECURRING_APPOINTMENT_HORIZON_DAYS,
                            min: 1,
                            nonNegative: true,
                          })}
                          onPaste={preventInvalidIntegerPaste({
                            integer: true,
                            max: MAX_RECURRING_APPOINTMENT_HORIZON_DAYS,
                            min: 1,
                            nonNegative: true,
                          })}
                          onBlur={onBlur}
                          onChange={(_event, { value: nextValue }) => {
                            onChange(
                              getIntegerValue(nextValue, {
                                integer: true,
                                max: MAX_RECURRING_APPOINTMENT_HORIZON_DAYS,
                                min: 1,
                                nonNegative: true,
                              }),
                            );
                          }}
                        />
                      )}
                    />
                  </ResponsiveWrapper>

                  <ResponsiveWrapper>
                    <Controller
                      name="recurringPatternType"
                      control={control}
                      render={({ field: { onChange, value } }) => (
                        <RadioButtonGroup
                          legendText={t('period', 'Period')}
                          name="radio-button-group"
                          onChange={(type) => onChange(type)}
                          valueSelected={value}
                        >
                          <RadioButton labelText={t('day', 'Day')} value="DAY" id="radioDay" />
                          <RadioButton labelText={t('week', 'Week')} value="WEEK" id="radioWeek" />
                        </RadioButtonGroup>
                      )}
                    />
                  </ResponsiveWrapper>

                  {watch('recurringPatternType') === 'WEEK' && (
                    <div>
                      <Controller
                        name="selectedDaysOfWeekText"
                        control={control}
                        defaultValue={defaultSelectedDaysOfWeekText}
                        render={({ field: { onChange } }) => (
                          <MultiSelect
                            className={styles.weekSelect}
                            id="daysOfWeek"
                            invalid={Boolean(errors.recurringPatternDaysOfWeek)}
                            invalidText={errors.recurringPatternDaysOfWeek?.message}
                            initialSelectedItems={weekDays.filter((i) =>
                              getValues('recurringPatternDaysOfWeek').includes(i.id),
                            )}
                            items={weekDays}
                            itemToString={(item) => (item ? t(item.labelCode, item.label) : '')}
                            label={getValues('selectedDaysOfWeekText')}
                            onChange={(e) => {
                              onChange(e);
                              handleSelectChange(e);
                            }}
                            selectionFeedback="top-after-reopen"
                            sortItems={(items) => [...items].sort((a, b) => a.order - b.order)}
                          />
                        )}
                      />
                    </div>
                  )}
                </div>
              )}

              {!isRecurringAppointment && (
                <div className={styles.inputContainer}>
                  {allowAllDayAppointments && (
                    <Toggle
                      id="allDayToggle"
                      labelB={t('yes', 'Yes')}
                      labelA={t('no', 'No')}
                      labelText={t('allDay', 'All day')}
                      onClick={() => setIsAllDayAppointment(!isAllDayAppointment)}
                      toggled={isAllDayAppointment}
                    />
                  )}
                  <ResponsiveWrapper>
                    <Controller
                      name="appointmentDateTime"
                      control={control}
                      render={({ field, fieldState }) => (
                        <OpenmrsDatePicker
                          {...field}
                          value={field.value.startDate}
                          onChange={(date) => {
                            field.onChange({
                              ...field.value,
                              startDate: date,
                            });
                          }}
                          id="datePickerInput"
                          data-testid="datePickerInput"
                          isReadOnly={!canEditAppointmentStartDate}
                          isRequired
                          labelText={<RequiredFieldLabel label={t('date', 'Date')} />}
                          style={{ width: '100%' }}
                          invalid={Boolean(fieldState?.error?.message)}
                          invalidText={fieldState?.error?.message}
                          // minDate={new Date()}
                        />
                      )}
                    />
                  </ResponsiveWrapper>

                  {!isAllDayAppointment && <TimeAndDuration control={control} t={t} />}
                </div>
              )}
            </div>
          </section>

          {getValues('selectedService') && (
            <section className={styles.formGroup}>
              <ResponsiveWrapper>
                <Workload
                  appointmentDate={watch('appointmentDateTime').startDate}
                  onWorkloadDateChange={handleWorkloadDateChange}
                  selectedServiceUuid={watch('selectedService')}
                />
              </ResponsiveWrapper>
            </section>
          )}

          <section className={styles.formGroup}>
            <span className={styles.heading}>{t('responsibleProvider', 'Responsible provider')}</span>
            <ResponsiveWrapper>
              <Controller
                name="provider"
                control={control}
                render={({ field: { onChange, value, onBlur, ref } }) => (
                  <Select
                    id="provider"
                    invalid={Boolean(errors.provider)}
                    invalidText={errors.provider?.message}
                    labelText={<RequiredFieldLabel label={t('selectProvider', 'Select a provider')} />}
                    onChange={onChange}
                    onBlur={onBlur}
                    value={value}
                    ref={ref}
                  >
                    <SelectItem text={t('chooseProvider', 'Choose a provider')} value="" />
                    {providerOptions.map((provider) => (
                      <SelectItem key={provider.uuid} text={provider.display} value={provider.uuid}>
                        {provider.display}
                      </SelectItem>
                    ))}
                  </Select>
                )}
              />
            </ResponsiveWrapper>
          </section>
          <section className={styles.formGroup}>
            <span className={styles.heading}>{t('dateScheduled', 'Date appointment issued')}</span>
            <ResponsiveWrapper>
              <Controller
                name="dateAppointmentScheduled"
                control={control}
                render={({ field, fieldState }) => (
                  <div style={{ width: '100%' }}>
                    <OpenmrsDatePicker
                      {...field}
                      invalid={Boolean(fieldState?.error?.message)}
                      invalidText={fieldState?.error?.message}
                      maxDate={new Date()}
                      id="dateAppointmentScheduledPickerInput"
                      data-testid="dateAppointmentScheduledPickerInput"
                      isReadOnly={!canEditAppointmentIssuedDate}
                      labelText={t('dateScheduledDetail', 'Date appointment issued')}
                      style={{ width: '100%' }}
                    />
                  </div>
                )}
              />
            </ResponsiveWrapper>
          </section>

          <section className={styles.formGroup}>
            <span className={styles.heading}>{t('note', 'Note')}</span>
            <ResponsiveWrapper>
              <Controller
                name="appointmentNote"
                control={control}
                render={({ field: { onChange, onBlur, value, ref } }) => (
                  <TextArea
                    id="appointmentNote"
                    value={value}
                    enableCounter
                    maxCount={appointmentNoteMaxLength}
                    maxLength={appointmentNoteMaxLength}
                    labelText={t('appointmentNoteLabel', 'Write an additional note')}
                    placeholder={t('appointmentNotePlaceholder', 'Write any additional points here')}
                    onChange={onChange}
                    onBlur={onBlur}
                    ref={ref}
                  />
                )}
              />
            </ResponsiveWrapper>
          </section>
        </Stack>
        <ButtonSet className={isTablet ? styles.tablet : styles.desktop}>
          <Button className={styles.button} onClick={() => closeWorkspace()} kind="secondary">
            {t('discard', 'Discard')}
          </Button>
          <Button
            className={styles.button}
            disabled={isSubmitting || isSaveOutcomeAmbiguous || isSuccessful}
            type="submit"
          >
            {t('saveAndClose', 'Save and close')}
          </Button>
        </ButtonSet>
      </Form>
    </Workspace2>
  );
};

export function TimeAndDuration({ t, control }) {
  return (
    <>
      <ResponsiveWrapper>
        <Controller
          name="startTime"
          control={control}
          render={({ field: { onChange, value }, fieldState }) => (
            <TimePicker
              id="time-picker"
              pattern={time12HourFormatRegexPattern}
              invalid={Boolean(fieldState.error)}
              invalidText={fieldState.error?.message}
              labelText={<RequiredFieldLabel label={t('time', 'Time')} />}
              onChange={(event) => {
                onChange(event.target.value);
              }}
              style={{ marginLeft: '0.125rem', flex: 'none' }}
              value={value}
            >
              <Controller
                name="timeFormat"
                control={control}
                render={({ field: { value, onChange } }) => (
                  <TimePickerSelect
                    id="time-picker-select-1"
                    onChange={(event) => onChange(event.target.value as 'AM' | 'PM')}
                    value={value}
                    aria-label={t('time', 'Time')}
                  >
                    <SelectItem value="AM" text="AM" />
                    <SelectItem value="PM" text="PM" />
                  </TimePickerSelect>
                )}
              />
            </TimePicker>
          )}
        />
      </ResponsiveWrapper>
      <ResponsiveWrapper>
        <Controller
          name="duration"
          control={control}
          render={({ field: { onChange, onBlur, value, ref }, fieldState }) => (
            <NumberInput
              disableWheel
              hideSteppers
              id="duration"
              invalid={Boolean(fieldState.error)}
              invalidText={fieldState.error?.message}
              label={<RequiredFieldLabel label={t('durationInMinutes', 'Duration (minutes)')} />}
              max={1440}
              min={0}
              onBlur={onBlur}
              onKeyDown={preventInvalidIntegerKey({
                integer: true,
                max: 1440,
                min: 0,
                nonNegative: true,
              })}
              onPaste={preventInvalidIntegerPaste({
                integer: true,
                max: 1440,
                min: 0,
                nonNegative: true,
              })}
              onChange={(_event, { value: nextValue }) =>
                onChange(
                  nextValue === '' || nextValue === undefined
                    ? null
                    : getIntegerValue(nextValue, {
                        integer: true,
                        max: 1440,
                        min: 0,
                        nonNegative: true,
                      }),
                )
              }
              ref={ref}
              size="md"
              value={value ?? ''}
            />
          )}
        />
      </ResponsiveWrapper>
    </>
  );
}

function getAppointmentValidationSummary(
  errors: Record<string, unknown>,
  t: (key: string, fallback: string) => string,
) {
  const labels: Record<string, string> = {
    location: t('location', 'Ubicación'),
    selectedService: t('service', 'Servicio'),
    appointmentType: t('appointmentType', 'Tipo de cita'),
    provider: t('responsibleProvider', 'Personal de salud responsable'),
    startTime: t('time', 'Hora'),
    duration: t('duration', 'Duración'),
    dateAppointmentScheduled: t('dateScheduled', 'Fecha de emisión de la cita'),
  };

  return Object.entries(errors)
    .map(([key, error]) => {
      const message =
        error && typeof error === 'object' && 'message' in error
          ? String((error as { message?: unknown }).message ?? '')
          : '';
      return message ? `${labels[key] ?? key}: ${message}` : null;
    })
    .filter(Boolean)
    .join(' • ');
}

export default AppointmentsForm;
