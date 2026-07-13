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
    uuid: string;
  };
  personB: {
    age: number;
    display: string;
    birthdate: string;
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

export function useInitialPatientRelationships(patientUuid: string): {
  data: Array<RelationshipValue>;
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
    const mapped = (Array.isArray(data?.data?.results) ? data.data.results : []).map((r) => {
      const isPersonA = r.personA.uuid === patientUuid;
      const direction = isPersonA ? 'bIsToA' : 'aIsToB';
      return {
        relatedPersonName: isPersonA ? r.personB.display : r.personA.display,
        relatedPersonUuid: isPersonA ? r.personB.uuid : r.personA.uuid,
        relation: isPersonA ? r.relationshipType.bIsToA : r.relationshipType.aIsToB,
        relationshipType: `${r.relationshipType.uuid}/${direction}`,
        initialrelationshipTypeValue: `${r.relationshipType.uuid}/${direction}`,
        uuid: r.uuid,
        typeUuid: r.relationshipType.uuid,
      };
    });

    // Fold the persisted primary-responsible relationship into the person's family
    // link so editing keeps one row and restores the principal selection.
    const companions = companionTypeUuid ? mapped.filter((m) => m.typeUuid === companionTypeUuid) : [];
    const relationships: Array<RelationshipValue> = mapped
      .filter((m) => !companionTypeUuid || m.typeUuid !== companionTypeUuid)
      .map(({ typeUuid: _typeUuid, ...rel }) => {
        const companion = companions.find((c) => c.relatedPersonUuid === rel.relatedPersonUuid);
        return companion ? { ...rel, isCompanion: true, companionRelationshipUuid: companion.uuid } : rel;
      });

    return {
      data: relationships,
      error,
      isLoading,
    };
  }, [data?.data?.results, error, isLoading, patientUuid, companionTypeUuid]);

  return result;
}
