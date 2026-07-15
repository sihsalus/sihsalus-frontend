import { openmrsFetch, restBaseUrl, useConfig } from '@openmrs/esm-framework';
import useSWR from 'swr';
import { type ConfigObject } from '../config-schema';

const customRepresentation =
  'custom:(display,uuid,personA:(age,display,birthdate,uuid),personB:(age,display,birthdate,uuid),relationshipType:(uuid,display,description,aIsToB,bIsToA,weight))';
const companionRelationshipTypeUuid = '3501ac02-0fb0-4ced-8a3e-f578f0ff5276';

export function useRelationships(patientUuid: string) {
  const { familyRelationshipTypeUuids = [] } = useConfig<ConfigObject>();
  const apiUrl = `${restBaseUrl}/relationship?v=${customRepresentation}&person=${patientUuid}`;

  const { data, error, isLoading, isValidating } = useSWR<{ data: RelationshipsResponse }, Error>(
    patientUuid ? apiUrl : null,
    openmrsFetch,
  );

  const familyRelationshipTypes = new Set(familyRelationshipTypeUuids);
  const familyRelationships = data?.data?.results?.filter(
    (relationship) =>
      relationship.relationshipType.uuid !== companionRelationshipTypeUuid &&
      ((relationship.relationshipType.weight ?? 0) >= 1 ||
        familyRelationshipTypes.has(relationship.relationshipType.uuid)),
  );
  const formattedRelationships = familyRelationships?.length
    ? extractRelationshipData(patientUuid, familyRelationships)
    : null;

  return {
    data: data ? formattedRelationships : null,
    error,
    isLoading,
    isValidating,
  };
}

function extractRelationshipData(
  patientIdentifier: string,
  relationships: Array<Relationship>,
): Array<ExtractedRelationship> {
  const relationshipsData: Array<ExtractedRelationship> = [];
  for (const relationship of relationships) {
    if (patientIdentifier === relationship.personA.uuid) {
      relationshipsData.push({
        uuid: `${relationship.uuid}`,
        display: getRelativeName(relationship.personB.display),
        relativeAge: relationship.personB.age,
        relativeUuid: relationship.personB.uuid,
        relationshipType: relationship.relationshipType.bIsToA,
      });
    } else {
      relationshipsData.push({
        uuid: `${relationship.uuid}`,
        display: getRelativeName(relationship.personA.display),
        relativeAge: relationship.personA.age,
        relativeUuid: relationship.personA.uuid,
        relationshipType: relationship.relationshipType.aIsToB,
      });
    }
  }
  return relationshipsData;
}

function getRelativeName(display: string) {
  const separatorIndex = display.indexOf(' - ');
  return separatorIndex >= 0 ? display.slice(separatorIndex + 3).trim() : display;
}

interface RelationshipsResponse {
  results: Array<Relationship>;
}

interface ExtractedRelationship {
  uuid: string;
  display: string;
  relativeAge: number;
  relativeUuid: string;
  relationshipType: string;
}

interface Relationship {
  display: string;
  uuid: number;
  personA: {
    uuid: string;
    age: number;
    display: string;
  };
  personB: {
    uuid: string;
    age: number;
    display: string;
  };
  relationshipType: {
    uuid: string;
    display: string;
    aIsToB: string;
    bIsToA: string;
    weight?: number | null;
  };
}
