import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import useSWR from 'swr';

import { type Provider } from '../types';

export function useProviders() {
  const apiUrl = `${restBaseUrl}/provider?v=custom:(uuid,display,person:(uuid,display),attributes:(uuid,value,attributeType:(uuid),voided))`;
  const { data, error, isLoading, isValidating } = useSWR<{ data: { results: Array<Provider> } }, Error>(
    apiUrl,
    openmrsFetch,
  );

  return {
    providers: data ? data.data?.results : [],
    isLoading,
    error,
    isValidating,
  };
}
