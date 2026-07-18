import { type FetchResponse, openmrsFetch, restBaseUrl, userHasAccess, useSession } from '@openmrs/esm-framework';
import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import useSWRInfinite from 'swr/infinite';

import { isPatientSearchTermValid, normalizePatientSearchTerm } from './patient-search-constants';
import type { PatientSearchResponse, SearchedPatient, User } from './types';

type InfinitePatientSearchResponse = FetchResponse<{
  results: Array<SearchedPatient>;
  links: Array<{ rel: 'prev' | 'next' }>;
  totalCount: number;
}>;

const patientProperties = [
  'patientId',
  'uuid',
  'identifiers',
  'display',
  'patientIdentifier:(uuid,identifier)',
  'person:(gender,age,birthdate,birthdateEstimated,personName:(display,givenName,middleName,familyName,familyName2),addresses,display,dead,deathDate)',
  'attributes:(display,value,attributeType:(uuid,display))',
];

const patientSearchCustomRepresentation = `custom:(${patientProperties.join(',')})`;

function getResponseStatus(error: unknown) {
  const responseStatus =
    typeof error === 'object' && error
      ? ((error as { response?: { status?: number }; status?: number }).response?.status ??
        (error as { status?: number }).status)
      : undefined;

  if (responseStatus) {
    return responseStatus;
  }

  const statusFromMessage = error instanceof Error ? error.message.match(/\b([45]\d{2})\b/)?.[1] : undefined;
  return statusFromMessage ? Number(statusFromMessage) : undefined;
}

export function isForbiddenUserPropertiesError(error: unknown) {
  const responseStatus = getResponseStatus(error);

  return responseStatus === 403;
}

async function fetchRecentlyViewedPatient(url: string): Promise<FetchResponse<SearchedPatient> | null> {
  try {
    return await openmrsFetch<SearchedPatient>(url);
  } catch (error) {
    // A patient may be removed after their UUID was saved in patientsVisited. That stale
    // preference must not prevent the remaining recent patients or global search from loading.
    if (getResponseStatus(error) === 404) {
      return null;
    }

    throw error;
  }
}

const userPropertiesWritePrivileges = ['Edit Users', 'Manage Users', 'Edit User Properties'];

/**
 * A custom React hook for implementing infinite scrolling patient search.
 *
 * @param searchQuery - The string to search for in patient records.
 * @param includeDead - Whether to include deceased patients in the search results.
 * @param isSearching - Whether the search should be active. Defaults to true.
 * @param resultsToFetch - The number of results to fetch per page. Defaults to 10.
 * @param customRepresentation - Custom representation string for the patient data. Defaults to patientSearchCustomRepresentation.
 *
 * @returns An object containing:
 *   - data: Array of patient search results
 *   - isLoading: Boolean indicating if the initial data is loading
 *   - fetchError: Any error that occurred during fetching
 *   - hasMore: Boolean indicating if there are more results to load
 *   - isValidating: Boolean indicating if new data is being loaded
 *   - setPage: Function to load the next page of results
 *   - currentPage: The current page number
 *   - totalResults: The total number of results for the search query
 */
export function useInfinitePatientSearch(
  searchQuery: string,
  includeDead: boolean,
  isSearching: boolean = true,
  resultsToFetch: number = 10,
  customRepresentation: string = patientSearchCustomRepresentation,
): PatientSearchResponse {
  const normalizedSearchQuery = normalizePatientSearchTerm(searchQuery);
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
        q: normalizedSearchQuery,
        v: customRepresentation,
        includeDead: includeDead.toString(),
        limit: resultsToFetch.toString(),
        totalCount: 'true',
        ...(page ? { startIndex: (page * resultsToFetch).toString() } : {}),
      });

      return `${baseUrl}?${params.toString()}`;
    },
    [normalizedSearchQuery, customRepresentation, includeDead, resultsToFetch],
  );

  const shouldFetch = isSearching && isPatientSearchTermValid(normalizedSearchQuery);

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

const activeVisitPatientsCacheKey = 'sihsalus-patient-search-active-visit-patients';
const activeVisitsPageSize = 100;

interface ActiveVisitPatientReference {
  uuid?: string;
  patient?: { uuid?: string };
}

export async function getActiveVisitPatientUuids() {
  const patientUuids = new Set<string>();
  const seenVisitUuids = new Set<string>();

  for (let startIndex = 0; ; startIndex += activeVisitsPageSize) {
    const searchParams = new URLSearchParams({
      includeInactive: 'false',
      includeParentLocations: 'true',
      limit: String(activeVisitsPageSize),
      startIndex: String(startIndex),
      v: 'custom:(uuid,patient:(uuid))',
    });
    const response = await openmrsFetch<{ results?: Array<ActiveVisitPatientReference> }>(
      `${restBaseUrl}/visit?${searchParams.toString()}`,
    );
    const page = response.data?.results ?? [];
    let addedVisits = 0;

    for (const visit of page) {
      if (visit.uuid && !seenVisitUuids.has(visit.uuid)) {
        seenVisitUuids.add(visit.uuid);
        addedVisits += 1;
        if (visit.patient?.uuid) {
          patientUuids.add(visit.patient.uuid);
        }
      }
    }

    if (page.length < activeVisitsPageSize || addedVisits === 0) {
      break;
    }
  }

  return [...patientUuids];
}

export function useActiveVisitPatientUuids(enabled: boolean) {
  const { data, error, isLoading } = useSWR<Array<string>>(
    enabled ? activeVisitPatientsCacheKey : null,
    getActiveVisitPatientUuids,
  );
  const patientUuids = useMemo(() => new Set(data ?? []), [data]);

  return { patientUuids, error, isLoading: enabled && isLoading };
}

/**
 * A custom React hook for managing and retrieving the list of recently viewed patients.
 * Recent patient UUIDs are read from the active session to avoid requiring user-management privileges.
 *
 * @param showRecentlySearchedPatients - A boolean flag to enable/disable the feature. Defaults to false.
 * @returns An object containing:
 *   - error: Always null; the hook does not fetch the user resource.
 *   - isLoadingPatients: Always false; recently viewed patients are read from session data.
 *   - recentlyViewedPatientUuids: Array of UUIDs of recently viewed patients
 *   - updateRecentlyViewedPatients: Function to persist a new patient UUID when permitted
 *   - mutateUserProperties: Compatibility no-op retained for existing consumers
 */
export function useRecentlyViewedPatients(showRecentlySearchedPatients: boolean = false) {
  const { user } = useSession();
  const userUuid = user?.uuid;
  const url = userUuid ? `${restBaseUrl}/user/${userUuid}` : null;
  const userProperties = user?.userProperties as User['userProperties'] | undefined;
  const sessionPatientsVisited = showRecentlySearchedPatients ? userProperties?.patientsVisited : undefined;
  const canPersistUserProperties = useMemo(
    () => (user ? userPropertiesWritePrivileges.some((privilege) => userHasAccess(privilege, user)) : false),
    [user],
  );

  const initialPatientsVisited = useMemo(
    () => sessionPatientsVisited?.split(',').filter(Boolean) ?? [],
    [sessionPatientsVisited],
  );
  const [patientsVisited, setPatientsVisited] = useState(initialPatientsVisited);

  useEffect(() => {
    setPatientsVisited(initialPatientsVisited);
  }, [initialPatientsVisited]);

  const updateRecentlyViewedPatients = useCallback(
    (patientUuid: string) => {
      if (!showRecentlySearchedPatients || !url) {
        return Promise.resolve();
      }

      const uniquePatients = Array.from(new Set([patientUuid, ...patientsVisited]));
      const mostRecentPatients = uniquePatients.slice(0, 10);
      setPatientsVisited(mostRecentPatients);

      if (!canPersistUserProperties) {
        return Promise.resolve();
      }

      const newUserProperties = { ...userProperties, patientsVisited: mostRecentPatients.join(',') };

      return openmrsFetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: {
          userProperties: newUserProperties,
        },
      });
    },
    [canPersistUserProperties, patientsVisited, showRecentlySearchedPatients, url, userProperties],
  );

  const mutateUserProperties = useCallback(() => Promise.resolve(), []);

  return useMemo(
    () => ({
      error: null,
      isLoadingPatients: false,
      recentlyViewedPatientUuids: patientsVisited,
      updateRecentlyViewedPatients,
      mutateUserProperties,
    }),
    [mutateUserProperties, patientsVisited, updateRecentlyViewedPatients],
  );
}

/**
 * A custom React hook for fetching patient data from a REST API based on a list of patient UUIDs.
 *
 * @param patientUuids - An array of patient UUIDs to fetch data for. If null, no data will be fetched.
 * @param isSearching - A boolean flag to determine if the search should be performed. Defaults to true.
 * @param resultsToFetch - The number of results to fetch at a time. Defaults to 10.
 * @param customRepresentation - A string representing the custom representation of patient data to fetch. Defaults to a predefined value 'v'.
 *
 * @returns An object containing:
 *   - data: An array of fetched patient data
 *   - isLoading: A boolean indicating if the initial data is being loaded
 *   - fetchError: Any error that occurred during fetching
 *   - hasMore: A boolean indicating if there are more patients to load
 *   - isValidating: A boolean indicating if new data is being loaded
 *   - setPage: A function to load more data
 *   - currentPage: The current page of results
 *   - totalResults: The total number of patients to be fetched
 */

export function useRestPatients(
  patientUuids: string[] | null,
  isSearching: boolean = true,
  resultsToFetch: number = 10,
  customRepresentation: string = patientSearchCustomRepresentation,
) {
  const getPatientUrl = useCallback(
    (index: number) => {
      if (patientUuids && index < patientUuids.length) {
        return `${restBaseUrl}/patient/${patientUuids[index]}?v=${customRepresentation}`;
      } else {
        return null;
      }
    },
    [patientUuids, customRepresentation],
  );

  const shouldFetch = isSearching && patientUuids !== null && patientUuids.length > 0;

  const { data, isLoading, isValidating, setSize, error, size } = useSWRInfinite<
    FetchResponse<SearchedPatient> | null,
    Error
  >(shouldFetch ? getPatientUrl : null, fetchRecentlyViewedPatient, {
    keepPreviousData: true,
    initialSize: patientUuids ? Math.min(resultsToFetch, patientUuids.length) : 0,
  });

  const mappedData = data?.flatMap((res) => (res?.data ? [res.data] : [])) ?? null;

  return useMemo(
    () => ({
      data: mappedData,
      isLoading,
      fetchError: error,
      hasMore: patientUuids ? size < patientUuids.length : false,
      isValidating,
      setPage: setSize,
      currentPage: size,
      totalResults: patientUuids?.length ?? 0,
    }),
    [mappedData, isLoading, error, patientUuids, size, isValidating, setSize],
  );
}
