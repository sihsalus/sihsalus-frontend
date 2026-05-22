import { openmrsFetch } from '@openmrs/esm-framework';
import sortBy from 'lodash-es/sortBy';
import useSWR from 'swr';

import type { OpenmrsEncounter } from '../types';

export const clinicalEncounterRepresentation =
  'custom:(uuid,encounterDatetime,encounterType,location:(uuid,name),diagnoses:(uuid,diagnosis:(coded:(display))),' +
  'patient:(uuid,display),encounterProviders:(uuid,provider:(uuid,name)),' +
  'obs:(uuid,obsDatetime,voided,groupMembers,concept:(uuid,name:(uuid,name)),value:(uuid,name:(uuid,name),' +
  'names:(uuid,conceptNameType,name))),form:(uuid,name))';

export function useClinicalEncounter(
  encounterTypeUuid: string,
  formUuid: string,
  patientUuid: string,
  conceptUuid: string[],
) {
  const url = `/ws/rest/v1/encounter?formUuid=${formUuid}&patient=${patientUuid}&encounterType=${encounterTypeUuid}&conceptUuid=${conceptUuid.toString()}&v=${clinicalEncounterRepresentation}`;
  const { data, error, isLoading, isValidating, mutate } = useSWR<{ data: { results: OpenmrsEncounter[] } }, Error>(
    url,
    openmrsFetch,
  );
  const sortedClinicalEncounter = sortBy(data?.data?.results, 'encounterDatetime').reverse();
  return {
    encounters: sortedClinicalEncounter,
    isLoading,
    isValidating,
    error,
    mutate,
  };
}
