import type { AppointmentPayload, RecurringPattern } from '../types';

type AppointmentFormContext = 'creating' | 'editing';

function getLocalDayTimestamp(value: Date): number | null {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return null;
  }

  date.setHours(0, 0, 0, 0);
  return date.valueOf();
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

export function isRecurringAppointmentRangeAllowed(startDate: Date, endDate: Date): boolean {
  const startDay = getLocalDayTimestamp(startDate);
  const endDay = getLocalDayTimestamp(endDate);
  return startDay !== null && endDay !== null && endDay >= startDay;
}

export function assertAppointmentPayloadDates(appointment: AppointmentPayload, today: Date = new Date()): void {
  const startDate = new Date(appointment.startDateTime);
  const endDate = new Date(appointment.endDateTime);
  const issuedDate = new Date(appointment.dateAppointmentScheduled);

  if (!appointment.uuid && !isAppointmentStartDateAllowed(startDate, 'creating', undefined, today)) {
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
  if (!isRecurringAppointmentRangeAllowed(startDate, endDate)) {
    throw new Error('Recurring appointment end date cannot be before its start date.');
  }
}
