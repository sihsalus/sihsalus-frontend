import { usePatient } from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import { useMemo } from 'react';

import { type CREDScheduledControl, generateCREDSchedule } from '../utils/cred-schedule-rules';

import useAppointmentsCRED from './useAppointmentsCRED';
import useEncountersCRED, { type CREDEncounter } from './useEncountersCRED';

export type ControlStatus = 'completed' | 'scheduled' | 'overdue' | 'pending' | 'future';

export interface CREDControlWithStatus extends CREDScheduledControl {
  status: ControlStatus;
  encounterUuid?: string;
  encounterDate?: Date;
  appointmentUuid?: string;
  appointmentDate?: Date;
}

export interface UseCREDScheduleResult {
  controls: CREDControlWithStatus[];
  nextDueControl: CREDControlWithStatus | null;
  overdueControls: CREDControlWithStatus[];
  completedCount: number;
  totalCount: number;
  isLoading: boolean;
  error: Error | null;
}

type DatedCREDEncounter = CREDEncounter & { encounterDatetime: string };

function hasEncounterDatetime(encounter: CREDEncounter): encounter is DatedCREDEncounter {
  return Boolean(encounter.encounterDatetime);
}

function hasValidControlNumber(encounter: CREDEncounter): encounter is CREDEncounter & { controlNumber: number } {
  return (
    typeof encounter.controlNumber === 'number' &&
    Number.isInteger(encounter.controlNumber) &&
    encounter.controlNumber >= 1 &&
    encounter.controlNumber <= 27
  );
}

function findUnassignedControlForDate(
  schedule: CREDScheduledControl[],
  date: Date,
  assignedControls: Set<number>,
): CREDScheduledControl | null {
  const candidateDate = dayjs(date);
  if (!candidateDate.isValid()) return null;

  return (
    schedule.find(
      (control) =>
        !assignedControls.has(control.controlNumber) &&
        !candidateDate.isBefore(dayjs(control.targetDate), 'day') &&
        !candidateDate.isAfter(dayjs(control.dueEndDate), 'day'),
    ) ?? null
  );
}

/**
 * Matches an encounter only to the configured age window in which it occurred.
 * A second encounter in the same window remains unmatched instead of completing
 * a future control that the child has not reached yet.
 */
export function matchEncountersToControls(
  schedule: CREDScheduledControl[],
  encounters: CREDEncounter[],
): Map<number, { uuid: string; date: Date }> {
  const matched = new Map<number, { uuid: string; date: Date }>();
  const assignedControls = new Set<number>();

  const validEncounters = encounters.filter(hasEncounterDatetime);
  const sortedEncounters = [...validEncounters].sort(
    (a, b) => new Date(a.encounterDatetime).getTime() - new Date(b.encounterDatetime).getTime(),
  );

  for (const enc of sortedEncounters) {
    const encDate = new Date(enc.encounterDatetime);
    const matchingControl = findUnassignedControlForDate(schedule, encDate, assignedControls);

    if (matchingControl) {
      matched.set(matchingControl.controlNumber, { uuid: enc.uuid, date: encDate });
      assignedControls.add(matchingControl.controlNumber);
    }
  }

  return matched;
}

/**
 * A single CRED control may produce several form encounters. Encounters saved in the
 * same visit and local calendar day belong to one clinical control.
 */
export function groupCREDControlEncounters(encounters: CREDEncounter[]): CREDEncounter[] {
  const groups = new Map<string, CREDEncounter>();
  const controlNumbersBySession = new Map<string, number>();
  const validEncounters = encounters
    .filter(hasEncounterDatetime)
    .sort(
      (first, second) => new Date(first.encounterDatetime).getTime() - new Date(second.encounterDatetime).getTime(),
    );

  validEncounters.forEach((encounter) => {
    if (hasValidControlNumber(encounter)) {
      const encounterDay = dayjs(encounter.encounterDatetime).format('YYYY-MM-DD');
      const sessionKey = `${encounter.visit?.uuid ?? 'no-visit'}:${encounterDay}`;
      controlNumbersBySession.set(sessionKey, encounter.controlNumber);
    }
  });

  validEncounters.forEach((encounter) => {
    const encounterDay = dayjs(encounter.encounterDatetime).format('YYYY-MM-DD');
    const sessionKey = `${encounter.visit?.uuid ?? 'no-visit'}:${encounterDay}`;
    const controlNumber = hasValidControlNumber(encounter)
      ? encounter.controlNumber
      : controlNumbersBySession.get(sessionKey);
    const controlKey = controlNumber ? `control-number:${controlNumber}` : `session:${sessionKey}`;

    if (!groups.has(controlKey)) {
      groups.set(controlKey, controlNumber ? { ...encounter, controlNumber } : encounter);
    }
  });

  return Array.from(groups.values());
}

/**
 * Matches appointments to their configured age window without allowing duplicate
 * appointments in one window to occupy later controls.
 */
export function matchAppointmentsToControls(
  schedule: CREDScheduledControl[],
  appointments: Array<{ uuid: string; startDateTime: string | number }>,
  completedControls: Set<number>,
): Map<number, { uuid: string; date: Date }> {
  const matched = new Map<number, { uuid: string; date: Date }>();
  const assignedControls = new Set<number>(completedControls);

  const sortedAppointments = [...appointments].sort(
    (a, b) => new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime(),
  );

  for (const appt of sortedAppointments) {
    const apptDate = new Date(appt.startDateTime);
    const matchingControl = findUnassignedControlForDate(schedule, apptDate, assignedControls);

    if (matchingControl) {
      matched.set(matchingControl.controlNumber, {
        uuid: appt.uuid,
        date: apptDate,
      });
      assignedControls.add(matchingControl.controlNumber);
    }
  }

  return matched;
}

export function useCREDSchedule(patientUuid: string): UseCREDScheduleResult {
  const { patient, isLoading: isPatientLoading, error: patientError } = usePatient(patientUuid);
  const { encounters, isLoading: isEncountersLoading, error: encountersError } = useEncountersCRED(patientUuid);
  const { appointments, isLoading: isAppointmentsLoading, error: appointmentsError } = useAppointmentsCRED(patientUuid);

  // Only block on patient loading; encounters/appointments errors are non-fatal
  // (the schedule can render from birthDate alone)
  const isLoading =
    isPatientLoading || (isEncountersLoading && !encounters) || (isAppointmentsLoading && !appointments);
  const error = (patientError ?? encountersError ?? appointmentsError ?? null) as Error | null;

  const controls = useMemo<CREDControlWithStatus[]>(() => {
    if (!patient?.birthDate) return [];

    const schedule = generateCREDSchedule(patient.birthDate);
    const today = dayjs();

    // Match encounters to the age window in which each control occurred.
    const encounterMatches = matchEncountersToControls(schedule, groupCREDControlEncounters(encounters ?? []));

    // Match appointments to remaining controls
    const completedControlNumbers = new Set(encounterMatches.keys());
    const appointmentMatches = matchAppointmentsToControls(
      schedule,
      (appointments ?? [])
        .filter((a) => a.status !== 'Cancelled')
        .map((appointment) => ({
          ...appointment,
          startDateTime:
            appointment.startDateTime instanceof Date ? appointment.startDateTime.getTime() : appointment.startDateTime,
        })),
      completedControlNumbers,
    );

    return schedule.map((control): CREDControlWithStatus => {
      const encounter = encounterMatches.get(control.controlNumber);
      const appointment = appointmentMatches.get(control.controlNumber);

      let status: ControlStatus;

      if (encounter) {
        status = 'completed';
      } else if (appointment) {
        status = 'scheduled';
      } else if (today.isAfter(dayjs(control.dueEndDate), 'day')) {
        status = 'overdue';
      } else if (today.isSame(dayjs(control.targetDate), 'day') || today.isAfter(dayjs(control.targetDate), 'day')) {
        status = 'pending';
      } else {
        status = 'future';
      }

      return {
        ...control,
        status,
        encounterUuid: encounter?.uuid,
        encounterDate: encounter?.date,
        appointmentUuid: appointment?.uuid,
        appointmentDate: appointment?.date,
      };
    });
  }, [patient?.birthDate, encounters, appointments]);

  const nextDueControl = useMemo(() => {
    const pending = controls.find((control) => control.status === 'pending');
    if (pending) return pending;

    const overdue = controls.filter((control) => control.status === 'overdue');
    if (overdue.length > 0) return overdue.at(-1) ?? null;

    return controls.find((control) => control.status === 'future') ?? null;
  }, [controls]);

  const overdueControls = useMemo(() => controls.filter((c) => c.status === 'overdue'), [controls]);

  const completedCount = useMemo(() => controls.filter((c) => c.status === 'completed').length, [controls]);

  return {
    controls,
    nextDueControl,
    overdueControls,
    completedCount,
    totalCount: controls.length,
    isLoading,
    error,
  };
}
