import { openmrsFetch, useConfig } from '@openmrs/esm-framework';
import useSWR from 'swr';

import type { ConfigObject } from '../config-schema';
import type { OpenmrsEncounter } from '../types';
import { encounterRepresentation } from '../utils/constants';

export function usePatientTracing(patientUuid: string) {
  const config = useConfig() as ConfigObject;
  const url = `/ws/rest/v1/encounter?encounterType=${config.defaulterTracingEncounterUuid}&patient=${patientUuid}&v=${encounterRepresentation}`;

  const { data, error, isLoading, isValidating, mutate } = useSWR<{ data: { results: OpenmrsEncounter[] } }, Error>(
    url,
    openmrsFetch,
  );

  return {
    encounters: data?.data ? data?.data?.results : [],
    isLoading,
    isValidating,
    error,
    mutate,
  };
}
