import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { useMemo } from 'react';
import useSWR from 'swr';

type Obs = {
  uuid: string;
  display: string;
  groupMembers?: Obs[];
};

type ObsEncounter = {
  uuid: string;
  encounterDatetime: string;
  form: {
    uuid: string;
    display: string;
  };
  obs: Obs[];
};

type EncounterResponse = {
  results: ObsEncounter[];
};

export function useFilteredEncounter(
  patientUuid: string,
  encounterType: string,
  formUuid: string,
): { prenatalEncounter: ObsEncounter | null; error: Error | null; isLoading: boolean; mutate: () => void } {
  const customRepresentation =
    'custom:(uuid,encounterDatetime,form:(uuid,display),obs:(uuid,display,groupMembers:(uuid,display)))';

  const url = useMemo(() => {
    if (!patientUuid || !encounterType || !formUuid) {
      console.error('Missing required parameters');
      return null;
    }

    const params = new URLSearchParams({
      patient: patientUuid,
      encounterType,
      v: customRepresentation,
    });

    return `${restBaseUrl}/encounter?${params}`;
  }, [patientUuid, encounterType, formUuid]);

  const fetcher = async (url: string): Promise<EncounterResponse> => {
    const response = await openmrsFetch<EncounterResponse>(url);
    return response.data;
  };

  const { data, error, isLoading, mutate } = useSWR<EncounterResponse>(url, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  const mostRecentPrenatalEncounter = useMemo(() => {
    try {
      if (!data?.results?.length) return null;

      const validEncounters = data.results.filter(
        (enc) =>
          enc?.uuid &&
          enc.encounterDatetime &&
          (enc.form?.uuid === formUuid || enc.form?.display === formUuid) &&
          Array.isArray(enc.obs),
      );

      return (
        validEncounters
          .slice()
          .sort((a, b) => new Date(b.encounterDatetime).getTime() - new Date(a.encounterDatetime).getTime())[0] || null
      );
    } catch (error) {
      console.error('Error processing encounters:', error);
      return null;
    }
  }, [data, formUuid]);

  return {
    prenatalEncounter: mostRecentPrenatalEncounter,
    error,
    isLoading,
    mutate,
  };
}
