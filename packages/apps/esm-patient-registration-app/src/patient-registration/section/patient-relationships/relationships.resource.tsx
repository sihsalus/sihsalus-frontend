import { type FetchResponse, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { useMemo } from 'react';
import useSWR from 'swr';

import { personRelationshipRepresentation } from '../../../constants';
import { type RelationshipValue } from '../../patient-registration.types';

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
  const { data, error, isLoading } = useSWR<FetchResponse<RelationshipsResponse>, Error>(
    shouldFetch ? `${restBaseUrl}/relationship?v=${personRelationshipRepresentation}&person=${patientUuid}` : null,
    openmrsFetch,
  );

  const result = useMemo(() => {
    const relationships: Array<RelationshipValue> = Array.isArray(data?.data?.results)
      ? data.data.results.map((r) =>
          r.personA.uuid === patientUuid
            ? {
                relatedPersonName: r.personB.display,
                relatedPersonUuid: r.personB.uuid,
                relation: r.relationshipType.bIsToA,
                relationshipType: `${r.relationshipType.uuid}/bIsToA`,
                /**
                 * Value kept for restoring initial value
                 */
                initialrelationshipTypeValue: `${r.relationshipType.uuid}/bIsToA`,
                uuid: r.uuid,
              }
            : {
                relatedPersonName: r.personA.display,
                relatedPersonUuid: r.personA.uuid,
                relation: r.relationshipType.aIsToB,
                relationshipType: `${r.relationshipType.uuid}/aIsToB`,
                /**
                 * Value kept for restoring initial value
                 */
                initialrelationshipTypeValue: `${r.relationshipType.uuid}/aIsToB`,
                uuid: r.uuid,
              },
        )
      : [];
    return {
      data: relationships,
      error,
      isLoading,
    };
  }, [data?.data?.results, error, isLoading, patientUuid]);

  return result;
}
