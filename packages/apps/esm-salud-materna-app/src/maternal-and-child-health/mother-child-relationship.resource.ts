import { makeUrl, openmrsFetch, restBaseUrl, type FetchResponse } from '@openmrs/esm-framework';
import useSWR from 'swr';

export { useMotherAndChildLinks } from '@openmrs/esm-patient-common-lib';
export type { MotherAndChildLink, MotherAndChildLinkQuery } from '@openmrs/esm-patient-common-lib';

export interface NewbornPatient {
  uuid: string;
  display?: string;
  voided?: boolean;
  person?: {
    uuid?: string;
    display?: string;
    birthdate?: string;
    birthdateEstimated?: boolean;
    voided?: boolean;
  };
  identifiers?: Array<{
    identifier?: string;
    preferred?: boolean;
    voided?: boolean;
  }>;
}

interface PatientSearchResponse {
  results?: Array<NewbornPatient>;
}

const newbornPatientRepresentation =
  'custom:(uuid,display,voided,person:(uuid,display,birthdate,birthdateEstimated,voided),identifiers:(identifier,preferred,voided))';

export function useNewbornPatientSearch(query: string, enabled: boolean) {
  const normalizedQuery = query.trim();
  const searchParams = new URLSearchParams({
    q: normalizedQuery,
    v: newbornPatientRepresentation,
    limit: '10',
  });
  const url =
    enabled && normalizedQuery.length >= 3 ? makeUrl(`${restBaseUrl}/patient?${searchParams.toString()}`) : null;
  const { data, error, isLoading, mutate } = useSWR<FetchResponse<PatientSearchResponse>>(url, openmrsFetch, {
    shouldRetryOnError: false,
  });

  return {
    patients: data?.data?.results ?? [],
    error,
    isLoading,
    mutate,
  };
}

export function createMotherChildRelationship(
  motherUuid: string,
  childPersonUuid: string,
  relationshipTypeUuid: string,
) {
  return openmrsFetch<{ uuid?: string }>(`${restBaseUrl}/relationship`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: {
      personA: motherUuid,
      personB: childPersonUuid,
      relationshipType: relationshipTypeUuid,
    },
  });
}
