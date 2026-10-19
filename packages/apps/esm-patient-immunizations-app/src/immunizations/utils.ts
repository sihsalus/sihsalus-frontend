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

export const latestFirst = (a: ExistingDoses, b: ExistingDoses) =>
  new Date(b.occurrenceDateTime).getTime() - new Date(a.occurrenceDateTime).getTime();

export const readImmunizationStatus = (status: unknown): ImmunizationRecordStatus =>
  status === 'completed' || status === 'not-done' ? status : 'unverified';

export const requireWritableImmunizationStatus = (status: unknown): WritableImmunizationStatus => {
  if (status !== 'completed' && status !== 'not-done') {
    throw new Error('An explicit immunization status is required before saving');
  }
  return status;
};

export const getLatestCompletedDose = (doses: ExistingDoses[] | undefined): ExistingDoses | undefined =>
  doses?.filter((dose) => dose.status === 'completed').sort(latestFirst)[0];
