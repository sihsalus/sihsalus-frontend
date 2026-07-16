import { openmrsFetch, restBaseUrl, useSession, type Visit } from '@openmrs/esm-framework';
import useSWR from 'swr';

const visitPageSize = 50;
const locationPageSize = 100;
const requestConcurrency = 4;
const activeVisitsCacheKey = 'sihsalus-facility-active-visits';
const visitRepresentation =
  'custom:(uuid,patient:(uuid,identifiers:(identifier,uuid,identifierType:(name,uuid)),' +
  'person:(age,display,gender,uuid,attributes:(value,attributeType:(uuid,display)))),' +
  'visitType:(uuid,name,display),location:(uuid,name,display),startDatetime,stopDatetime,' +
  'encounters:(encounterDatetime,obs:(uuid,concept:(uuid,display),value)))';
const locationRepresentation =
  'custom:(uuid,retired,parentLocation:(uuid,parentLocation:(uuid,parentLocation:(uuid,parentLocation:(uuid)))))';

interface SearchResponse<T> {
  results?: Array<T>;
}

export interface HierarchicalLocation {
  uuid?: string;
  retired?: boolean;
  parentLocation?: HierarchicalLocation;
}

export function isLocationAtOrBelow(location: HierarchicalLocation | undefined, ancestorUuid: string): boolean {
  const seenUuids = new Set<string>();
  let currentLocation = location;

  while (currentLocation?.uuid && !seenUuids.has(currentLocation.uuid)) {
    if (currentLocation.uuid === ancestorUuid) {
      return true;
    }
    seenUuids.add(currentLocation.uuid);
    currentLocation = currentLocation.parentLocation;
  }

  return false;
}

async function fetchAllPages<T>(buildUrl: (startIndex: number) => string, pageSize: number): Promise<Array<T>> {
  const results: Array<T> = [];

  for (let startIndex = 0; ; startIndex += pageSize) {
    const response = await openmrsFetch<SearchResponse<T>>(buildUrl(startIndex));
    const page = response.data?.results ?? [];
    results.push(...page);

    if (page.length < pageSize) {
      break;
    }
  }

  return results;
}

export async function getFacilityLocationUuids(facilityLocationUuid: string): Promise<Array<string>> {
  const locations = await fetchAllPages<HierarchicalLocation>((startIndex) => {
    const searchParams = new URLSearchParams({
      limit: String(locationPageSize),
      startIndex: String(startIndex),
      tag: 'Visit Location',
      v: locationRepresentation,
    });
    return `${restBaseUrl}/location?${searchParams.toString()}`;
  }, locationPageSize);

  return Array.from(
    new Set([
      facilityLocationUuid,
      ...locations
        .filter((location): location is HierarchicalLocation & { uuid: string } =>
          Boolean(
            !location.retired &&
              location.uuid &&
              location.uuid !== facilityLocationUuid &&
              isLocationAtOrBelow(location, facilityLocationUuid),
          ),
        )
        .map((location) => location.uuid),
    ]),
  );
}

export async function getActiveVisitsForLocation(locationUuid: string): Promise<Array<Visit>> {
  return fetchAllPages<Visit>((startIndex) => {
    const searchParams = new URLSearchParams({
      includeInactive: 'false',
      limit: String(visitPageSize),
      location: locationUuid,
      startIndex: String(startIndex),
      v: visitRepresentation,
    });
    return `${restBaseUrl}/visit?${searchParams.toString()}`;
  }, visitPageSize);
}

async function mapWithConcurrency<T, R>(
  items: Array<T>,
  worker: (item: T) => Promise<R>,
  concurrency: number,
): Promise<Array<R>> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  const runWorker = async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      const item = items[index];
      if (item !== undefined) {
        results[index] = await worker(item);
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runWorker));
  return results;
}

export async function getFacilityActiveVisits(facilityLocationUuid: string): Promise<Array<Visit>> {
  const locationUuids = await getFacilityLocationUuids(facilityLocationUuid);
  const visitsByLocation = await mapWithConcurrency(locationUuids, getActiveVisitsForLocation, requestConcurrency);
  const visitsByUuid = new Map<string, Visit>();

  visitsByLocation.flat().forEach((visit) => {
    if (visit.uuid) {
      visitsByUuid.set(visit.uuid, visit);
    }
  });

  return Array.from(visitsByUuid.values());
}

export function useFacilityActiveVisits() {
  const facilityLocationUuid = useSession()?.sessionLocation?.uuid;
  const { data, error, isLoading, isValidating } = useSWR<Array<Visit>, Error>(
    facilityLocationUuid ? [activeVisitsCacheKey, facilityLocationUuid] : null,
    () => (facilityLocationUuid ? getFacilityActiveVisits(facilityLocationUuid) : Promise.resolve([])),
  );
  const visits = data ?? [];

  return {
    visits,
    error,
    isLoading,
    isValidating,
    totalResults: visits.length,
  };
}
