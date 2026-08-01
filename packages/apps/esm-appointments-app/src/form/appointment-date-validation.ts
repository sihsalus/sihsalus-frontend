import type { AppointmentPayload, RecurringPattern } from '../types';
import { recurringPatternPeriodRange, timedAppointmentDurationMinutesRange, weekDays } from '../constants';

export type AppointmentFormContext = 'creating' | 'editing';
export const MAX_RECURRING_APPOINTMENT_HORIZON_DAYS = 365;
const MILLISECONDS_PER_MINUTE = 60_000;
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

export function isTimedAppointmentDurationAllowed(durationMinutes: unknown): durationMinutes is number {
  return (
    typeof durationMinutes === 'number' &&
    Number.isInteger(durationMinutes) &&
    durationMinutes >= timedAppointmentDurationMinutesRange.min &&
    durationMinutes <= timedAppointmentDurationMinutesRange.max
  );
}

export function isRecurringPatternPeriodAllowed(period: number): boolean {
  return (
    Number.isInteger(period) && period >= recurringPatternPeriodRange.min && period <= recurringPatternPeriodRange.max
  );
}

export function areRecurringPatternWeekdaysAllowed(type: RecurringPattern['type'], daysOfWeek: unknown): boolean {
  if (!Array.isArray(daysOfWeek)) {
    return false;
  }

  return (
    daysOfWeek.every((day) => typeof day === 'string' && validRecurringWeekdays.has(day)) &&
    new Set(daysOfWeek).size === daysOfWeek.length &&
    (type === 'WEEK' ? daysOfWeek.length > 0 : daysOfWeek.length === 0)
  );
}

const getUtcTimeOfDayMilliseconds = (date: Date): number =>
  date.getUTCHours() * 3_600_000 +
  date.getUTCMinutes() * 60_000 +
  date.getUTCSeconds() * 1_000 +
  date.getUTCMilliseconds();

/**
 * Mirrors AppointmentServiceUnavailabilityConflict in Bahmni Appointment
 * Scheduling 2.1.0, which compares DateUtil.getEpochTime values on a Tomcat
 * configured with UTC. Revisit this guard if the backend JVM timezone changes.
 * Rejecting a change of UTC day, as well as a non-increasing UTC wall-clock
 * range, prevents SERVICE_UNAVAILABLE for an otherwise valid absolute interval.
 */
export function isBahmniUtcTimeRangeAllowed(startDateTime: Date | string, endDateTime: Date | string): boolean {
  const startDate = startDateTime instanceof Date ? new Date(startDateTime.valueOf()) : new Date(startDateTime);
  const endDate = endDateTime instanceof Date ? new Date(endDateTime.valueOf()) : new Date(endDateTime);
  if (Number.isNaN(startDate.valueOf()) || Number.isNaN(endDate.valueOf())) {
    return false;
  }

  const isSameUtcDay =
    endDate.getUTCFullYear() === startDate.getUTCFullYear() &&
    endDate.getUTCMonth() === startDate.getUTCMonth() &&
    endDate.getUTCDate() === startDate.getUTCDate();

  return isSameUtcDay && getUtcTimeOfDayMilliseconds(endDate) > getUtcTimeOfDayMilliseconds(startDate);
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
  if (!isTimedAppointmentDurationAllowed(durationMinutes)) {
    throw new Error(
      `Timed appointment duration must be a whole number between ${timedAppointmentDurationMinutesRange.min} and ${timedAppointmentDurationMinutesRange.max} minutes.`,
    );
  }

  if (!isBahmniUtcTimeRangeAllowed(startDate, endDate)) {
    throw new Error('The appointment cannot span the backend daily scheduling boundary.');
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
