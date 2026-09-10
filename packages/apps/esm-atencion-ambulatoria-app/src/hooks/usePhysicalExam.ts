import { restBaseUrl } from '@openmrs/esm-framework';
import { useCallback } from 'react';
import { getFormEngineFieldPath, type PhysicalExamValues, physicalExamFields } from '../utils/physical-exam';
import {
  type EncounterTypeSourceInput,
  toEncounterTypeSources,
  useMergedClinicalHistoryPagination,
} from './useClinicalHistoryPagination';

export interface PhysicalExamEntry {
  encounterUuid: string;
  encounterDatetime: string;
  provider: string | null;
  /** Compatibility with objective findings recorded before the segmented examination form. */
  legacyObjective: string | null;
  physicalExam: PhysicalExamValues;
}

export interface PhysicalExamObservation {
  uuid: string;
  concept: { uuid: string; display: string };
  value: string | { display: string };
  display: string;
  formFieldPath?: string;
}

export interface PhysicalExamEncounter {
  uuid: string;
  encounterDatetime: string;
  encounterProviders: Array<{ display: string }>;
  obs: PhysicalExamObservation[];
}

function getObsValue(
  obs: PhysicalExamObservation[] | undefined,
  conceptUuid: string | undefined,
  formFieldPath?: string,
): string | null {
  if (!obs || (!conceptUuid && !formFieldPath)) return null;
  const match = obs.find(
    (observation) =>
      (conceptUuid === undefined || observation.concept?.uuid === conceptUuid) &&
      (formFieldPath === undefined || observation.formFieldPath === formFieldPath),
  );
  if (!match) return null;
  return typeof match.value === 'string' ? match.value : (match.value?.display ?? null);
}

export function mapPhysicalExamEntry(
  encounter: PhysicalExamEncounter,
  concepts: Record<string, string>,
): PhysicalExamEntry {
  const objectiveUuid = concepts?.soapObjectiveUuid;
  const physicalExam = physicalExamFields.reduce((values, field) => {
    values[field.key] = getObsValue(encounter.obs, undefined, getFormEngineFieldPath(field.questionId));
    return values;
  }, {} as PhysicalExamValues);

  return {
    encounterUuid: encounter.uuid,
    encounterDatetime: encounter.encounterDatetime,
    provider: encounter.encounterProviders?.[0]?.display?.split(' - ')?.[0] ?? null,
    legacyObjective:
      getObsValue(encounter.obs, objectiveUuid, getFormEngineFieldPath('soapObjetivo')) ??
      getObsValue(encounter.obs, objectiveUuid),
    physicalExam,
  };
}

/** Reads physical examination findings, including the objective portion of historical notes. */
export function usePhysicalExam(
  patientUuid: string,
  encounterType: EncounterTypeSourceInput | Array<EncounterTypeSourceInput>,
  concepts: Record<string, string>,
) {
  const encounterTypes = toEncounterTypeSources(encounterType);
  const sources = patientUuid
    ? encounterTypes.map(({ encounterTypeUuid, formUuid, visitTypeUuid }) => ({
        url: `${restBaseUrl}/encounter?patient=${patientUuid}&encounterType=${encounterTypeUuid}&order=desc&v=custom:(uuid,encounterDatetime,form:(uuid),visit:(uuid,visitType:(uuid)),encounterProviders:(display),obs:(uuid,concept:(uuid,display),value,display,formFieldPath))`,
        expectedFormUuid: formUuid,
        expectedVisitTypeUuid: visitTypeUuid,
      }))
    : null;

  const isRelevant = useCallback(
    (encounter: PhysicalExamEncounter) => {
      const entry = mapPhysicalExamEntry(encounter, concepts);
      return Boolean(entry.legacyObjective) || Object.values(entry.physicalExam).some(Boolean);
    },
    [concepts],
  );
  const { data, error, isLoading, isValidating, mutate, pagination, sourceErrors } =
    useMergedClinicalHistoryPagination<PhysicalExamEncounter>(sources, isRelevant);

  const physicalExamEntries = data.map((encounter) => mapPhysicalExamEntry(encounter, concepts));

  return {
    physicalExamEntries,
    isLoading,
    isValidating,
    error,
    mutate,
    pagination,
    sourceErrors,
  };
}
