import { type FetchResponse, openmrsFetch, restBaseUrl, useConfig } from '@openmrs/esm-framework';
import { useMemo } from 'react';
import useSWR from 'swr';

import { type RegistrationConfig } from '../../../config-schema';
import { personRelationshipRepresentation } from '../../../constants';
import { type RelationshipValue } from '../../patient-registration.types';
import { getEffectiveRegistrationConfig } from '../../peru-registration-config';

export interface Relationship {
  display: string;
  uuid: string;
  personA: {
    age: number;
    display: string;
    birthdate: string;
    birthdateEstimated?: boolean;
    uuid: string;
  };
  personB: {
    age: number;
    display: string;
    birthdate: string;
    birthdateEstimated?: boolean;
    uuid: string;
  };
  relationshipType: {
    uuid: string;
    display: string;
    aIsToB: string;
    bIsToA: string;
  };
}

interface RelationshipsResponse {
  results: Array<Relationship>;
}

export function mapPatientRelationships(
  results: Array<Relationship> | undefined,
  patientUuid: string,
  companionTypeUuid?: string,
): Array<RelationshipValue> {
  const mapped = (Array.isArray(results) ? results : []).map((relationship) => {
    const isPersonA = relationship.personA.uuid === patientUuid;
    const relatedPerson = isPersonA ? relationship.personB : relationship.personA;
    const direction = isPersonA ? 'bIsToA' : 'aIsToB';
    return {
      relatedPersonName: relatedPerson.display,
      relatedPersonUuid: relatedPerson.uuid,
      relatedPersonAge: relatedPerson.age,
      relatedPersonBirthdate: relatedPerson.birthdate,
      relatedPersonBirthdateEstimated: relatedPerson.birthdateEstimated,
      relation: isPersonA ? relationship.relationshipType.bIsToA : relationship.relationshipType.aIsToB,
      relationshipType: `${relationship.relationshipType.uuid}/${direction}`,
      initialrelationshipTypeValue: `${relationship.relationshipType.uuid}/${direction}`,
      uuid: relationship.uuid,
      typeUuid: relationship.relationshipType.uuid,
    };
  });

  if (!companionTypeUuid) {
    return mapped.map(({ typeUuid: _typeUuid, ...relationship }) => relationship);
  }

  const companions = mapped.filter((relationship) => relationship.typeUuid === companionTypeUuid);
  const regularRelationships = mapped.filter((relationship) => relationship.typeUuid !== companionTypeUuid);
  const consumedCompanionUuids = new Set<string>();
  const foldedRelationships: Array<RelationshipValue> = regularRelationships.map(
    ({ typeUuid: _typeUuid, ...relationship }) => {
      const companion = companions.find(
        (candidate) =>
          candidate.relatedPersonUuid === relationship.relatedPersonUuid && !consumedCompanionUuids.has(candidate.uuid),
      );

      if (!companion) {
        return relationship;
      }

      consumedCompanionUuids.add(companion.uuid);
      return { ...relationship, isCompanion: true, companionRelationshipUuid: companion.uuid };
    },
  );
  const standaloneCompanions = companions
    .filter((companion) => !consumedCompanionUuids.has(companion.uuid))
    .map(({ typeUuid: _typeUuid, ...companion }) => companion);

  return [...foldedRelationships, ...standaloneCompanions];
}

export function useInitialPatientRelationships(patientUuid: string): {
  data: Array<RelationshipValue>;
  error?: Error;
  isLoading: boolean;
} {
  const shouldFetch = !!patientUuid;
  const rawConfig = useConfig<RegistrationConfig>();
  const config = rawConfig?.sections ? getEffectiveRegistrationConfig(rawConfig) : rawConfig;
  const companionTypeUuid = config?.relationshipOptions?.companionRelationshipType?.split('/')[0];
  const { data, error, isLoading } = useSWR<FetchResponse<RelationshipsResponse>, Error>(
    shouldFetch ? `${restBaseUrl}/relationship?v=${personRelationshipRepresentation}&person=${patientUuid}` : null,
    openmrsFetch,
  );

  const result = useMemo(() => {
    return {
      data: mapPatientRelationships(data?.data?.results, patientUuid, companionTypeUuid),
      error,
      isLoading,
    };
  }, [data?.data?.results, error, isLoading, patientUuid, companionTypeUuid]);

  return result;
}
