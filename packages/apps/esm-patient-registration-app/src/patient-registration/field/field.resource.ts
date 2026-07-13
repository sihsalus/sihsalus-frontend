import { type FetchResponse, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { useMemo } from 'react';
import useSWRImmutable from 'swr/immutable';

import { type ConceptAnswers, type ConceptResponse } from '../patient-registration.types';

export function useConcept(conceptUuid: string): { data?: ConceptResponse; error?: Error; isLoading: boolean } {
  const shouldFetch = typeof conceptUuid === 'string' && conceptUuid !== '';
  const { data, error, isLoading } = useSWRImmutable<FetchResponse<ConceptResponse>, Error>(
    shouldFetch ? `${restBaseUrl}/concept/${conceptUuid}` : null,
    openmrsFetch,
  );
  const results = useMemo(() => ({ data: data?.data, error, isLoading }), [data, error, isLoading]);
  return results;
}

export function useConceptAnswers(conceptUuid: string): {
  data?: Array<ConceptAnswers>;
  isLoading: boolean;
  error?: Error;
} {
  const shouldFetch = typeof conceptUuid === 'string' && conceptUuid !== '';
  const { data, error, isLoading } = useSWRImmutable<FetchResponse<ConceptResponse>, Error>(
    shouldFetch
      ? `${restBaseUrl}/concept/${conceptUuid}?v=custom:(uuid,display,answers:(uuid,display),setMembers:(uuid,display))`
      : null,
    openmrsFetch,
  );
  const results = useMemo(
    () => ({
      data: data?.data ? (data.data.answers?.length ? data.data.answers : (data.data.setMembers ?? [])) : undefined,
      isLoading,
      error,
    }),
    [isLoading, error, data],
  );
  return results;
}
