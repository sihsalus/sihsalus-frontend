import { restBaseUrl, useOpenmrsFetchAll } from '@openmrs/esm-framework';

import { type Provider } from '../types';

export function useProviders() {
  const apiUrl = `${restBaseUrl}/provider?v=custom:(uuid,display,person:(uuid,display),attributes:(uuid,value,attributeType:(uuid),voided))&limit=100&totalCount=true`;
  const { data, error, isLoading, isValidating } = useOpenmrsFetchAll<Provider>(apiUrl);

  return {
    providers: data ?? [],
    isLoading,
    error,
    isValidating,
  };
}
