import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import useSWR from 'swr';

export interface Provider {
  uuid: string;
  display?: string;
  person?: { uuid: string; display?: string };
  [anythingElse: string]: unknown;
}

export function useProviders(): {
  providers: Provider[];
  isLoading: boolean;
  error: Error | undefined;
  isValidating: boolean;
  mutate: () => void;
} {
  const apiUrl = `${restBaseUrl}/provider`;
  const { data, error, isLoading, isValidating, mutate } = useSWR<{ data: { results: Array<Provider> } }, Error>(
    apiUrl,
    openmrsFetch,
  );

  return {
    providers: data ? data.data?.results : [],
    isLoading,
    error,
    isValidating,
    mutate,
  };
}
