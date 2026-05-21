import { openmrsFetch, restBaseUrl, useConfig } from '@openmrs/esm-framework';
import type { Encounter } from '@sihsalus/esm-sihsalus-shared';
import useSWR from 'swr';
import type { ConfigObject } from '../config-schema'; // Adjust the import path as needed
import { encounterRepresentation } from '../utils/constants'; // Adjust the import path as needed

export function useImmediateNewbornAttentions(patientUuid: string) {
  const config = useConfig() as ConfigObject;
  const url = `${restBaseUrl}/encounter?patient=${patientUuid}&encounterType=${config.encounterTypes?.prenatalControl}&v=${encounterRepresentation}`;

  const { data, error, isLoading, isValidating, mutate } = useSWR<{ data: { results: Array<Encounter> } }, Error>(
    url,
    openmrsFetch,
  );

  return {
    newbornEncounters: data?.data?.results || [],
    isLoading,
    isValidating,
    error,
    mutate,
  };
}
