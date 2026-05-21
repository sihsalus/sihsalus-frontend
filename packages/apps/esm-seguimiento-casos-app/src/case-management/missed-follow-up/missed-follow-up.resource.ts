import { openmrsFetch, useConfig } from '@openmrs/esm-framework';
import useSWR from 'swr';

import type { ConfigObject } from '../../config-schema';
import type { OpenmrsEncounter } from '../../types';
import { encounterRepresentation } from '../../utils/constants';

export function useMissedFollowUp(patientUuid: string) {
  const config = useConfig<ConfigObject>();
  const encounterTypeUuid = config.defaulterTracingEncounterUuid;
  const url = `/ws/rest/v1/encounter?encounterType=${encounterTypeUuid}&patient=${patientUuid}&v=${encounterRepresentation}`;

  const { data, error, isLoading, isValidating, mutate } = useSWR<{ data: { results: OpenmrsEncounter[] } }, Error>(
    encounterTypeUuid && patientUuid ? url : null,
    openmrsFetch,
  );

  return {
    encounters: data?.data?.results ?? [],
    isLoading,
    isValidating,
    error,
    mutate,
  };
}
