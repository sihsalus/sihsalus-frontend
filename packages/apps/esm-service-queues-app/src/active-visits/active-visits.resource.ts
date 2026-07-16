import { openmrsFetch, restBaseUrl, useSession, type Visit } from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import isToday from 'dayjs/plugin/isToday';
import useSWR from 'swr';

dayjs.extend(isToday);

const activeVisitsCacheKey = 'sihsalus-service-queues-active-visits';
const visitPageSize = 100;
const locationPageSize = 100;
const requestConcurrency = 4;
const visitRepresentation =
  'custom:(uuid,patient:(uuid,identifiers:(identifier,uuid),person:(age,display,gender,uuid)),' +
  'visitType:(uuid,name,display),location:(uuid,name,display),startDatetime,stopDatetime)';
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
  const seenLocationUuids = new Set<string>();
  let currentLocation = location;

  while (currentLocation?.uuid && !seenLocationUuids.has(currentLocation.uuid)) {
    if (currentLocation.uuid === ancestorUuid) {
      return true;
    }
    seenLocationUuids.add(currentLocation.uuid);
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

export async function getLocationUuidsAtOrBelow(locationUuid: string): Promise<Array<string>> {
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
      locationUuid,
      ...locations
        .filter((location): location is HierarchicalLocation & { uuid: string } =>
          Boolean(
            !location.retired &&
              location.uuid &&
              location.uuid !== locationUuid &&
              isLocationAtOrBelow(location, locationUuid),
          ),
        )
        .map((location) => location.uuid),
    ]),
  );
}

export async function getActiveVisitsForLocation(locationUuid: string, startDate: string): Promise<Array<Visit>> {
  return fetchAllPages<Visit>((startIndex) => {
    const searchParams = new URLSearchParams({
      fromStartDate: startDate,
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

export async function getAllActiveVisits(locationUuid: string, startDate: string): Promise<Array<Visit>> {
  const locationUuids = await getLocationUuidsAtOrBelow(locationUuid);
  const visitsByLocation = await mapWithConcurrency(
    locationUuids,
    (operationalLocationUuid) => getActiveVisitsForLocation(operationalLocationUuid, startDate),
    requestConcurrency,
  );
  const visitsByUuid = new Map<string, Visit>();

  visitsByLocation.flat().forEach((visit) => {
    if (visit.uuid) {
      visitsByUuid.set(visit.uuid, visit);
    }
  });

  return Array.from(visitsByUuid.values());
}

export function useActiveVisits(locationUuid?: string | null) {
  const sessionLocationUuid = useSession()?.sessionLocation?.uuid;
  const effectiveLocationUuid = locationUuid ?? sessionLocationUuid;
  const startDate = dayjs().format('YYYY-MM-DD');
  const { data, error, isLoading, isValidating } = useSWR<Array<Visit>>(
    effectiveLocationUuid ? [activeVisitsCacheKey, effectiveLocationUuid, startDate] : null,
    () => (effectiveLocationUuid ? getAllActiveVisits(effectiveLocationUuid, startDate) : Promise.resolve([])),
  );

  const uniquePatientUuids = new Set<string>();
  data?.forEach((visit) => {
    const patientUuid = visit.patient?.uuid;
    if (patientUuid && dayjs(visit.startDatetime).isToday()) {
      uniquePatientUuids.add(patientUuid);
    }
  });

  return {
    activeVisitsCount: uniquePatientUuids.size,
    isLoading,
    error,
    isValidating,
  };
}
