import type { FetchResponse } from '@openmrs/esm-framework';
import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import useSWR from 'swr';

import type { OpenmrsEncounter } from '../encounter-list/types';

const useEncounters = (
  patientUuid: string | null | undefined,
  encounterTypeUuid: string | null | undefined,
  fromdate?: string | null,
  todate?: string | null,
) => {
  const customRepresentation = 'custom:(uuid,display,encounterDatetime,obs:(uuid,display,value:(uuid,display)))';

  const normalizedPatientUuid = patientUuid?.trim() ?? '';
  const normalizedEncounterTypeUuid = encounterTypeUuid?.trim() ?? '';
  const normalizedFromdate = fromdate?.trim();
  const normalizedTodate = todate?.trim();
  const hasRequiredUuids = Boolean(normalizedPatientUuid && normalizedEncounterTypeUuid);
  const params = new URLSearchParams({
    patient: normalizedPatientUuid,
    encounterType: normalizedEncounterTypeUuid,
    v: customRepresentation,
  });

  if (normalizedFromdate) {
    params.set('fromdate', normalizedFromdate);
  }

  if (normalizedTodate) {
    params.set('todate', normalizedTodate);
  }

  const url = hasRequiredUuids ? `${restBaseUrl}/encounter?${params.toString()}` : null;

  const { data, isLoading, error, mutate } = useSWR<FetchResponse<{ results: Array<OpenmrsEncounter> }>>(
    url,
    openmrsFetch,
  );
  return {
    encounters: data?.data?.results ?? [],
    isLoading,
    error,
    mutate,
  };
};

export default useEncounters;
