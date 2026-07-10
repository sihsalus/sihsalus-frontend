import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import useSWR from 'swr';

interface ChiefComplaintObs {
  uuid: string;
  display: string;
  obsDatetime: string;
  value: string | { display?: string };
}

interface EncounterObs extends ChiefComplaintObs {
  concept: { uuid: string };
}

interface Encounter {
  uuid: string;
  encounterDatetime: string;
  obs: EncounterObs[];
}

function getObsDisplayValue(obs: ChiefComplaintObs): string {
  if (typeof obs.value === 'string') {
    return obs.value;
  }

  return obs.value?.display ?? obs.display;
}

export function useChiefComplaint(patientUuid: string, encounterTypeUuid: string, conceptUuid: string) {
  const url =
    patientUuid && encounterTypeUuid && conceptUuid
      ? `${restBaseUrl}/encounter?patient=${patientUuid}&encounterType=${encounterTypeUuid}` +
        `&v=custom:(uuid,encounterDatetime,obs:(uuid,display,obsDatetime,concept:(uuid),value))&limit=20`
      : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR<{ data: { results: Encounter[] } }>(
    url,
    openmrsFetch,
  );

  const complaints =
    data?.data?.results.flatMap((encounter) =>
      (encounter.obs ?? [])
        .filter((obs) => obs.concept?.uuid === conceptUuid)
        .map((obs) => ({
          uuid: obs.uuid,
          display: getObsDisplayValue(obs),
          obsDatetime: obs.obsDatetime ?? encounter.encounterDatetime,
          value: obs.value,
        })),
    ) ?? [];

  return {
    complaints,
    isLoading,
    isValidating,
    error,
    mutate,
  };
}
