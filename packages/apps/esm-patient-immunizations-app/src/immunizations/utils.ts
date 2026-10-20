import { BehaviorSubject } from 'rxjs';
import {
  type ExistingDoses,
  type ImmunizationFormState,
  type ImmunizationGrouped,
  type ImmunizationRecordStatus,
  type WritableImmunizationStatus,
} from '../types';
import { type ImmunizationSequenceDefinition } from '../types/fhir-immunization-domain';

export const immunizationFormSub = new BehaviorSubject<ImmunizationFormState | null>(null);

export const linkConfiguredSequences = (
  existingImmunizations: Array<ImmunizationGrouped> | null | undefined,
  configuredSequences: Array<ImmunizationSequenceDefinition>,
): Array<ImmunizationGrouped> => {
  return (existingImmunizations ?? []).map((immunization) => {
    const matchingSequenceDef = configuredSequences.find(
      (sequencesDef) => sequencesDef.vaccineConceptUuid === immunization.vaccineUuid,
    );
    immunization.sequences = matchingSequenceDef?.sequences || [];
    return immunization;
  });
};

const toTime = (value?: string | null): number => {
  const time = value ? new Date(value).getTime() : Number.NaN;
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
};

const toDoseNumber = (value?: number | string | null): number => {
  const doseNumber = value == null || value === '' ? Number.NaN : Number(value);
  return Number.isInteger(doseNumber) && doseNumber > 0 ? doseNumber : Number.NEGATIVE_INFINITY;
};

/**
 * Sorts doses from the most recent to the oldest. Doses recorded on the same
 * instant are ordered by their recorded positive integer dose number, highest
 * first; missing or invalid dose numbers go last within that instant.
 * Never infer a dose number from the number or order of records.
 */
export const latestFirst = (a: ExistingDoses, b: ExistingDoses): number => {
  const timeA = toTime(a?.occurrenceDateTime);
  const timeB = toTime(b?.occurrenceDateTime);
  if (timeA !== timeB) {
    return timeB > timeA ? 1 : -1;
  }

  const doseA = toDoseNumber(a?.doseNumber);
  const doseB = toDoseNumber(b?.doseNumber);
  if (doseA !== doseB) {
    return doseB > doseA ? 1 : -1;
  }

  return 0;
};

export const readImmunizationStatus = (status: unknown): ImmunizationRecordStatus =>
  status === 'completed' || status === 'not-done' ? status : 'unverified';

export const requireWritableImmunizationStatus = (status: unknown): WritableImmunizationStatus => {
  if (status !== 'completed' && status !== 'not-done') {
    throw new Error('An explicit immunization status is required before saving');
  }
  return status;
};

export const getLatestCompletedDose = (doses: ExistingDoses[] | undefined): ExistingDoses | undefined =>
  doses
    ?.filter((dose) => dose.status === 'completed' && Number.isFinite(toTime(dose.occurrenceDateTime)))
    .sort(latestFirst)[0];
