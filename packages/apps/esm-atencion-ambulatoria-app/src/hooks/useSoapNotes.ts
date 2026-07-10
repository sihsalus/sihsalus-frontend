import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import useSWR from 'swr';

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

export function useSoapNotes(patientUuid: string, encounterTypeUuid: string, concepts: Record<string, string>) {
  const url =
    patientUuid && encounterTypeUuid
      ? `${restBaseUrl}/encounter?patient=${patientUuid}&encounterType=${encounterTypeUuid}&v=custom:(uuid,encounterDatetime,encounterProviders:(display),obs:(uuid,concept:(uuid,display),value,display))&limit=20`
      : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR<{ data: { results: Encounter[] } }>(
    url,
    openmrsFetch,
  );

  const subjectiveUuid = concepts?.soapSubjectiveUuid;
  const objectiveUuid = concepts?.soapObjectiveUuid;
  const assessmentUuid = concepts?.soapAssessmentUuid;
  const planUuid = concepts?.soapPlanUuid;

  const getObsValue = (obs: Obs[] | undefined, conceptUuid: string | undefined): string | null => {
    if (!obs || !conceptUuid) return null;
    const match = obs.find((o) => o.concept?.uuid === conceptUuid);
    if (!match) return null;
    return typeof match.value === 'string' ? match.value : (match.value?.display ?? null);
  };

  const soapEntries: SoapEntry[] = (data?.data?.results ?? [])
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
  };
}
