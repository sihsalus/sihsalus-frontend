import dayjs, { type Dayjs } from 'dayjs';

import { type AppointmentCountMap, AppointmentKind, AppointmentStatus, type AppointmentSummary } from '../types';

type AppointmentServiceLoadSummary = {
  serviceName: string;
  countMap: Array<AppointmentCountMap>;
};

export const getHighestAppointmentServiceLoad = (appointmentSummary: Array<AppointmentServiceLoadSummary> = []) => {
  const groupedAppointments = appointmentSummary?.map(({ countMap, serviceName }) => ({
    serviceName: serviceName,
    count: countMap.reduce((cummulator, currentValue) => cummulator + currentValue.allAppointmentsCount, 0),
  }));
  return groupedAppointments.find((summary) => summary.count === Math.max(...groupedAppointments.map((x) => x.count)));
};

export const flattenAppointmentSummary = (appointmentToTransfrom: Array<AppointmentSummary>) =>
  appointmentToTransfrom.flatMap((el) => ({
    serviceName: el.appointmentService.name ?? el.appointmentService.display,
    countMap: Object.values(el.appointmentCountMap),
  }));

export const getServiceCountByAppointmentType = (
  appointmentSummary: Array<AppointmentSummary>,
  appointmentType: keyof AppointmentCountMap,
) => {
  return appointmentSummary
    .map((el) => Object.values(el.appointmentCountMap).flatMap((entry) => entry[appointmentType] as number))
    .flat(1)
    .reduce((count, val) => count + val, 0);
};

export const formatAMPM = (date: Date) => {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  const minutesText = minutes < 10 ? `0${minutes}` : `${minutes}`;
  const strTime = hours + ':' + minutesText + ' ' + ampm;
  return strTime;
};

export const isSameMonth = (cellDate: Dayjs, currentDate: Dayjs) => {
  return cellDate.isSame(currentDate, 'month');
};

export const monthDays = (currentDate: Dayjs) => {
  const monthStart = dayjs(currentDate).startOf('month');
  const monthEnd = dayjs(currentDate).endOf('month');
  const monthDays = dayjs(currentDate).daysInMonth();
  const lastMonth = dayjs(currentDate).subtract(1, 'month');
  const nextMonth = dayjs(currentDate).add(1, 'month');
  const days: Dayjs[] = [];

  for (let i = lastMonth.daysInMonth() - monthStart.day() + 1; i <= lastMonth.daysInMonth(); i++) {
    days.push(dayjs().month(lastMonth.month()).date(i));
  }

  for (let i = 1; i <= monthDays; i++) {
    days.push(currentDate.date(i));
  }

  const dayLen = days.length > 30 ? 7 : 14;

  for (let i = 1; i < dayLen - monthEnd.day(); i++) {
    days.push(dayjs().month(nextMonth.month()).date(i));
  }
  return days;
};

export const getGender = (gender: string, t: (key: string, defaultValue: string) => string) => {
  switch (gender) {
    case 'M':
      return t('male', 'Male');
    case 'F':
      return t('female', 'Female');
    case 'O':
      return t('other', 'Other');
    case 'U':
      return t('unknown', 'Unknown');
    default:
      return gender;
  }
};

type GenderRestrictedAppointmentService = {
  uuid: string;
  name: string;
  gender?: string;
  allowedGenders?: Array<string>;
};

type AppointmentServiceGenderRule = {
  appointmentServiceUuid: string;
  allowedGenders: Array<string>;
};

const normalizeGender = (gender?: string): string | undefined => {
  const normalizedGender = gender?.trim().toLowerCase();

  if (!normalizedGender) return undefined;
  if (['f', 'female', 'femenino', 'mujer'].includes(normalizedGender)) return 'F';
  if (['m', 'male', 'masculino', 'hombre'].includes(normalizedGender)) return 'M';
  if (['o', 'other', 'otro'].includes(normalizedGender)) return 'O';
  if (['u', 'unknown', 'desconocido'].includes(normalizedGender)) return 'U';

  return undefined;
};

/**
 * Returns whether an appointment service is appropriate for the patient's gender.
 * Frontend configuration takes precedence over optional eligibility metadata
 * returned by the appointment service API. Unconfigured services are unrestricted.
 */
export const isAppointmentServiceAvailableForGender = (
  service: GenderRestrictedAppointmentService,
  patientGender?: string,
  configuredRules: Array<AppointmentServiceGenderRule> = [],
): boolean => {
  const configuredRule = configuredRules.find((rule) => rule.appointmentServiceUuid === service.uuid);
  const allowedGenders =
    configuredRule?.allowedGenders ?? service.allowedGenders ?? (service.gender ? [service.gender] : undefined);
  const normalizedPatientGender = normalizeGender(patientGender);

  if (allowedGenders?.length) {
    return (
      normalizedPatientGender !== undefined &&
      allowedGenders.some((gender) => normalizeGender(gender) === normalizedPatientGender)
    );
  }

  return true;
};

const allowedAppointmentStatusTransitions: Record<AppointmentStatus, ReadonlySet<AppointmentStatus>> = {
  [AppointmentStatus.REQUESTED]: new Set([AppointmentStatus.SCHEDULED, AppointmentStatus.CANCELLED]),
  // Appointments 2.1.0 requires the broad Reset Appointment Status privilege for WaitList -> Scheduled.
  // Keep this transition out of the routine UI until the backend offers a narrower authorization rule.
  [AppointmentStatus.WAITLIST]: new Set([AppointmentStatus.CANCELLED]),
  [AppointmentStatus.SCHEDULED]: new Set([
    AppointmentStatus.ARRIVED,
    AppointmentStatus.CHECKEDIN,
    AppointmentStatus.CANCELLED,
    AppointmentStatus.MISSED,
  ]),
  [AppointmentStatus.ARRIVED]: new Set([
    AppointmentStatus.CHECKEDIN,
    AppointmentStatus.CANCELLED,
    AppointmentStatus.MISSED,
  ]),
  [AppointmentStatus.CHECKEDIN]: new Set([AppointmentStatus.COMPLETED]),
  [AppointmentStatus.COMPLETED]: new Set(),
  [AppointmentStatus.CANCELLED]: new Set(),
  [AppointmentStatus.MISSED]: new Set(),
};

/** Restricts routine UI actions to the hospital workflow, even though the OMOD accepts broader forward jumps. */
export const canTransition = (fromStatus: AppointmentStatus, toStatus: AppointmentStatus): boolean => {
  return allowedAppointmentStatusTransitions[fromStatus]?.has(toStatus) ?? false;
};

/** Appointment details become immutable once check-in creates visit and queue associations. */
export const isAppointmentEditable = (status: AppointmentStatus | string | null | undefined): boolean =>
  status === AppointmentStatus.REQUESTED ||
  status === AppointmentStatus.WAITLIST ||
  status === AppointmentStatus.SCHEDULED ||
  status === AppointmentStatus.ARRIVED;

const appointmentStatusLabels: Record<AppointmentStatus, { key: string; defaultValue: string }> = {
  [AppointmentStatus.REQUESTED]: { key: 'requested', defaultValue: 'Solicitada' },
  [AppointmentStatus.WAITLIST]: { key: 'waitList', defaultValue: 'Lista de espera' },
  [AppointmentStatus.SCHEDULED]: { key: 'scheduled', defaultValue: 'Programada' },
  [AppointmentStatus.ARRIVED]: { key: 'arrived', defaultValue: 'Llegó' },
  [AppointmentStatus.CHECKEDIN]: { key: 'checkedIn', defaultValue: 'Llegada registrada' },
  [AppointmentStatus.COMPLETED]: { key: 'completed', defaultValue: 'Completada' },
  [AppointmentStatus.CANCELLED]: { key: 'cancelled', defaultValue: 'Cancelada' },
  [AppointmentStatus.MISSED]: { key: 'missed', defaultValue: 'No asistió' },
};

export const getAppointmentStatusLabel = (
  status: AppointmentStatus | string | null | undefined,
  t: (key: string, defaultValue: string) => string,
) => {
  if (!status) {
    return '';
  }
  const label = appointmentStatusLabels[status as AppointmentStatus];
  return label ? t(label.key, label.defaultValue) : t('unknownAppointmentStatus', 'Estado no reconocido');
};

const appointmentKindLabels: Record<AppointmentKind, { key: string; defaultValue: string }> = {
  [AppointmentKind.SCHEDULED]: { key: 'scheduled', defaultValue: 'Programada' },
  [AppointmentKind.WALKIN]: { key: 'walkIn', defaultValue: 'Sin cita' },
  [AppointmentKind.VIRTUAL]: { key: 'virtual', defaultValue: 'Virtual' },
};

export const getAppointmentKindLabel = (
  kind: AppointmentKind | string | null | undefined,
  t: (key: string, defaultValue: string) => string,
) => {
  if (!kind) {
    return '';
  }
  const label = appointmentKindLabels[kind as AppointmentKind];
  return label ? t(label.key, label.defaultValue) : t('unknownAppointmentType', 'Tipo no reconocido');
};
