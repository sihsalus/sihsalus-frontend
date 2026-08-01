import type { AppointmentPayload, RecurringPattern } from '../types';
import { appointmentDurationMinutesRange, recurringPatternPeriodRange, weekDays } from '../constants';

export type AppointmentFormContext = 'creating' | 'editing';
export const MAX_RECURRING_APPOINTMENT_HORIZON_DAYS = 365;
const MILLISECONDS_PER_MINUTE = 60_000;
const MILLISECONDS_PER_MAXIMUM_APPOINTMENT =
  appointmentDurationMinutesRange.max * MILLISECONDS_PER_MINUTE;
const LOCAL_ISO_DATETIME_PATTERN =
  /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(?:Z|[+-]\d{2}:?\d{2})$/;
const validRecurringPatternTypes = new Set<RecurringPattern['type']>(['DAY', 'WEEK']);
const validRecurringWeekdays = new Set(weekDays.map(({ id }) => id));

interface EffectiveAppointmentStartDateOptions {
  canEditStartDate: boolean;
  context: AppointmentFormContext;
  originalStartDate?: Date;
  today?: Date;
}

interface AppointmentDateValidationOptions {
  originalStartDate?: Date;
  today?: Date;
}

function getLocalDayTimestamp(value: Date): number | null {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return null;
  }

  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Resolves the only appointment day that may reach the payload. Date controls
 * are not an authorization boundary: without the explicit privilege, a new
 * appointment uses today and an edit keeps its original day.
 */
export function resolveEffectiveAppointmentStartDate(
  candidateDate: Date,
  { canEditStartDate, context, originalStartDate, today = new Date() }: EffectiveAppointmentStartDateOptions,
): Date {
  if (canEditStartDate) {
    return new Date(candidateDate);
  }

  if (context === 'editing') {
    return originalStartDate ? new Date(originalStartDate) : new Date(Number.NaN);
  }

  return new Date(today);
}

export function isAppointmentStartDateAllowed(
  candidateDate: Date,
  context: AppointmentFormContext,
  originalStartDate?: Date,
  today: Date = new Date(),
): boolean {
  const candidateDay = getLocalDayTimestamp(candidateDate);
  const todayDay = getLocalDayTimestamp(today);
  if (candidateDay === null || todayDay === null) {
    return false;
  }

  if (candidateDay >= todayDay) {
    return true;
  }

  if (context !== 'editing' || !originalStartDate) {
    return false;
  }

  return candidateDay === getLocalDayTimestamp(originalStartDate);
}

export function isAppointmentIssuedDateAllowed(issuedDate: Date, today: Date = new Date()): boolean {
  const issuedDay = getLocalDayTimestamp(issuedDate);
  const todayDay = getLocalDayTimestamp(today);
  return issuedDay !== null && todayDay !== null && issuedDay <= todayDay;
}

export function isRecurringAppointmentRangeAllowed(
  startDate: Date,
  endDate: Date,
  maxHorizonDays = MAX_RECURRING_APPOINTMENT_HORIZON_DAYS,
): boolean {
  const startDay = getLocalDayTimestamp(startDate);
  const endDay = getLocalDayTimestamp(endDate);
  return (
    startDay !== null &&
    endDay !== null &&
    Number.isInteger(maxHorizonDays) &&
    maxHorizonDays >= 0 &&
    endDay >= startDay &&
    endDay - startDay <= maxHorizonDays * 86_400_000
  );
}

export function isAppointmentDurationAllowed(durationMinutes: number): boolean {
  return (
    Number.isInteger(durationMinutes) &&
    durationMinutes >= appointmentDurationMinutesRange.min &&
    durationMinutes <= appointmentDurationMinutesRange.max
  );
}

export function isRecurringPatternPeriodAllowed(period: number): boolean {
  return (
    Number.isInteger(period) &&
    period >= recurringPatternPeriodRange.min &&
    period <= recurringPatternPeriodRange.max
  );
}

export function areRecurringPatternWeekdaysAllowed(
  type: RecurringPattern['type'],
  daysOfWeek: unknown,
): boolean {
  if (!Array.isArray(daysOfWeek)) {
    return false;
  }

  return (
    daysOfWeek.every((day) => typeof day === 'string' && validRecurringWeekdays.has(day)) &&
    new Set(daysOfWeek).size === daysOfWeek.length &&
    (type === 'WEEK' ? daysOfWeek.length > 0 : daysOfWeek.length === 0)
  );
}

/**
 * Bahmni Appointment Scheduling 2.1.0 expects all-day appointments to stay
 * within one calendar day. Accept that one fractional-minute interval only
 * when both local wall-clock endpoints are the canonical start/end of the
 * same ISO day and the absolute interval is exactly one millisecond short of
 * the configured maximum.
 */
function isCanonicalAllDayAppointmentInterval(
  startDateTime: string,
  endDateTime: string,
  startDate: Date,
  endDate: Date,
): boolean {
  const startMatch = LOCAL_ISO_DATETIME_PATTERN.exec(startDateTime);
  const endMatch = LOCAL_ISO_DATETIME_PATTERN.exec(endDateTime);
  if (!startMatch || !endMatch) {
    return false;
  }

  const [, startDay, startHour, startMinute, startSecond, startFraction = ''] = startMatch;
  const [, endDay, endHour, endMinute, endSecond, endFraction = ''] = endMatch;
  const normalizedStartFraction = startFraction.padEnd(3, '0');

  return (
    startDay === endDay &&
    startHour === '00' &&
    startMinute === '00' &&
    startSecond === '00' &&
    normalizedStartFraction === '000' &&
    endHour === '23' &&
    endMinute === '59' &&
    endSecond === '59' &&
    endFraction === '999' &&
    endDate.valueOf() - startDate.valueOf() === MILLISECONDS_PER_MAXIMUM_APPOINTMENT - 1
  );
}

export function assertAppointmentPayloadDates(
  appointment: AppointmentPayload,
  { originalStartDate, today = new Date() }: AppointmentDateValidationOptions = {},
): void {
  const startDate = new Date(appointment.startDateTime);
  const endDate = new Date(appointment.endDateTime);
  const issuedDate = new Date(appointment.dateAppointmentScheduled);

  const context = appointment.uuid ? 'editing' : 'creating';
  if (!isAppointmentStartDateAllowed(startDate, context, originalStartDate, today)) {
    throw new Error('Appointment start date cannot be in the past.');
  }

  if (!isAppointmentIssuedDateAllowed(issuedDate, today)) {
    throw new Error('Appointment issue date cannot be in the future.');
  }

  if (Number.isNaN(startDate.valueOf()) || Number.isNaN(endDate.valueOf()) || endDate <= startDate) {
    throw new Error('Appointment end date must be after its start date.');
  }

  const durationMinutes = (endDate.valueOf() - startDate.valueOf()) / MILLISECONDS_PER_MINUTE;
  const isCanonicalAllDayAppointment = isCanonicalAllDayAppointmentInterval(
    appointment.startDateTime,
    appointment.endDateTime,
    startDate,
    endDate,
  );
  if (!isCanonicalAllDayAppointment && !isAppointmentDurationAllowed(durationMinutes)) {
    throw new Error(
      `Appointment duration must be a whole number between ${appointmentDurationMinutesRange.min} and ${appointmentDurationMinutesRange.max} minutes.`,
    );
  }
}

export function assertRecurringPatternDates(appointment: AppointmentPayload, recurringPattern: RecurringPattern): void {
  if (
    !validRecurringPatternTypes.has(recurringPattern.type) ||
    !isRecurringPatternPeriodAllowed(recurringPattern.period)
  ) {
    throw new Error(
      `Recurring appointment period must be a whole number between ${recurringPatternPeriodRange.min} and ${recurringPatternPeriodRange.max}.`,
    );
  }

  const daysOfWeek: unknown = recurringPattern.daysOfWeek ?? [];
  if (!areRecurringPatternWeekdaysAllowed(recurringPattern.type, daysOfWeek)) {
    throw new Error(
      recurringPattern.type === 'WEEK' && Array.isArray(daysOfWeek) && daysOfWeek.length === 0
        ? 'A weekly recurring appointment must include at least one day of the week.'
        : 'Recurring appointment weekdays must be unique, valid days of the week.',
    );
  }

  const startDate = new Date(appointment.startDateTime);
  const endDate = new Date(recurringPattern.endDate);
  if (
    Number.isNaN(startDate.valueOf()) ||
    Number.isNaN(endDate.valueOf()) ||
    endDate < startDate ||
    !isRecurringAppointmentRangeAllowed(startDate, endDate)
  ) {
    throw new Error(
      `Recurring appointment end date must be between its start date and ${MAX_RECURRING_APPOINTMENT_HORIZON_DAYS} days later.`,
    );
  }
}
