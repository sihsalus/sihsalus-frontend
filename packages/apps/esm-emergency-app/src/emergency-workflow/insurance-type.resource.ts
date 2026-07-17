import { type FetchResponse, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { useMemo } from 'react';
import useSWRImmutable from 'swr/immutable';

export interface InsuranceTypeConceptAnswer {
  uuid: string;
  display: string;
}

export interface InsuranceTypeConceptSetResponse {
  answers?: Array<InsuranceTypeConceptAnswer>;
  setMembers?: Array<InsuranceTypeConceptAnswer>;
}

/**
 * El catálogo «Tipo de seguro» está modelado como pregunta coded, así que las
 * opciones llegan como `answers`; si viene vacío se usa `setMembers` como
 * respaldo (algunos servidores lo exponen solo como concept set).
 */
export function getInsuranceTypeConceptAnswers(
  conceptSet?: InsuranceTypeConceptSetResponse,
): Array<InsuranceTypeConceptAnswer> | undefined {
  if (!conceptSet) {
    return undefined;
  }

  return conceptSet.answers?.length ? conceptSet.answers : (conceptSet.setMembers ?? []);
}

export function useInsuranceTypeConceptAnswers(conceptSetUuid: string) {
  const shouldFetch = Boolean(conceptSetUuid);
  const { data, error, isLoading } = useSWRImmutable<FetchResponse<InsuranceTypeConceptSetResponse>, Error>(
    shouldFetch
      ? `${restBaseUrl}/concept/${conceptSetUuid}?v=custom:(uuid,display,answers:(uuid,display),setMembers:(uuid,display))`
      : null,
    openmrsFetch,
  );

  return useMemo(() => {
    return { data: getInsuranceTypeConceptAnswers(data?.data), error, isLoading };
  }, [data, error, isLoading]);
}
