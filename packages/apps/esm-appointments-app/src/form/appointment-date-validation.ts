import type { AppointmentPayload, RecurringPattern } from '../types';

export type AppointmentFormContext = 'creating' | 'editing';
export const MAX_RECURRING_APPOINTMENT_HORIZON_DAYS = 365;

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
}

export function assertRecurringPatternDates(appointment: AppointmentPayload, recurringPattern: RecurringPattern): void {
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
