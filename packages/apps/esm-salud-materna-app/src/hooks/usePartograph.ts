import type { OpenmrsResource } from '@openmrs/esm-framework';
import { openmrsFetch, useConfig } from '@openmrs/esm-framework';
import useSWR from 'swr';

import type { ConfigObject } from '../config-schema';
import type { OpenmrsEncounter } from '../types';
import { encounterRepresentation } from '../utils/constants';

export type PartogramProgram = {
  concept: OpenmrsResource;
  obsDatetime: string;
  value: string;
  status: string;
  uuid: string;
  display: string;
};
export function usePartograph(patientUuid: string) {
  const { partography } = useConfig<ConfigObject>();
  const url =
    patientUuid && partography?.encounterTypeUuid && partography?.formUuid
      ? `/ws/rest/v1/encounter?encounterType=${partography.encounterTypeUuid}&formUuid=${partography.formUuid}&patient=${patientUuid}&v=${encounterRepresentation}`
      : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR<{ data: { results: OpenmrsEncounter[] } }, Error>(
    url,
    openmrsFetch,
  );
  const results = data?.data ? data?.data?.results : [];
  const sortedResults = results.slice().sort((a, b) => {
    const dateA = new Date(a.encounterDatetime).getTime();
    const dateB = new Date(b.encounterDatetime).getTime();
    return dateB - dateA;
  });
  const flattedObs = sortedResults
    .flatMap((encounter) => encounter.obs)
    .filter(
      (obs) => !obs?.voided && obs?.concept?.uuid === partography?.progressConceptUuid && obs?.groupMembers?.length,
    )
    .sort((a, b) => {
      const dateA = new Date(a.obsDatetime ?? '').getTime();
      const dateB = new Date(b.obsDatetime ?? '').getTime();
      return dateB - dateA;
    });
  return {
    encounters: flattedObs as Array<OpenmrsEncounter>,
    isLoading,
    isValidating,
    error,
    mutate,
  };
}
