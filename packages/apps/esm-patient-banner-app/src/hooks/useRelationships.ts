import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import useSWR from 'swr';

const customRepresentation =
  'custom:(display,uuid,personA:(age,display,birthdate,uuid),personB:(age,display,birthdate,uuid),relationshipType:(uuid,display,description,aIsToB,bIsToA))';
const patientIdentifierRepresentation = 'custom:(uuid,identifiers:(identifier,identifierType:(uuid,name,display)))';
const dniIdentifierTypeUuid = '550e8400-e29b-41d4-a716-446655440001';
const dniValuePattern = /^\d{8}$/;

export function useRelationships(patientUuid: string) {
  const apiUrl = `${restBaseUrl}/relationship?v=${customRepresentation}&person=${patientUuid}`;

  const { data, error, isLoading, isValidating } = useSWR<{ data: RelationshipsResponse }, Error>(
    patientUuid ? apiUrl : null,
    openmrsFetch,
  );

  const formattedRelationships = data?.data?.results?.length
    ? extractRelationshipData(patientUuid, data.data.results)
    : null;
  const relativePatientUrls = formattedRelationships?.map(
    (relationship) => `${restBaseUrl}/patient/${relationship.relativeUuid}?v=${patientIdentifierRepresentation}`,
  );
  const { data: relativePatients, isLoading: isLoadingRelativePatients } = useSWR(
    relativePatientUrls?.length ? ['patient-banner-relationship-identifiers', ...relativePatientUrls] : null,
    ([, ...urls]) => Promise.all(urls.map((url) => openmrsFetch(url).then(({ data }) => data as RelatedPatient))),
  );
  const relationshipsWithIdentifiers =
    formattedRelationships?.map((relationship) => {
      const relativePatient = relativePatients?.find((patient) => patient.uuid === relationship.relativeUuid);
      return {
        ...relationship,
        dni: getDniIdentifier(relativePatient?.identifiers)?.identifier,
      };
    }) ?? null;

  return {
    data: data ? relationshipsWithIdentifiers : null,
    error,
    isLoading: isLoading || Boolean(formattedRelationships?.length && isLoadingRelativePatients),
    isValidating,
  };
}

function getDniIdentifier(identifiers: Array<PatientIdentifier> = []) {
  return identifiers.find((identifier) => {
    const typeName = identifier.identifierType?.name?.trim().toLowerCase();
    const typeDisplay = identifier.identifierType?.display?.trim().toLowerCase();
    const typeUuid = identifier.identifierType?.uuid;

    return (
      typeName === 'dni' ||
      typeDisplay === 'dni' ||
      typeUuid === dniIdentifierTypeUuid ||
      Boolean(identifier.identifier && dniValuePattern.test(identifier.identifier))
    );
  });
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
  dni?: string;
  relativeAge: number;
  relativeUuid: string;
  relationshipType: string;
}

interface RelatedPatient {
  uuid: string;
  identifiers: Array<PatientIdentifier>;
}

interface PatientIdentifier {
  identifier: string;
  identifierType?: {
    uuid?: string;
    name?: string;
    display?: string;
  };
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
