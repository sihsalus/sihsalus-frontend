import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { useMemo } from 'react';
import useSWR from 'swr';
import { validate as isUuid } from 'uuid';

type Obs = {
  uuid: string;
  display: string;
  groupMembers?: Obs[];
};

type ObsEncounter = {
  uuid: string;
  encounterDatetime: string;
  form?: {
    uuid: string;
    name?: string;
    display: string;
  };
  obs: Obs[];
};

type EncounterResponse = {
  results: ObsEncounter[];
};

export function useFilteredEncounter(
  patientUuid: string | null | undefined,
  encounterType: string | null | undefined,
  formUuid: string | null | undefined,
): { prenatalEncounter: ObsEncounter | null; error: Error | null; isLoading: boolean; mutate: () => void } {
  const customRepresentation =
    'custom:(uuid,encounterDatetime,form:(uuid,name,display),obs:(uuid,display,groupMembers:(uuid,display)))';

  const normalizedPatientUuid = patientUuid?.trim();
  const normalizedEncounterType = encounterType?.trim();
  const normalizedFormIdentifier = formUuid?.trim();

  const url = useMemo(() => {
    if (!normalizedPatientUuid || !normalizedEncounterType || !normalizedFormIdentifier) return null;

    const formUuid = isUuid(normalizedFormIdentifier) ? normalizedFormIdentifier : undefined;
    const params = new URLSearchParams({
      patient: normalizedPatientUuid,
      encounterType: normalizedEncounterType,
      order: 'desc',
      limit: formUuid ? '1' : '100',
      startIndex: '0',
      v: customRepresentation,
    });
    if (formUuid) {
      params.set('form', formUuid);
    }

    return `${restBaseUrl}/encounter?${params}`;
  }, [normalizedPatientUuid, normalizedEncounterType, normalizedFormIdentifier]);

  const fetcher = async (url: string): Promise<EncounterResponse> => {
    const response = await openmrsFetch<EncounterResponse>(url);
    return response.data;
  };

  const { data, error, isLoading, mutate } = useSWR<EncounterResponse, Error>(url, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  const mostRecentPrenatalEncounter = useMemo(() => {
    if (!normalizedFormIdentifier || !Array.isArray(data?.results)) return null;

    const formIdentifier = normalizedFormIdentifier.toLocaleLowerCase();
    const validEncounters = data.results.filter((encounter) => {
      const encounterTimestamp = Date.parse(encounter?.encounterDatetime);
      const matchesForm = [encounter?.form?.uuid, encounter?.form?.name, encounter?.form?.display].some(
        (identifier) => identifier?.trim().toLocaleLowerCase() === formIdentifier,
      );

      return Boolean(
        encounter?.uuid && Number.isFinite(encounterTimestamp) && matchesForm && Array.isArray(encounter.obs),
      );
    });

    return (
      validEncounters.sort(
        (first, second) => Date.parse(second.encounterDatetime) - Date.parse(first.encounterDatetime),
      )[0] ?? null
    );
  }, [data?.results, normalizedFormIdentifier]);

  return {
    prenatalEncounter: mostRecentPrenatalEncounter,
    error: error ?? null,
    isLoading,
    mutate,
  };
}
