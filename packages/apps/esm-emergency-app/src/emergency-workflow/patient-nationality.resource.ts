import { type FetchResponse, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { useMemo } from 'react';
import useSWRImmutable from 'swr/immutable';

export interface NationalityConceptAnswer {
  uuid: string;
  display: string;
}

export interface NationalityConceptSetResponse {
  answers?: Array<NationalityConceptAnswer>;
  setMembers?: Array<NationalityConceptAnswer>;
}

export function getNationalityConceptAnswers(
  conceptSet?: NationalityConceptSetResponse,
): Array<NationalityConceptAnswer> | undefined {
  if (!conceptSet) {
    return undefined;
  }

  return conceptSet.answers?.length ? conceptSet.answers : (conceptSet.setMembers ?? []);
}

export function useNationalityConceptAnswers(conceptSetUuid: string) {
  const shouldFetch = Boolean(conceptSetUuid);
  const { data, error, isLoading } = useSWRImmutable<FetchResponse<NationalityConceptSetResponse>, Error>(
    shouldFetch
      ? `${restBaseUrl}/concept/${conceptSetUuid}?v=custom:(uuid,display,answers:(uuid,display),setMembers:(uuid,display))`
      : null,
    openmrsFetch,
  );

  return useMemo(() => {
    return { data: getNationalityConceptAnswers(data?.data), error, isLoading };
  }, [data, error, isLoading]);
}
