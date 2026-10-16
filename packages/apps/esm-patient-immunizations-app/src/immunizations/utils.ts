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

export const latestFirst = (a: ExistingDoses, b: ExistingDoses) => {
  const dateDifference = new Date(b.occurrenceDateTime).getTime() - new Date(a.occurrenceDateTime).getTime();
  if (dateDifference !== 0) {
    return dateDifference;
  }

  // Date-only records can share an occurrence time. Use the recorded sequence
  // to break that tie, never the API response order or the number of records.
  const recordedDoseNumber = (dose: ExistingDoses) =>
    Number.isInteger(dose.doseNumber) && dose.doseNumber > 0 ? dose.doseNumber : 0;
  return recordedDoseNumber(b) - recordedDoseNumber(a);
};
