import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import useSWR from 'swr';

interface EthnicIdentityEntry {
  obsUuid: string;
  encounterUuid: string;
  encounterDatetime: string;
  value: string;
}

interface Obs {
  uuid: string;
  encounter: { uuid: string };
  obsDatetime: string;
  value: string | { display: string };
}

export function useEthnicIdentity(patientUuid: string, conceptUuid: string) {
  const url =
    patientUuid && conceptUuid
      ? `${restBaseUrl}/obs?patient=${patientUuid}&concept=${conceptUuid}&v=custom:(uuid,encounter:(uuid),obsDatetime,value)&limit=5`
      : null;

  const { data, error, isLoading, mutate } = useSWR<{ data: { results: Obs[] } }>(url, openmrsFetch);

  const entries: EthnicIdentityEntry[] = (data?.data?.results ?? []).map((obs) => ({
    obsUuid: obs.uuid,
    encounterUuid: obs.encounter?.uuid ?? '',
    encounterDatetime: obs.obsDatetime,
    value: typeof obs.value === 'string' ? obs.value : (obs.value?.display ?? ''),
  }));

  const currentValue = entries.length > 0 ? entries[0].value : null;

  return {
    entries,
    currentValue,
    isLoading,
    error,
    mutate,
  };
}
