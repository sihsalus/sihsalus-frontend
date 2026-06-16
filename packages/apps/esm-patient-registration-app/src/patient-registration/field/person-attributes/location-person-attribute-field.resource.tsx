import { type FetchResponse, fhirBaseUrl, openmrsFetch, useDebounce } from '@openmrs/esm-framework';
import { useMemo } from 'react';
import useSWR from 'swr';

import { type LocationEntry, type LocationResponse } from './esm-service-queues-app-types';

interface UseLocationsResult {
  locations: Array<LocationEntry>;
  isLoading: boolean;
  loadingNewData: boolean;
}

export function useLocations(locationTag: string | null, searchQuery: string = ''): UseLocationsResult {
  const debouncedSearchQuery = useDebounce(searchQuery);

  const constructUrl = useMemo(() => {
    const url = `${fhirBaseUrl}/Location?`;
    const urlSearchParameters = new URLSearchParams();
    urlSearchParameters.append('_summary', 'data');

    if (!debouncedSearchQuery) {
      urlSearchParameters.append('_count', '10');
    }

    if (locationTag) {
      urlSearchParameters.append('_tag', locationTag);
    }

    if (typeof debouncedSearchQuery === 'string' && debouncedSearchQuery !== '') {
      urlSearchParameters.append('name:contains', debouncedSearchQuery);
    }

    return url + urlSearchParameters.toString();
  }, [locationTag, debouncedSearchQuery]);

  const { data, isLoading, isValidating } = useSWR<FetchResponse<LocationResponse>, Error>(constructUrl, openmrsFetch);
  const locationEntries = Array.isArray(data?.data?.entry) ? data.data.entry : [];

  return useMemo(
    () => ({
      locations: locationEntries,
      isLoading,
      loadingNewData: isValidating,
    }),
    [locationEntries, isLoading, isValidating],
  );
}
