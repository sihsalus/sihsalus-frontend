import { makeUrl, openmrsFetch, restBaseUrl, useOpenmrsFetchAll, type FetchResponse } from '@openmrs/esm-framework';
import useSWR from 'swr';

export interface MotherAndChildLink {
  mother: { uuid: string };
  child: { uuid: string; display?: string };
}

export interface MotherAndChildLinkQuery {
  motherUuid?: string;
  childUuid?: string;
}

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

const motherAndChildRepresentation = 'custom:(mother:(uuid),child:(uuid,display))';
const newbornPatientRepresentation =
  'custom:(uuid,display,voided,person:(uuid,display,birthdate,birthdateEstimated,voided),identifiers:(identifier,preferred,voided))';

export function useMotherAndChildLinks(query: MotherAndChildLinkQuery, enabled: boolean) {
  const url = new URL(makeUrl(`${restBaseUrl}/emrapi/maternal/mothersAndChildren`), window.location.toString());
  if (query.motherUuid) {
    url.searchParams.set('mother', query.motherUuid);
  }
  if (query.childUuid) {
    url.searchParams.set('child', query.childUuid);
  }
  url.searchParams.set('requireMotherHasActiveVisit', 'false');
  url.searchParams.set('requireChildHasActiveVisit', 'false');
  url.searchParams.set('requireChildBornDuringMothersActiveVisit', 'false');
  url.searchParams.set('v', motherAndChildRepresentation);

  return useOpenmrsFetchAll<MotherAndChildLink>(enabled && (query.motherUuid || query.childUuid) ? url : null);
}

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
