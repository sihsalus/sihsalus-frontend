import { restBaseUrl } from '@openmrs/esm-framework';
import { useCallback } from 'react';
import {
  getFormEngineFieldPath,
  physicalExamFields,
  type PhysicalExamValues,
} from '../utils/physical-exam';
import {
  type EncounterTypeSourceInput,
  toEncounterTypeSources,
  useMergedClinicalHistoryPagination,
} from './useClinicalHistoryPagination';

export interface SoapEntry {
  encounterUuid: string;
  encounterDatetime: string;
  provider: string | null;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  physicalExam: PhysicalExamValues;
}

export interface SoapObservation {
  uuid: string;
  concept: { uuid: string; display: string };
  value: string | { display: string };
  display: string;
  formFieldPath?: string;
}

export interface SoapEncounter {
  uuid: string;
  encounterDatetime: string;
  encounterProviders: Array<{ display: string }>;
  obs: SoapObservation[];
}

function getObsValue(
  obs: SoapObservation[] | undefined,
  conceptUuid: string | undefined,
  formFieldPath?: string,
): string | null {
  if (!obs || !conceptUuid) return null;
  const match = obs.find(
    (observation) =>
      observation.concept?.uuid === conceptUuid &&
      (formFieldPath === undefined || observation.formFieldPath === formFieldPath),
  );
  if (!match) return null;
  return typeof match.value === 'string' ? match.value : (match.value?.display ?? null);
}

export function mapSoapEntry(encounter: SoapEncounter, concepts: Record<string, string>): SoapEntry {
  const objectiveUuid = concepts?.soapObjectiveUuid;
  const physicalExam = physicalExamFields.reduce((values, field) => {
    values[field.key] = getObsValue(encounter.obs, objectiveUuid, getFormEngineFieldPath(field.questionId));
    return values;
  }, {} as PhysicalExamValues);

  return {
    encounterUuid: encounter.uuid,
    encounterDatetime: encounter.encounterDatetime,
    provider: encounter.encounterProviders?.[0]?.display?.split(' - ')?.[0] ?? null,
    subjective: getObsValue(encounter.obs, concepts?.soapSubjectiveUuid),
    objective:
      getObsValue(encounter.obs, objectiveUuid, getFormEngineFieldPath('soapObjetivo')) ??
      getObsValue(encounter.obs, objectiveUuid),
    assessment: getObsValue(encounter.obs, concepts?.soapAssessmentUuid),
    plan: getObsValue(encounter.obs, concepts?.soapPlanUuid),
    physicalExam,
  };
}

export function useSoapNotes(
  patientUuid: string,
  encounterType: EncounterTypeSourceInput | Array<EncounterTypeSourceInput>,
  concepts: Record<string, string>,
) {
  const subjectiveUuid = concepts?.soapSubjectiveUuid;
  const objectiveUuid = concepts?.soapObjectiveUuid;
  const assessmentUuid = concepts?.soapAssessmentUuid;
  const planUuid = concepts?.soapPlanUuid;
  const encounterTypes = toEncounterTypeSources(encounterType);
  const sources = patientUuid
    ? encounterTypes.map(({ encounterTypeUuid, formUuid, visitTypeUuid }) => ({
        url: `${restBaseUrl}/encounter?patient=${patientUuid}&encounterType=${encounterTypeUuid}&order=desc&v=custom:(uuid,encounterDatetime,form:(uuid),visit:(uuid,visitType:(uuid)),encounterProviders:(display),obs:(uuid,concept:(uuid,display),value,display,formFieldPath))`,
        expectedFormUuid: formUuid,
        expectedVisitTypeUuid: visitTypeUuid,
      }))
    : null;

  const isRelevant = useCallback(
    (encounter: SoapEncounter) =>
      encounter.obs?.some((obs) =>
        [subjectiveUuid, objectiveUuid, assessmentUuid, planUuid].filter(Boolean).includes(obs.concept?.uuid),
      ),
    [assessmentUuid, objectiveUuid, planUuid, subjectiveUuid],
  );
  const { data, error, isLoading, isValidating, mutate, pagination, sourceErrors } =
    useMergedClinicalHistoryPagination<SoapEncounter>(sources, isRelevant);

  const soapEntries: SoapEntry[] = data
    .map((encounter) => mapSoapEntry(encounter, concepts))
    .filter(
      (entry) =>
        entry.subjective ||
        entry.objective ||
        entry.assessment ||
        entry.plan ||
        Object.values(entry.physicalExam).some(Boolean),
    );

  return {
    soapEntries,
    isLoading,
    isValidating,
    error,
    mutate,
    pagination,
    sourceErrors,
  };
}
