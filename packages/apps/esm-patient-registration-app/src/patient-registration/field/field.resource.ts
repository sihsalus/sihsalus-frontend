import { type FetchResponse, logError, openmrsFetch, restBaseUrl, showSnackbar } from '@openmrs/esm-framework';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import useSWRImmutable from 'swr/immutable';

import { moduleName } from '../../constants';
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
  const { t } = useTranslation(moduleName);

  useEffect(() => {
    if (!error) {
      return;
    }

    logError(error, 'Patient registration concept request failed');

    if (!isForbiddenConceptError(error)) {
      showSnackbar({
        title: t('error', 'Error'),
        subtitle: t('refreshOrContactAdmin', 'Try refreshing the page or contact your system administrator'),
        kind: 'error',
      });
    }
  }, [error, t]);
}

export function useConcept(conceptUuid: string): { data?: ConceptResponse; error?: Error; isLoading: boolean } {
  const shouldFetch = typeof conceptUuid === 'string' && conceptUuid !== '';
  const { data, error, isLoading } = useSWRImmutable<FetchResponse<ConceptResponse>, Error>(
    shouldFetch ? `${restBaseUrl}/concept/${conceptUuid}` : null,
    openmrsFetch,
  );
  useConceptErrorSnackbar(error);
  const results = useMemo(() => ({ data: data?.data, error, isLoading }), [data, error, isLoading]);
  return results;
}

export function useConceptAnswers(
  conceptUuid: string,
  codeSource?: string,
): {
  data: Array<ConceptAnswers>;
  isLoading: boolean;
  error?: Error;
} {
  const shouldFetch = typeof conceptUuid === 'string' && conceptUuid !== '';
  const source = codeSource?.trim();
  const answerRepresentation = source
    ? 'uuid,display,names:(name,voided),mappings:(conceptMapType:(name),conceptReferenceTerm:(code,retired,conceptSource:(name,retired)))'
    : 'uuid,display';
  const { data, error, isLoading } = useSWRImmutable<FetchResponse<ConceptResponse>, Error>(
    shouldFetch
      ? `${restBaseUrl}/concept/${conceptUuid}?v=custom:(uuid,display,answers:(${answerRepresentation}),setMembers:(${answerRepresentation}))`
      : null,
    openmrsFetch,
  );
  useConceptErrorSnackbar(error);
  const results = useMemo(
    () => ({
      data: (data?.data ? (data.data.answers?.length ? data.data.answers : (data.data.setMembers ?? [])) : []).map(
        (answer) => {
          if (!source) return answer;
          const codes = [
            ...new Set(
              (answer.mappings ?? [])
                .filter(
                  ({ conceptMapType, conceptReferenceTerm: term }) =>
                    conceptMapType?.name === 'SAME-AS' &&
                    term?.retired === false &&
                    term.conceptSource?.name === source &&
                    term.conceptSource.retired === false,
                )
                .map(({ conceptReferenceTerm: term }) => term?.code?.trim())
                .filter((code): code is string => Boolean(code)),
            ),
          ];
          return {
            ...answer,
            code: codes.length === 1 ? codes[0] : undefined,
            codeMappingStatus: codes.length === 1 ? 'mapped' : codes.length ? 'ambiguous' : 'unmapped',
            synonyms: [
              ...new Set((answer.names ?? []).filter((name) => name.voided === false).map(({ name }) => name)),
            ],
          } satisfies ConceptAnswers;
        },
      ),
      isLoading,
      error,
    }),
    [isLoading, error, data, source],
  );
  return results;
}
