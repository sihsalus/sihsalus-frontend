import type { FetchResponse, FHIRResource } from '@openmrs/esm-framework';
import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { useMemo } from 'react';
import useSWR from 'swr';
import useSWRImmutable from 'swr/immutable';

interface RelationshipTypeResponse {
  results: Array<{
    uuid: string;
    display: string;
    displayAIsToB: string;
    displayBIsToA: string;
  }>;
}

interface RelationshipsResponse {
  results: Array<Relationship>;
}

interface ExtractedRelationship {
  uuid: string;
  display: string;
  relativeAge: number;
  name: string;
  dead: boolean;
  causeOfDeath: string;
  relativeUuid: string;
  relationshipType: string;
  relationshipTypeDisplay: string;
  relationshipTypeUUID: string;
  /** Whether the relative is a Patient (has a clinical record) or only a Person. */
  isPatient: boolean;
  /**
   * UUID usable against patient-only APIs. Null when the relative is a plain Person —
   * their uuid must never be sent to patient endpoints as if it were a patient's.
   */
  patientUuid: string | null;
  /** Consanguinity degree from the relationship type weight (0 = no consanguinity). */
  consanguinityDegree: number;
}

export interface Relationship {
  display: string;
  uuid: string;
  personA: Person;
  personB: Person;
  relationshipType: {
    uuid: string;
    display: string;
    aIsToB: string;
    bIsToA: string;
    weight?: number | null;
  };
}
interface Person {
  uuid: string;
  age: number;
  dead: boolean;
  display: string;
  causeOfDeath: string;
  isPatient?: boolean;
}

type FHIRResourceResponse = {
  total: number;
  entry: Array<FHIRResource>;
};

interface RelationshipType {
  uuid: string;
  display: string;
  direction: 'aIsToB' | 'bIsToA';
}

export const useCodedConceptObservations = (patientUuid: string, conceptUuid: string) => {
  const url = `/ws/fhir2/R4/Observation?subject:Patient=${patientUuid}&code=${conceptUuid}&_summary=data&_sort=-date&_count=100`;

  const { data, isLoading, error, mutate, isValidating } = useSWR<{ data: FHIRResourceResponse }>(
    conceptUuid ? url : null,
    openmrsFetch,
  );

  const formattedObservations = data?.data ? mapObservations(data?.data) : null;

  return {
    observations: formattedObservations ? formattedObservations : null,
    isLoading,
    isValidating,
    error,
    mutate,
  };
};

function mapObservations(obsData) {
  if (obsData?.total > 0) {
    return obsData?.entry?.map((obs) => {
      return {
        id: obs?.resource?.id,
        value: obs?.resource?.valueCodeableConcept?.text,
      };
    });
  }
}

export const useAllRelationshipTypes = () => {
  const url = `${restBaseUrl}/relationshiptype?v=default`;
  const { data, error } = useSWRImmutable<{ data: RelationshipTypeResponse }>(url, openmrsFetch);

  return { data, error };
};

export const useMappedRelationshipTypes = () => {
  const url = `${restBaseUrl}/relationshiptype?v=default`;
  const { data, error, isLoading } = useSWRImmutable<{ data?: RelationshipTypeResponse }>(url, openmrsFetch);

  const relations: RelationshipType[] = [];

  data?.data.results.forEach((type) => {
    const aIsToB = {
      display: type.displayAIsToB ? type.displayAIsToB : type.displayBIsToA,
      uuid: type.uuid,
      direction: 'aIsToB' as const,
    };
    const bIsToA = {
      display: type.displayBIsToA ? type.displayBIsToA : type.displayAIsToB,
      uuid: type.uuid,
      direction: 'bIsToA' as const,
    };
    if (aIsToB.display === bIsToA.display) {
      relations.push(aIsToB);
    } else if (bIsToA.display === 'Paciente') {
      relations.push(aIsToB, {
        display: `Paciente (${aIsToB.display})`,
        uuid: type.uuid,
        direction: 'bIsToA' as const,
      });
    } else {
      relations.push(aIsToB, bIsToA);
    }
  });

  return { data: relations, error, isLoading };
};

export function usePatientRelationships(patientUuid: string) {
  // `isPatient` distinguishes a Patient from a plain Person; the relationship type
  // `weight` carries the consanguinity degree (sihsalus-content convention).
  const customRepresentation =
    'custom:(display,uuid,personA:(uuid,age,display,dead,causeOfDeath,isPatient),personB:(uuid,age,display,dead,causeOfDeath,isPatient),relationshipType:(uuid,display,description,aIsToB,bIsToA,weight))';

  const relationshipsUrl = patientUuid
    ? `/ws/rest/v1/relationship?person=${patientUuid}&v=${customRepresentation}`
    : null;

  const { data, error, isLoading, isValidating } = useSWR<FetchResponse<RelationshipsResponse>, Error>(
    relationshipsUrl,
    openmrsFetch,
    {
      revalidateOnFocus: false,
    },
  );

  const relationships = useMemo(() => {
    return data?.data?.results?.length ? extractRelationshipData(patientUuid, data?.data?.results) : [];
  }, [data?.data?.results, patientUuid]);

  return {
    relationships,
    error,
    isLoading,
    isValidating,
    relationshipsUrl,
  };
}

function extractRelationshipData(
  patientIdentifier: string,
  relationships: Array<Relationship>,
): Array<ExtractedRelationship> {
  const relationshipsData: Array<ExtractedRelationship> = [];
  for (const r of relationships) {
    const relative = patientIdentifier === r.personA.uuid ? r.personB : r.personA;
    const relativeIsPatient = !!relative.isPatient;

    relationshipsData.push({
      uuid: r.uuid,
      name: extractName(relative.display),
      display: relative.display,
      relativeAge: relative.age,
      dead: relative.dead,
      causeOfDeath: relative.causeOfDeath,
      relativeUuid: relative.uuid,
      relationshipType:
        patientIdentifier === r.personA.uuid ? r.relationshipType.bIsToA : r.relationshipType.aIsToB,
      relationshipTypeDisplay: r.relationshipType.display,
      relationshipTypeUUID: r.relationshipType.uuid,
      isPatient: relativeIsPatient,
      // Only a real Patient uuid may be used against patient endpoints.
      patientUuid: relativeIsPatient ? relative.uuid : null,
      consanguinityDegree: r.relationshipType.weight ?? 0,
    });
  }
  return relationshipsData;
}

function extractName(display: string) {
  const pattern = /-\s*(.*)$/;
  const match = display.match(pattern);
  if (match && match.length > 1) {
    return match[1].trim();
  }
  return display.trim();
}
