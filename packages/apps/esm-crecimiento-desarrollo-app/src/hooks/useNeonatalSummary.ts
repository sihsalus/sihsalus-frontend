import { openmrsFetch, useConfig } from '@openmrs/esm-framework';
import useSWR from 'swr';

import type { ConfigObject } from '../config-schema';
import type { OpenmrsEncounter } from '../types';
import { encounterRepresentation } from '../utils/constants';

export function useNeonatalSummary(patientUuid: string, encounterType: string) {
  const { encounterTypes, formsList } = useConfig<ConfigObject>();
  const resolvedEncounterType = encounterType || encounterTypes.deliveryRoomCare;
  const url = `/ws/rest/v1/encounter?encounterType=${resolvedEncounterType}&patient=${patientUuid}&v=${encounterRepresentation}`;

  const { data, error, isLoading, isValidating, mutate } = useSWR<{ data: { results: OpenmrsEncounter[] } }, Error>(
    url,
    openmrsFetch,
  );

  const neonatalEncounter = data?.data?.results?.filter((enc) => enc.form.uuid === formsList.deliveryOrAbortion);

  return {
    encounters: data?.data ? neonatalEncounter : [],
    isLoading,
    isValidating,
    error,
    mutate,
  };
}
