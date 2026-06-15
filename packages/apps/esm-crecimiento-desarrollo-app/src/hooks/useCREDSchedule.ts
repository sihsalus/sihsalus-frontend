import { usePatient } from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import { useMemo } from 'react';

import { type CREDScheduledControl, generateCREDSchedule } from '../utils/cred-schedule-rules';

import useAppointmentsCRED from './useAppointmentsCRED';
import useEncountersCRED from './useEncountersCRED';

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

/**
 * Closest-match: asigna cada encounter al control cuya targetDate esté más cerca.
 * Greedy, de izquierda a derecha en la lista de encounters ordenados por fecha.
 */
function matchEncountersToControls(
  schedule: CREDScheduledControl[],
  encounters: Array<{ uuid: string; encounterDatetime?: string }>,
): Map<number, { uuid: string; date: Date }> {
  const matched = new Map<number, { uuid: string; date: Date }>();
  const assignedControls = new Set<number>();

  const validEncounters = encounters.filter((e) => e.encounterDatetime);
  const sortedEncounters = [...validEncounters].sort(
    (a, b) => new Date(a.encounterDatetime!).getTime() - new Date(b.encounterDatetime!).getTime(),
  );

  for (const enc of sortedEncounters) {
    const encDate = new Date(enc.encounterDatetime!);
    let bestControl: CREDScheduledControl | null = null;
    let bestDistance = Infinity;

    for (const control of schedule) {
      if (assignedControls.has(control.controlNumber)) continue;

      const distance = Math.abs(dayjs(encDate).diff(dayjs(control.targetDate), 'day'));
      if (distance < bestDistance) {
        bestDistance = distance;
        bestControl = control;
      }
    }

    if (bestControl) {
      matched.set(bestControl.controlNumber, { uuid: enc.uuid, date: encDate });
      assignedControls.add(bestControl.controlNumber);
    }
  }

  return matched;
}

/**
 * Asigna cada appointment existente al control más cercano que no tenga encounter ni appointment ya asignado.
 */
function matchAppointmentsToControls(
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
    let bestControl: CREDScheduledControl | null = null;
    let bestDistance = Infinity;

    for (const control of schedule) {
      if (assignedControls.has(control.controlNumber)) continue;

      const distance = Math.abs(dayjs(apptDate).diff(dayjs(control.targetDate), 'day'));
      if (distance < bestDistance) {
        bestDistance = distance;
        bestControl = control;
      }
    }

    if (bestControl) {
      matched.set(bestControl.controlNumber, { uuid: appt.uuid, date: apptDate });
      assignedControls.add(bestControl.controlNumber);
    }
  }

  return matched;
}

export function useCREDSchedule(patientUuid: string): UseCREDScheduleResult {
  const { patient, isLoading: isPatientLoading } = usePatient(patientUuid);
  const { encounters, isLoading: isEncountersLoading } = useEncountersCRED(patientUuid);
  const { appointments, isLoading: isAppointmentsLoading } = useAppointmentsCRED(patientUuid);

  // Only block on patient loading; encounters/appointments errors are non-fatal
  // (the schedule can render from birthDate alone)
  const isLoading =
    isPatientLoading || (isEncountersLoading && !encounters) || (isAppointmentsLoading && !appointments);
  const error: Error | null = null;

  const controls = useMemo<CREDControlWithStatus[]>(() => {
    if (!patient?.birthDate) return [];

    const schedule = generateCREDSchedule(patient.birthDate);
    const today = dayjs();

    // Match encounters to controls (closest-match greedy)
    const encounterMatches = matchEncountersToControls(schedule, encounters ?? []);

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
      } else if (today.isAfter(dayjs(control.targetDate))) {
        status = 'overdue';
      } else if (today.isSame(dayjs(control.targetDate), 'day')) {
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

  const nextDueControl = useMemo(
    () => controls.find((c) => c.status === 'overdue' || c.status === 'pending') ?? null,
    [controls],
  );

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
