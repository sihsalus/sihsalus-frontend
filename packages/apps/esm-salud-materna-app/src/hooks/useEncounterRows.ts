import { openmrsFetch } from '@openmrs/esm-framework';
import isNull from 'lodash-es/isNull';
import { useCallback, useMemo } from 'react';
import useSWRImmutable, { mutate } from 'swr';

import type { OpenmrsEncounter } from '../types';

export const encounterRepresentation =
  'custom:(uuid,encounterDatetime,encounterType,location:(uuid,name),' +
  'patient:(uuid,display),encounterProviders:(uuid,provider:(uuid,name)),' +
  'obs:(uuid,obsDatetime,voided,groupMembers,concept:(uuid,name:(uuid,name)),value:(uuid,name:(uuid,name),' +
  'names:(uuid,conceptNameType,name))),form:(uuid,name))';
export interface OpenmrsResource {
  uuid: string;
  display?: string;
  [anythingElse: string]: unknown;
}

export function useEncounterRows(
  patientUuid: string,
  encounterType: string,
  encounterFilter: (encounter: OpenmrsEncounter) => boolean,
) {
  const url = `/ws/rest/v1/encounter?encounterType=${encounterType}&patient=${patientUuid}&v=${encounterRepresentation}`;

  const { data, error, isLoading } = useSWRImmutable<{ data: { results: Array<OpenmrsEncounter> } }, Error>(
    url,
    openmrsFetch,
  );

  const sortedAndFilteredEncounters = useMemo(() => {
    if (!isLoading && !isNull(data?.data?.results)) {
      const sortedEncounters = sortEncounters(data?.data?.results);
      return encounterFilter ? sortedEncounters.filter(encounterFilter) : sortedEncounters;
    }
    return [];
  }, [data, encounterFilter, isLoading]);

  const onFormSave = useCallback(() => {
    mutate(url);
  }, [url]);

  return {
    encounters: sortedAndFilteredEncounters,
    isLoading,
    error,
    onFormSave,
  };
}

function sortEncounters(encounters: OpenmrsEncounter[]): OpenmrsEncounter[] {
  if (encounters?.length > 0) {
    return [...encounters]?.sort(
      (a, b) => new Date(b.encounterDatetime).getTime() - new Date(a.encounterDatetime).getTime(),
    );
  } else {
    return [];
  }
}
