import { openmrsFetch, restBaseUrl, type FetchResponse } from '@openmrs/esm-framework';

export interface CompanionRecord {
  relationshipUuid: string;
  personUuid: string;
  name: string;
}

export interface PersonSearchResult {
  uuid: string;
  display: string;
  age?: number;
  birthdate?: string;
}

export interface NewCompanionPersonPayload {
  names: Array<{
    givenName: string;
    middleName?: string;
    familyName: string;
    familyName2?: string;
    preferred: boolean;
  }>;
  gender: string;
  birthdate: string;
  birthdateEstimated: boolean;
}

interface RelationshipResponse {
  uuid: string;
}

interface PersonResponse {
  uuid: string;
  display?: string;
}

export async function createCompanionRelationship(
  patientUuid: string,
  companionPersonUuid: string,
  relationshipTypeUuid: string,
) {
  const response = await openmrsFetch<RelationshipResponse>(`${restBaseUrl}/relationship`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: {
      // SIH SALUS configures Acompañante as aIsToB: the companion is A and the patient is B.
      personA: companionPersonUuid,
      personB: patientUuid,
      relationshipType: relationshipTypeUuid,
    },
  });

  if (!response.data?.uuid) {
    throw new Error('The backend did not return the companion relationship UUID.');
  }

  return response.data.uuid;
}

export async function createCompanionPerson(payload: NewCompanionPersonPayload) {
  const response = await openmrsFetch<PersonResponse>(`${restBaseUrl}/person`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
  });

  if (!response.data?.uuid) {
    throw new Error('The backend did not return the new person UUID.');
  }

  return response.data;
}

export type PersonSearchResponse = FetchResponse<{ results: Array<PersonSearchResult> }>;
