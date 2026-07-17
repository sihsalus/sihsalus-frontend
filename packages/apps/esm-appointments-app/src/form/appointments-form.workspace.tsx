import {
  Button,
  ButtonSet,
  DatePicker,
  DatePickerInput,
  Form,
  InlineLoading,
  InlineNotification,
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
  OpenmrsDatePicker,
  ResponsiveWrapper,
  showSnackbar,
  translateFrom,
  useConfig,
  useLayoutType,
  useLocations,
  usePatient,
  userHasAccess,
  useSession,
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
import React, { useContext, useEffect, useState } from 'react';
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
  datePickerFormat,
  datePickerPlaceHolder,
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
  AppointmentStatus,
  type RecurringPattern,
} from '../types';
import Workload from '../workload/workload.component';
//TO DO FIX THIS SHIT
import {
  checkAppointmentConflict,
  saveAppointment,
  saveRecurringAppointments,
  useAppointmentService,
  useMutateAppointments,
} from './appointments-form.resource';
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
  responseData: Record<string, unknown> | null | undefined,
  t: (key: string, defaultValue: string) => string,
): string | null {
  if (!responseData) {
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
const APPOINTMENT_EDIT_STATUS_CONFLICT = 'APPOINTMENT_EDIT_STATUS_CONFLICT';

const time12HourFormatRegexPattern = '^(1[0-2]|0?[1-9]):[0-5][0-9]$';

// Same visual convention as patient registration: a red asterisk on required fields.
function RequiredFieldLabel({ label }: { label: string }) {
  return <span className={styles.requiredLabel}>{label}</span>;
}

const isValidTime = (timeStr: string) => timeStr.match(new RegExp(time12HourFormatRegexPattern));

const isSuccessfulAppointmentResponse = (status?: number) => status >= 200 && status < 300 && status !== 204;

function resolveAppointmentIssuedDate(
  canEditIssuedDate: boolean,
  submittedDate: Date | undefined,
  originalDate: Date,
): Date {
  return canEditIssuedDate && submittedDate ? submittedDate : originalDate;
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

  return appointmentTypes.find((type) => normalizeAppointmentKind(type) === appointmentKind) ?? '';
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
  const { patient } = usePatient(patientUuid);
  const { mutateAppointments } = useMutateAppointments();
  const { t } = useTranslation();
  const isTablet = useLayoutType() === 'tablet';
  const locations = useLocations(appointmentLocationTagName);
  const providers = useProviders();
  const session = useSession();
  const canEditAppointmentIssuedDate = userHasAccess(appointmentIssuedDateEditPrivilege, session?.user);
  const canEditAppointmentStartDate = userHasAccess(appointmentStartDateEditPrivilege, session?.user);
  const { selectedDate } = useContext(SelectedDateContext);
  const { data: services, isLoading } = useAppointmentService();
  const { appointmentTypes, allowAllDayAppointments } = useConfig<ConfigObject>();
  const mappedAppointmentTypes = appointmentTypes ?? [];
  const title =
    workspaceTitle ??
    (context === 'editing'
      ? t('editAppointment', 'Edit appointment')
      : t('createNewAppointment', 'Create new appointment'));

  const [isRecurringAppointment, setIsRecurringAppointment] = useState(false);
  const [isAllDayAppointment, setIsAllDayAppointment] = useState(false);
  const [isSuccessful, setIsSuccessful] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        message: translateFrom(moduleName, 'locationRequired', 'UPSS is required'),
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
      recurringPatternType: z.enum(['DAY', 'WEEK']),
      recurringPatternPeriod: z.number(),
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
      dateAppointmentScheduled: z.date().optional(),
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
    );

  type AppointmentFormData = z.infer<typeof appointmentsFormSchema>;

  const defaultDateAppointmentScheduled = appointment?.dateAppointmentScheduled
    ? new Date(appointment?.dateAppointmentScheduled)
    : new Date();

  const {
    control,
    getValues,
    setValue,
    watch,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<AppointmentFormData>({
    // Validate required fields on submit so opening an asynchronously populated
    // selector does not show an error before the user has attempted to save.
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    resolver: zodResolver(appointmentsFormSchema),
    defaultValues: {
      location: appointment?.location?.uuid ?? '',
      provider:
        appointment?.providers?.find((provider) => provider.response === 'ACCEPTED')?.uuid ??
        session?.currentProvider?.uuid ??
        '', // assumes only a single previously-scheduled provider with state "ACCEPTED", if multiple, just takes the first
      appointmentNote: appointment?.comments || '',
      appointmentType: getAppointmentTypeFromKind(appointment?.appointmentKind, mappedAppointmentTypes),
      selectedService: appointment?.service?.name || '',
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

  useEffect(() => setValue('formIsRecurringAppointment', isRecurringAppointment), [isRecurringAppointment, setValue]);

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
      closeWorkspace({ discardUnsavedChanges: true });
      return;
    }
    promptBeforeClosing?.(() => isDirty);
  }, [isDirty, promptBeforeClosing, isSuccessful, reset, closeWorkspace]);

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
    setIsSubmitting(true);
    // Construct appointment payload
    const appointmentPayload = constructAppointmentPayload(data);

    if (!(await validateAppointmentIsStillEditable())) {
      setIsSubmitting(false);
      return;
    }

    // check if Duplicate Response Occurs
    let response: FetchResponse;
    try {
      response = await checkAppointmentConflict(appointmentPayload);
    } catch (error) {
      setIsSubmitting(false);
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

    const errorMessage = getConflictErrorMessage(response?.data, t);

    if (response.status === 200 && errorMessage) {
      setIsSubmitting(false);
      showSnackbar({
        isLowContrast: true,
        kind: 'error',
        title: errorMessage,
      });
      return;
    }

    // Narrow the race between conflict validation and persistence. The backend API has no status CAS,
    // so re-read immediately before the update and fail closed if check-in happened meanwhile.
    if (!(await validateAppointmentIsStillEditable())) {
      setIsSubmitting(false);
      return;
    }

    // Construct recurring pattern payload
    const recurringAppointmentPayload = {
      appointmentRequest: appointmentPayload,
      recurringPattern: constructRecurringPattern(data),
    };

    const abortController = new AbortController();

    (isRecurringAppointment
      ? saveRecurringAppointments(recurringAppointmentPayload, abortController)
      : saveAppointment(appointmentPayload, abortController)
    ).then(
      ({ status }) => {
        if (isSuccessfulAppointmentResponse(status)) {
          setIsSubmitting(false);
          setIsSuccessful(true);
          mutateAppointments();
          showSnackbar({
            isLowContrast: true,
            kind: 'success',
            subtitle: t('appointmentNowVisible', 'It is now visible on the Appointments page'),
            title:
              context === 'editing'
                ? t('appointmentEdited', 'Appointment edited')
                : t('appointmentScheduled', 'Appointment scheduled'),
          });
        }
        if (status === 204) {
          setIsSubmitting(false);
          showSnackbar({
            title:
              context === 'editing'
                ? t('appointmentEditError', 'Error editing appointment')
                : t('appointmentFormError', 'Error scheduling appointment'),
            kind: 'error',
            isLowContrast: false,
            subtitle: t('noContent', 'No Content'),
          });
        }
      },
      (error) => {
        setIsSubmitting(false);
        showSnackbar({
          title:
            context === 'editing'
              ? t('appointmentEditError', 'Error editing appointment')
              : t('appointmentFormError', 'Error scheduling appointment'),
          kind: 'error',
          isLowContrast: false,
          subtitle: getUserFacingErrorMessage(
            error,
            t('appointmentSaveFailed', 'No se pudo guardar la cita. Revise los datos e intente nuevamente.'),
            { logContext: 'Save appointment' },
          ),
        });
      },
    );
  };

  const constructAppointmentPayload = (data: AppointmentFormData): AppointmentPayload => {
    const {
      selectedService,
      startTime,
      timeFormat,
      appointmentDateTime: { startDate },
      duration,
      appointmentType: selectedAppointmentType,
      location,
      provider,
      appointmentNote,
      dateAppointmentScheduled,
    } = data;

    const selectedAppointmentService = services?.find((service) => service.name === selectedService);
    const serviceUuid = selectedAppointmentService?.uuid;
    const [hourValue, minuteValue] = startTime.split(':').map((item) => parseInt(item, 10));
    const hours = (hourValue % 12) + (timeFormat === 'PM' ? 12 : 0);
    const startDateTime = isAllDayAppointment
      ? dayjs(startDate).startOf('day')
      : dayjs(startDate).hour(hours).minute(minuteValue).second(0).millisecond(0);
    const endDateTime = isAllDayAppointment
      ? dayjs(startDate).endOf('day')
      : startDateTime.add(duration ?? 0, 'minutes');
    const effectiveDateAppointmentScheduled = resolveAppointmentIssuedDate(
      context !== 'editing' && canEditAppointmentIssuedDate,
      dateAppointmentScheduled,
      defaultDateAppointmentScheduled,
    );

    const payload: AppointmentPayload = {
      appointmentKind: normalizeAppointmentKind(selectedAppointmentType),
      serviceUuid: serviceUuid,
      startDateTime: startDateTime.format(),
      endDateTime: endDateTime.format(),
      locationUuid: location,
      providers: [{ uuid: provider }],
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
    const endDate = recurringPatternEndDate?.setHours(hours, minutes);

    return {
      type: recurringPatternType,
      period: recurringPatternPeriod,
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
            <span className={styles.heading}>{t('location', 'UPSS')}</span>
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
                      const selectedService = services?.find((service) => service.name === event.target.value);

                      if (context === 'creating') {
                        const selectedServiceDuration = selectedService?.durationMins;
                        setValue('duration', selectedServiceDuration ?? DEFAULT_APPOINTMENT_DURATION_MINUTES);
                      } else if (context === 'editing') {
                        const previousServiceDuration = services?.find(
                          (service) => service.name === getValues('selectedService'),
                        )?.durationMins;
                        const selectedServiceDuration = services?.find(
                          (service) => service.name === event.target.value,
                        )?.durationMins;
                        if (selectedServiceDuration && previousServiceDuration === getValues('duration')) {
                          setValue('duration', selectedServiceDuration);
                        }
                      }

                      if (selectedService?.location?.uuid) {
                        setValue('location', selectedService.location.uuid, {
                          shouldDirty: true,
                          shouldValidate: true,
                        });
                      }
                      onChange(event);
                    }}
                    ref={ref}
                    value={value}
                  >
                    <SelectItem text={t('chooseService', 'Select service')} value="" />
                    {services?.length > 0 &&
                      services.map((service) => (
                        <SelectItem key={service.uuid} text={service.name} value={service.name}>
                          {service.name}
                        </SelectItem>
                      ))}
                  </Select>
                )}
              />
            </ResponsiveWrapper>
          </section>
          <section className={styles.formGroup}>
            <span className={styles.heading}>{t('appointmentType_title', 'Appointment Type')}</span>
            <ResponsiveWrapper>
              <Controller
                name="appointmentType"
                control={control}
                render={({ field: { onBlur, onChange, value, ref } }) => (
                  <Select
                    disabled={!mappedAppointmentTypes?.length}
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
                    {mappedAppointmentTypes?.length > 0 &&
                      mappedAppointmentTypes.map((appointmentType) => (
                        <SelectItem key={appointmentType} text={appointmentType} value={appointmentType}>
                          {appointmentType}
                        </SelectItem>
                      ))}
                  </Select>
                )}
              />
            </ResponsiveWrapper>
          </section>

          <section className={styles.formGroup}>
            <span className={styles.heading}>{t('recurringAppointment', 'Recurring Appointment')}</span>
            <Toggle
              id="recurringToggle"
              labelB={t('yes', 'Yes')}
              labelA={t('no', 'No')}
              labelText={t('isRecurringAppointment', 'Is this a recurring appointment?')}
              onClick={() => setIsRecurringAppointment(!isRecurringAppointment)}
            />
          </section>

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
                      render={({ field: { onChange, value } }) => (
                        <ResponsiveWrapper>
                          <DatePicker
                            datePickerType="range"
                            dateFormat={datePickerFormat}
                            value={[value.startDate, value.recurringPatternEndDate]}
                            onChange={([startDate, endDate]) => {
                              onChange({
                                startDate: new Date(startDate),
                                recurringPatternEndDate: new Date(endDate),
                                recurringPatternEndDateText: dayjs(new Date(endDate)).format(dateFormat),
                                startDateText: dayjs(new Date(startDate)).format(dateFormat),
                              });
                            }}
                          >
                            <DatePickerInput
                              id="startDatePickerInput"
                              labelText={t('startDate', 'Start date')}
                              style={{ width: '100%' }}
                            />
                            <DatePickerInput
                              id="endDatePickerInput"
                              labelText={t('endDate', 'End date')}
                              style={{ width: '100%' }}
                              placeholder={datePickerPlaceHolder}
                            />
                          </DatePicker>
                        </ResponsiveWrapper>
                      )}
                    />
                  </ResponsiveWrapper>

                  {!isAllDayAppointment && (
                    <TimeAndDuration control={control} errors={errors} services={services} watch={watch} t={t} />
                  )}

                  <ResponsiveWrapper>
                    <Controller
                      name="recurringPatternPeriod"
                      control={control}
                      render={({ field: { onBlur, onChange, value } }) => (
                        <NumberInput
                          hideSteppers
                          id="repeatNumber"
                          min={1}
                          max={356}
                          label={t('repeatEvery', 'Repeat every')}
                          invalidText={t('invalidNumber', 'Number is not valid')}
                          size="md"
                          value={value}
                          onKeyDown={preventInvalidIntegerKey({
                            integer: true,
                            max: 356,
                            min: 1,
                            nonNegative: true,
                          })}
                          onPaste={preventInvalidIntegerPaste({
                            integer: true,
                            max: 356,
                            min: 1,
                            nonNegative: true,
                          })}
                          onBlur={onBlur}
                          onChange={(_event, { value: nextValue }) => {
                            onChange(
                              getIntegerValue(nextValue, {
                                integer: true,
                                max: 356,
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
                          labelText={<RequiredFieldLabel label={t('date', 'Date')} />}
                          style={{ width: '100%' }}
                          invalid={Boolean(fieldState?.error?.message)}
                          invalidText={fieldState?.error?.message}
                          // minDate={new Date()}
                        />
                      )}
                    />
                  </ResponsiveWrapper>

                  {!isAllDayAppointment && (
                    <TimeAndDuration control={control} services={services} watch={watch} t={t} errors={errors} />
                  )}
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
                  selectedService={watch('selectedService')}
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
                    invalid={!!errors?.provider}
                    invalidText={errors?.provider?.message}
                    labelText={<RequiredFieldLabel label={t('selectProvider', 'Select a provider')} />}
                    onChange={onChange}
                    onBlur={onBlur}
                    value={value}
                    ref={ref}
                  >
                    <SelectItem text={t('chooseProvider', 'Choose a provider')} value="" />
                    {providers?.providers?.length > 0 &&
                      providers?.providers?.map((provider) => (
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
                      isReadOnly={context === 'editing' || !canEditAppointmentIssuedDate}
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
          <Button className={styles.button} disabled={isSubmitting} type="submit">
            {t('saveAndClose', 'Save and close')}
          </Button>
        </ButtonSet>
      </Form>
    </Workspace2>
  );
};

function TimeAndDuration({ t, watch: _watch, control, services: _services, errors }) {
  return (
    <>
      <ResponsiveWrapper>
        <Controller
          name="startTime"
          control={control}
          render={({ field: { onChange, value } }) => (
            <TimePicker
              id="time-picker"
              pattern={time12HourFormatRegexPattern}
              invalid={!!errors?.startTime}
              invalidText={errors?.startTime?.message}
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
          render={({ field: { onChange, onBlur, value, ref } }) => (
            <NumberInput
              disableWheel
              hideSteppers
              id="duration"
              invalid={!!errors?.duration}
              invalidText={errors?.duration?.message}
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
    location: t('location', 'UPSS'),
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
