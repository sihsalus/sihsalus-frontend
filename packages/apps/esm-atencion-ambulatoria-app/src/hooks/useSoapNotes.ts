import { restBaseUrl } from '@openmrs/esm-framework';
import { useCallback } from 'react';
import {
  type EncounterTypeSourceInput,
  toEncounterTypeSources,
  useMergedClinicalHistoryPagination,
} from './useClinicalHistoryPagination';

interface SoapEntry {
  encounterUuid: string;
  encounterDatetime: string;
  provider: string | null;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
}

interface Obs {
  uuid: string;
  concept: { uuid: string; display: string };
  value: string | { display: string };
  display: string;
}

interface Encounter {
  uuid: string;
  encounterDatetime: string;
  encounterProviders: Array<{ display: string }>;
  obs: Obs[];
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
        url: `${restBaseUrl}/encounter?patient=${patientUuid}&encounterType=${encounterTypeUuid}&order=desc&v=custom:(uuid,encounterDatetime,form:(uuid),visit:(uuid,visitType:(uuid)),encounterProviders:(display),obs:(uuid,concept:(uuid,display),value,display))`,
        expectedFormUuid: formUuid,
        expectedVisitTypeUuid: visitTypeUuid,
      }))
    : null;

  const isRelevant = useCallback(
    (encounter: Encounter) =>
      encounter.obs?.some((obs) =>
        [subjectiveUuid, objectiveUuid, assessmentUuid, planUuid].filter(Boolean).includes(obs.concept?.uuid),
      ),
    [assessmentUuid, objectiveUuid, planUuid, subjectiveUuid],
  );
  const { data, error, isLoading, isValidating, mutate, pagination } = useMergedClinicalHistoryPagination<Encounter>(
    sources,
    isRelevant,
  );

  const getObsValue = (obs: Obs[] | undefined, conceptUuid: string | undefined): string | null => {
    if (!obs || !conceptUuid) return null;
    const match = obs.find((o) => o.concept?.uuid === conceptUuid);
    if (!match) return null;
    return typeof match.value === 'string' ? match.value : (match.value?.display ?? null);
  };

  const soapEntries: SoapEntry[] = data
    .map((encounter) => ({
      encounterUuid: encounter.uuid,
      encounterDatetime: encounter.encounterDatetime,
      provider: encounter.encounterProviders?.[0]?.display?.split(' - ')?.[0] ?? null,
      subjective: getObsValue(encounter.obs, subjectiveUuid),
      objective: getObsValue(encounter.obs, objectiveUuid),
      assessment: getObsValue(encounter.obs, assessmentUuid),
      plan: getObsValue(encounter.obs, planUuid),
    }))
    .filter((entry) => entry.subjective || entry.objective || entry.assessment || entry.plan);

  return {
    soapEntries,
    isLoading,
    isValidating,
    error,
    mutate,
    pagination,
  };
}
