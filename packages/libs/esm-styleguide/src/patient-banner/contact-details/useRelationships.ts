import { openmrsFetch, restBaseUrl } from '@openmrs/esm-api';
import { useConfig } from '@openmrs/esm-react-utils';
import useSWR from 'swr';

interface PatientBannerConfig {
  familyRelationshipTypeUuids?: Array<string>;
}

const fallbackFamilyRelationshipTypeUuids = new Set([
  'e6be4def-dbc8-462a-8714-53da66903cb8',
  '8d91a210-c2cc-11de-8d13-0010c6dffd0f',
  '8d91a01c-c2cc-11de-8d13-0010c6dffd0f',
  '5c2f978d-3b7d-493c-9e8f-cb3d1c0b6a55',
  'ea373db3-5902-4307-9258-f35b79f8c8a0',
  '88db8237-ce55-4dec-99f8-ad8854735ba7',
  'ee7ab8d4-1c75-47c1-8339-047a85e1880b',
  '6b1c5e8f-32f7-41b3-bc2a-8b3e97a6d937',
  'c964be38-ffda-45ec-ab8c-2dcdfafdd1a8',
  'fd6b17aa-a0cc-464d-b6cd-b4dd15f2893e',
  '9cf7e2ca-b3ea-4f8d-ac26-bcccbec509b2',
  '5d542bc2-78eb-4f02-8207-d1d7309b7215',
  '18e663df-4587-486a-abd6-e4f440dcb731',
  '488f6542-fa00-473f-91a8-39abe5472fc3',
  'f29a285e-aff3-40e6-976e-f244a1e83536',
]);
const companionRelationshipTypeUuid = '3501ac02-0fb0-4ced-8a3e-f578f0ff5276';

const customRepresentation =
  'custom:(display,uuid,personA:(age,display,birthdate,uuid),personB:(age,display,birthdate,uuid),relationshipType:(uuid,display,description,aIsToB,bIsToA,weight))';

export function useRelationships(patientUuid: string) {
  const { familyRelationshipTypeUuids = [] } = useConfig<PatientBannerConfig>({
    externalModuleName: '@sihsalus/esm-patient-banner-app',
  });
  const familyRelationshipTypes = new Set([...fallbackFamilyRelationshipTypeUuids, ...familyRelationshipTypeUuids]);
  const apiUrl = `${restBaseUrl}/relationship?v=${customRepresentation}&person=${patientUuid}`;

  const { data, error, isLoading, isValidating } = useSWR<{ data: RelationshipsResponse }, Error>(
    patientUuid ? apiUrl : null,
    openmrsFetch,
  );

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
  for (const r of relationships) {
    if (patientIdentifier === r.personA.uuid) {
      relationshipsData.push({
        uuid: `${r.uuid}`,
        display: getRelativeName(r.personB.display),
        relativeAge: r.personB.age,
        relativeUuid: r.personB.uuid,
        relationshipType: r.relationshipType.bIsToA,
      });
    } else {
      relationshipsData.push({
        uuid: `${r.uuid}`,
        display: getRelativeName(r.personA.display),
        relativeAge: r.personA.age,
        relativeUuid: r.personA.uuid,
        relationshipType: r.relationshipType.aIsToB,
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

export interface Relationship {
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

function getRelativeName(display: string) {
  const separatorIndex = display.indexOf(' - ');
  return separatorIndex >= 0 ? display.slice(separatorIndex + 3).trim() : display;
}
