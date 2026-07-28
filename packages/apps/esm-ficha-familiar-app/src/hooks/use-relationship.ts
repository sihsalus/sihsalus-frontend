import type { FetchResponse } from '@openmrs/esm-framework';
import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import useSWR from 'swr';

import type { Relationship } from '../types';

const useRelationship = (relationshipUuid: string) => {
  const customRepresentation = `custom:(display,uuid,startDate,endDate,relationshipType:(uuid,display,aIsToB,bIsToA),personA,personB)`;
  const url = `${restBaseUrl}/relationship/${relationshipUuid}?v=${customRepresentation}`;
  const { isLoading, data, error, mutate } = useSWR<FetchResponse<Relationship>>(url, openmrsFetch);
  return {
    isLoading,
    error,
    relationship: data?.data,
    mutate,
  };
};

export default useRelationship;
