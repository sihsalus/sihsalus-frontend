import { type FetchResponse, openmrsFetch, restBaseUrl, showSnackbar } from '@openmrs/esm-framework';
import { useEffect, useMemo } from 'react';
import useSWRImmutable from 'swr/immutable';

import { type ConceptAnswers, type ConceptResponse } from '../patient-registration.types';

function getErrorStatus(error: unknown) {
  return typeof error === 'object' && error
    ? ((error as { response?: { status?: number }; status?: number }).response?.status ??
        (error as { status?: number }).status)
    : undefined;
}

export function isForbiddenConceptError(error: unknown) {
  return getErrorStatus(error) === 403 || (error instanceof Error && /\b403\b/.test(error.message));
}

export function isMissingConceptError(error: unknown) {
  return getErrorStatus(error) === 404 || (error instanceof Error && /\b404\b/.test(error.message));
}

function useConceptErrorSnackbar(error: Error | undefined) {
  useEffect(() => {
    if (error && !isForbiddenConceptError(error)) {
      showSnackbar({
        title: error.name,
        subtitle: error.message,
        kind: 'error',
      });
    }
  }, [error]);
}

export function useConcept(conceptUuid: string): { data: ConceptResponse; isLoading: boolean } {
  const shouldFetch = typeof conceptUuid === 'string' && conceptUuid !== '';
  const { data, error, isLoading } = useSWRImmutable<FetchResponse<ConceptResponse>, Error>(
    shouldFetch ? `${restBaseUrl}/concept/${conceptUuid}` : null,
    openmrsFetch,
  );
  useConceptErrorSnackbar(error);
  const results = useMemo(() => ({ data: data?.data, isLoading }), [data, isLoading]);
  return results;
}

export function useConceptAnswers(conceptUuid: string): {
  data: Array<ConceptAnswers>;
  isLoading: boolean;
  error: Error | undefined;
} {
  const shouldFetch = typeof conceptUuid === 'string' && conceptUuid !== '';
  const { data, error, isLoading } = useSWRImmutable<FetchResponse<ConceptResponse>, Error>(
    shouldFetch
      ? `${restBaseUrl}/concept/${conceptUuid}?v=custom:(uuid,display,answers:(uuid,display),setMembers:(uuid,display))`
      : null,
    openmrsFetch,
  );
  useConceptErrorSnackbar(error);
  const results = useMemo(
    () => ({
      data: data?.data ? (data.data.answers?.length ? data.data.answers : (data.data.setMembers ?? [])) : [],
      isLoading,
      error,
    }),
    [isLoading, error, data],
  );
  return results;
}
