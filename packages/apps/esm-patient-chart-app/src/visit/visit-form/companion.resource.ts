import { openmrsFetch, restBaseUrl, type FetchResponse } from '@openmrs/esm-framework';

export interface CompanionRecord {
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

interface PersonResponse {
  uuid: string;
  display?: string;
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

export async function getCompanionPerson(personUuid: string) {
  const response = await openmrsFetch<PersonResponse>(`${restBaseUrl}/person/${personUuid}?v=custom:(uuid,display)`);

  if (!response.data?.uuid) {
    throw new Error('The backend did not return the companion person.');
  }

  return response.data;
}

export function getVisitCompanionPersonUuid(
  attributes: Array<unknown> | null | undefined,
  companionVisitAttributeTypeUuid: string | null | undefined,
) {
  if (!companionVisitAttributeTypeUuid) {
    return undefined;
  }

  const companionAttribute = attributes?.find((attribute) => {
    if (!attribute || typeof attribute !== 'object' || !('attributeType' in attribute)) {
      return false;
    }

    const attributeType = attribute.attributeType;
    return (
      attributeType &&
      typeof attributeType === 'object' &&
      'uuid' in attributeType &&
      attributeType.uuid === companionVisitAttributeTypeUuid
    );
  });
  const value =
    companionAttribute && typeof companionAttribute === 'object' && 'value' in companionAttribute
      ? companionAttribute.value
      : undefined;

  if (value && typeof value === 'object' && 'uuid' in value) {
    return String(value.uuid || '') || undefined;
  }

  return value ? String(value) : undefined;
}

export function withVisitCompanionAttribute(
  visitAttributes: Record<string, string>,
  companionVisitAttributeTypeUuid: string | null | undefined,
  companionPersonUuid: string | null | undefined,
) {
  if (!companionVisitAttributeTypeUuid) {
    return visitAttributes;
  }

  return {
    ...visitAttributes,
    [companionVisitAttributeTypeUuid]: companionPersonUuid ?? '',
  };
}

export type PersonSearchResponse = FetchResponse<{
  results: Array<PersonSearchResult>;
}>;
