import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import useSWR from 'swr';

const customRepresentation =
  'custom:(display,uuid,personA:(age,display,birthdate,uuid),personB:(age,display,birthdate,uuid),relationshipType:(uuid,display,description,aIsToB,bIsToA))';

export function useRelationships(patientUuid: string) {
  const apiUrl = `${restBaseUrl}/relationship?v=${customRepresentation}&person=${patientUuid}`;

  const { data, error, isLoading, isValidating } = useSWR<{ data: RelationshipsResponse }, Error>(
    patientUuid ? apiUrl : null,
    openmrsFetch,
  );

  const formattedRelationships = data?.data?.results?.length
    ? extractRelationshipData(patientUuid, data.data.results)
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
        display: relationship.personB.display,
        relativeAge: relationship.personB.age,
        relativeUuid: relationship.personB.uuid,
        relationshipType: relationship.relationshipType.bIsToA,
      });
    } else {
      relationshipsData.push({
        uuid: `${relationship.uuid}`,
        display: relationship.personA.display,
        relativeAge: relationship.personA.age,
        relativeUuid: relationship.personA.uuid,
        relationshipType: relationship.relationshipType.aIsToB,
      });
    }
  }
  return relationshipsData;
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
  };
}
