import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import useSWR from 'swr';

const activeVisitsCacheKey = 'sihsalus-active-visits-with-appointment-links';
const activeVisitsPageSize = 200;
const activeVisitRepresentation =
  'custom:(uuid,patient:(uuid),startDatetime,stopDatetime,attributes:(value,attributeType:(uuid)))';

interface ActiveAppointmentVisit {
  uuid: string;
  patient?: { uuid?: string };
  startDatetime?: string;
  stopDatetime?: string | null;
  attributes?: Array<{
    value?: unknown;
    attributeType?: { uuid?: string };
  }>;
}

export async function getAllActiveVisits() {
  const visits: Array<ActiveAppointmentVisit> = [];
  const seenVisitUuids = new Set<string>();

  for (let startIndex = 0; ; startIndex += activeVisitsPageSize) {
    const searchParams = new URLSearchParams({
      includeInactive: 'false',
      includeParentLocations: 'true',
      limit: String(activeVisitsPageSize),
      startIndex: String(startIndex),
      v: activeVisitRepresentation,
    });
    const response = await openmrsFetch<{ results?: Array<ActiveAppointmentVisit> }>(
      `${restBaseUrl}/visit?${searchParams.toString()}`,
    );
    const page = response.data?.results ?? [];
    let addedVisits = 0;

    for (const visit of page) {
      if (visit.uuid && !seenVisitUuids.has(visit.uuid)) {
        seenVisitUuids.add(visit.uuid);
        visits.push(visit);
        addedVisits += 1;
      }
    }

    if (page.length < activeVisitsPageSize || addedVisits === 0) {
      break;
    }
  }

  return visits;
}

/**
 * Custom hook to fetch visits from the OpenMRS REST API.
 * Fetches all active visits, including visits that started before today.
 * @returns An object containing the visits, isLoading flag, and error message.
 */
export const useTodaysVisits = () => {
  const { data, error, isLoading, mutate } = useSWR<Array<ActiveAppointmentVisit>>(
    activeVisitsCacheKey,
    getAllActiveVisits,
  );
  const visits = data ?? [];

  return { isLoading, visits, error, mutateVisit: mutate };
};
