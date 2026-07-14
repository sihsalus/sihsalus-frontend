import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import useSWR from 'swr';

const activeVisitsCacheKey = 'sihsalus-active-visits-with-appointment-links';
// Stay within the OpenMRS REST absolute page-size default so this MFE does not
// depend on a distro-specific `webservices.rest.maxResultsAbsolute` override.
const activeVisitsPageSize = 100;
const patientRequestConcurrency = 5;
const activeVisitRepresentation =
  'custom:(uuid,patient:(uuid),startDatetime,stopDatetime,attributes:(value,attributeType:(uuid)))';

export interface ActiveAppointmentVisit {
  uuid: string;
  patient?: { uuid?: string };
  startDatetime?: string;
  stopDatetime?: string | null;
  attributes?: Array<{
    value?: unknown;
    attributeType?: { uuid?: string };
  }>;
}

async function getActiveVisitsForPatient(patientUuid: string) {
  const visits: Array<ActiveAppointmentVisit> = [];
  const seenVisitUuids = new Set<string>();

  for (let startIndex = 0; ; startIndex += activeVisitsPageSize) {
    const searchParams = new URLSearchParams({
      includeInactive: 'false',
      limit: String(activeVisitsPageSize),
      patient: patientUuid,
      startIndex: String(startIndex),
      v: activeVisitRepresentation,
    });
    const response = await openmrsFetch<{ results?: Array<ActiveAppointmentVisit> }>(
      `${restBaseUrl}/visit?${searchParams.toString()}`,
    );
    const page = response.data?.results;
    if (!Array.isArray(page)) {
      throw new Error('Invalid active-visits response');
    }
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

export async function getActiveVisitsForPatients(patientUuids: Array<string>) {
  const uniquePatientUuids = [...new Set(patientUuids.filter(Boolean))].sort();
  const visits: Array<ActiveAppointmentVisit> = [];
  const seenVisitUuids = new Set<string>();

  for (let index = 0; index < uniquePatientUuids.length; index += patientRequestConcurrency) {
    const batch = uniquePatientUuids.slice(index, index + patientRequestConcurrency);
    const visitsByPatient = await Promise.all(batch.map(getActiveVisitsForPatient));

    for (const patientVisits of visitsByPatient) {
      for (const visit of patientVisits) {
        if (!seenVisitUuids.has(visit.uuid)) {
          seenVisitUuids.add(visit.uuid);
          visits.push(visit);
        }
      }
    }
  }

  return visits;
}

/**
 * Custom hook to fetch visits from the OpenMRS REST API.
 * Fetches active visits only for the patients visible to the caller.
 * @returns An object containing the visits, isLoading flag, and error message.
 */
export const useTodaysVisits = (patientUuids: Array<string>) => {
  const scopedPatientUuids = [...new Set(patientUuids.filter(Boolean))].sort();
  const { data, error, isLoading, mutate } = useSWR<Array<ActiveAppointmentVisit>>(
    scopedPatientUuids.length ? [activeVisitsCacheKey, ...scopedPatientUuids] : null,
    () => getActiveVisitsForPatients(scopedPatientUuids),
  );
  const visits = data ?? [];

  return { isLoading, visits, error, mutateVisit: mutate };
};
