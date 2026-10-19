import { BehaviorSubject } from 'rxjs';
import { type ExistingDoses, type ImmunizationFormState, type ImmunizationGrouped } from '../types';
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
  return Number.isNaN(doseNumber) ? Number.NEGATIVE_INFINITY : doseNumber;
};

/**
 * Sorts doses from the most recent to the oldest. Doses recorded on the same
 * date are ordered by dose number, highest first, so the latest dose of a
 * series is listed first; doses without a dose number go last within a date.
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
