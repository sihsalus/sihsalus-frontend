import { openmrsFetch, useConfig } from '@openmrs/esm-framework';
import useSWR from 'swr';
import type { Config } from '../config-schema';
import { type Identifier } from '../types';

export function useHsuIdIdentifier(patientUuid: string) {
  const { hsuIdentifierTypeUuid } = useConfig<Config>();
  const url = patientUuid ? `ws/rest/v1/patient/${patientUuid}/identifier` : null;
  const { data, error, isValidating } = useSWR<{ data: { results: Array<Identifier> } }, Error>(url, openmrsFetch);

  const hsuIdentifier = data?.data?.results.length
    ? data.data.results.find((id: Identifier) => id.identifierType.uuid === hsuIdentifierTypeUuid)
    : undefined;

  return {
    hsuIdentifier: hsuIdentifier,
    isLoading: !data && !error,
    isError: error,
    isValidating,
  };
}
