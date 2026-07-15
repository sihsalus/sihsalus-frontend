import type { FetchResponse } from '@openmrs/esm-framework';
import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import pickBy from 'lodash-es/pickBy';
import useSWR from 'swr';

import type { OpenmrsEncounter } from '../encounter-list/types';

const useEncounters = (patientUuid: string, encounterTypeUuid: string, fromdate?: string, todate?: string) => {
  const customRepresentation = 'custom:(uuid,display,encounterDatetime,obs:(uuid,display,value:(uuid,display)))';

  const params = new URLSearchParams(
    pickBy(
      { patient: patientUuid, encounterType: encounterTypeUuid, v: customRepresentation, fromdate, todate },
      (value, _key) => value,
    ),
  );

  const url = `${restBaseUrl}/encounter?${params.toString()}`;

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
