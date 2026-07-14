import dayjs from 'dayjs';
import { generateCREDSchedule } from './cred-schedule-rules';

interface CREDRealControl {
  encounterDatetime?: string;
  controlNumber?: number;
}

interface CREDFutureAppointment {
  uuid: string;
  startDateTime: string | Date;
  status: string;
}

export type CREDRecommendationStatus = 'scheduled' | 'overdue' | 'pending' | 'future';

export interface CREDControlRecommendation {
  controlNumber: number;
  targetDate: Date;
  status: CREDRecommendationStatus;
  appointmentUuid?: string;
  appointmentDate?: Date;
}

interface SchedulableCREDControl {
  status: string;
  appointmentUuid?: string;
}

const ACTIVE_APPOINTMENT_STATUSES = new Set(['Scheduled', 'CheckedIn']);

export function getCREDMinimumIntervalDays(
  birthDate: string | Date,
  controlDate: string | Date,
): number | null {
  const birth = dayjs(birthDate);
  const control = dayjs(controlDate);
  if (!birth.isValid() || !control.isValid() || control.isBefore(birth)) return null;

  const ageInDays = control.diff(birth, 'day');
  const ageInMonths = control.diff(birth, 'month', true);

  if (ageInDays <= 28) return 7;
  if (ageInDays < 120) return 30;
  if (ageInDays < 180) return 60;
  if (ageInDays < 210) return 30;
  if (ageInDays < 270) return 60;
  if (ageInDays < 360 || ageInMonths < 24) return 90;
  if (ageInMonths < 60) return 180;
  if (ageInMonths < 144) return 360;

  return null;
}

export function getNextCREDControlRecommendation(
  birthDate: string | Date,
  controls: CREDRealControl[],
  appointments: CREDFutureAppointment[] = [],
  now: string | Date = new Date(),
): CREDControlRecommendation | null {
  const birth = dayjs(birthDate);
  const current = dayjs(now);
  const credEnd = birth.add(144, 'month');
  if (!birth.isValid() || !current.isValid() || current.isBefore(birth) || !current.isBefore(credEnd)) return null;

  const datedControls = controls
    .filter((control) => control.encounterDatetime && dayjs(control.encounterDatetime).isValid())
    .sort(
      (first, second) =>
        dayjs(first.encounterDatetime).valueOf() - dayjs(second.encounterDatetime).valueOf(),
    );
  const highestPersistedNumber = datedControls.reduce(
    (highest, control) =>
      Number.isInteger(control.controlNumber) && Number(control.controlNumber) >= 1
        ? Math.max(highest, Number(control.controlNumber))
        : highest,
    0,
  );
  const nextControlNumber = Math.max(datedControls.length, highestPersistedNumber) + 1;
  if (nextControlNumber > 27) return null;

  const lastControl = datedControls.at(-1);
  let target = birth.add(3, 'day');

  if (lastControl?.encounterDatetime) {
    const minimumInterval = getCREDMinimumIntervalDays(birthDate, lastControl.encounterDatetime);
    if (minimumInterval === null) return null;
    const lastControlDate = dayjs(lastControl.encounterDatetime);
    target = lastControlDate.add(minimumInterval, 'day');

    const schedule = generateCREDSchedule(birthDate);
    let currentScheduleIndex = schedule.findIndex(
      (control) =>
        !lastControlDate.isBefore(dayjs(control.targetDate), 'day') &&
        !lastControlDate.isAfter(dayjs(control.dueEndDate), 'day'),
    );

    if (currentScheduleIndex < 0) {
      currentScheduleIndex = schedule.reduce(
        (latestIndex, control, index) =>
          !lastControlDate.isBefore(dayjs(control.targetDate), 'day') ? index : latestIndex,
        -1,
      );
    }

    const nextIdealControl = schedule[currentScheduleIndex + 1];
    if (!nextIdealControl) return null;

    const nextIdealDate = dayjs(nextIdealControl.targetDate);
    if (nextIdealDate.isAfter(target)) {
      target = nextIdealDate;
    }
  } else if (current.isAfter(target)) {
    target = current;
  }

  if (!target.isBefore(credEnd)) return null;

  const appointment = appointments
    .filter(
      (candidate) =>
        ACTIVE_APPOINTMENT_STATUSES.has(candidate.status) &&
        dayjs(candidate.startDateTime).isValid() &&
        !dayjs(candidate.startDateTime).isBefore(target, 'day'),
    )
    .sort((first, second) => dayjs(first.startDateTime).valueOf() - dayjs(second.startDateTime).valueOf())[0];

  if (appointment) {
    return {
      controlNumber: nextControlNumber,
      targetDate: target.toDate(),
      status: 'scheduled',
      appointmentUuid: appointment.uuid,
      appointmentDate: dayjs(appointment.startDateTime).toDate(),
    };
  }

  const status = current.isAfter(target, 'day') ? 'overdue' : current.isSame(target, 'day') ? 'pending' : 'future';

  return {
    controlNumber: nextControlNumber,
    targetDate: target.toDate(),
    status,
  };
}

export function getCREDControlsToSchedule<T extends SchedulableCREDControl>(nextControl: T | null): T[] {
  return nextControl?.status === 'future' && !nextControl.appointmentUuid ? [nextControl] : [];
}
