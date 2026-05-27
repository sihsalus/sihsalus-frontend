import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import useSWR from 'swr';

interface Obs {
  uuid: string;
  obsDatetime: string;
  value: string | { display?: string };
}

export function useEthnicIdentity(patientUuid: string, conceptUuid: string) {
  const url =
    patientUuid && conceptUuid
      ? `${restBaseUrl}/obs?patient=${patientUuid}&concept=${conceptUuid}&v=custom:(uuid,obsDatetime,value)&limit=1`
      : null;

  const { data, error, isLoading, mutate } = useSWR<{ data: { results: Obs[] } }, Error>(url, openmrsFetch);
  const latestObs = data?.data?.results?.[0];
  const currentValue = latestObs
    ? typeof latestObs.value === 'string'
      ? latestObs.value
      : (latestObs.value?.display ?? '')
    : null;

  return {
    currentValue,
    error,
    isLoading,
    mutate,
  };
}
