/**
 * Custom hook for patient search with infinite scroll
 * Based on OpenMRS patient search patterns
 */

import { type FetchResponse, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { useCallback, useMemo } from 'react';
import useSWRInfinite from 'swr/infinite';
import type { SearchedPatient } from './types';

type InfinitePatientSearchResponse = FetchResponse<{
  results: Array<SearchedPatient>;
  links: Array<{ rel: 'prev' | 'next' }>;
  totalCount: number;
}>;

export interface PatientSearchResponse {
  data: SearchedPatient[] | null;
  isLoading: boolean;
  fetchError: Error | undefined;
  hasMore: boolean;
  isValidating: boolean;
  setPage: (size: number | ((size: number) => number)) => Promise<InfinitePatientSearchResponse[] | undefined>;
  currentPage: number;
  totalResults: number;
}

// Patient properties to fetch from API
const patientProperties = [
  'patientId',
  'uuid',
  'identifiers',
  'display',
  'patientIdentifier:(uuid,identifier)',
  'person:(gender,age,birthdate,birthdateEstimated,personName,addresses,display,dead,deathDate)',
  'attributes:(value,attributeType:(uuid,display))',
];

const patientSearchCustomRepresentation = `custom:(${patientProperties.join(',')})`;

/**
 * Hook for searching patients with infinite scroll capability
 *
 * @param searchQuery - The search term (name, HCE, or identity document)
 * @param includeDead - Whether to include deceased patients
 * @param isSearching - Whether search is active
 * @param resultsToFetch - Number of results per page
 * @returns Patient search response with pagination
 */
export function usePatientSearch(
  searchQuery: string,
  includeDead: boolean = false,
  isSearching: boolean = true,
  resultsToFetch: number = 10,
): PatientSearchResponse {
  const getUrl = useCallback(
    (
      page: number,
      prevPageData: FetchResponse<{ results: Array<SearchedPatient>; links: Array<{ rel: 'prev' | 'next' }> }>,
    ) => {
      if (prevPageData && !prevPageData?.data?.links.some((link) => link.rel === 'next')) {
        return null;
      }

      const baseUrl = `${restBaseUrl}/patient`;
      const params = new URLSearchParams({
        q: searchQuery,
        v: patientSearchCustomRepresentation,
        includeDead: includeDead.toString(),
        limit: resultsToFetch.toString(),
        totalCount: 'true',
        ...(page ? { startIndex: (page * resultsToFetch).toString() } : {}),
      });

      return `${baseUrl}?${params.toString()}`;
    },
    [searchQuery, includeDead, resultsToFetch],
  );

  const shouldFetch = isSearching && searchQuery && searchQuery.length >= 2;

  const { data, isLoading, isValidating, setSize, error, size } = useSWRInfinite<InfinitePatientSearchResponse, Error>(
    shouldFetch ? getUrl : null,
    openmrsFetch,
  );

  const mappedData = data?.flatMap((res) => res.data?.results ?? []) ?? null;

  return useMemo(
    () => ({
      data: mappedData,
      isLoading,
      fetchError: error,
      hasMore: data?.at(-1)?.data?.links?.some((link) => link.rel === 'next') ?? false,
      isValidating,
      setPage: setSize,
      currentPage: size,
      totalResults: data?.[0]?.data?.totalCount ?? 0,
    }),
    [mappedData, isLoading, error, data, isValidating, setSize, size],
  );
}
