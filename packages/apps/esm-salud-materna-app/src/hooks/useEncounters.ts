import type { FetchResponse } from '@openmrs/esm-framework';
import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import pickBy from 'lodash-es/pickBy';
import useSWR from 'swr';

import type { Encounter } from '../types';

const useEncounters = (patientUuid: string, encounterTypeUuid: string, fromdate?: string, todate?: string) => {
  const customeRepresntation = 'custom:(uuid,display,encounterDatetime,obs:(uuid,display,value:(uuid,display)))';

  const params = new URLSearchParams(
    pickBy(
      { patient: patientUuid, encounterType: encounterTypeUuid, v: customeRepresntation, fromdate, todate },
      (value, _key) => value,
    ),
  );

  const url = `${restBaseUrl}/encounter?${params.toString()}`;

  const { data, isLoading, error, mutate } = useSWR<FetchResponse<{ results: Array<Encounter> }>>(url, openmrsFetch);
  return {
    encounters: data?.data?.results ?? [],
    isLoading,
    error,
    mutate,
  };
};

export default useEncounters;
