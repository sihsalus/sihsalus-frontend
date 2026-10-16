import { openmrsFetch, restBaseUrl, useOpenmrsFetchAll } from '@openmrs/esm-framework';
import { useMemo } from 'react';
import { validate as isUuid } from 'uuid';

import type { OpenmrsEncounter } from '../encounter-list/types';

const latestEncounterRepresentation =
  'custom:(uuid,encounterDatetime,encounterType:(uuid,display),location:(uuid,display),patient:(uuid,display),' +
  'obs:(uuid,obsDatetime,formFieldNamespace,formFieldPath,concept:(uuid,display),value:(uuid,display,name:(uuid,name)),groupMembers:(uuid,concept:(uuid,display),value:(uuid,display))),form:(uuid,name,display))';
interface UseLatestEncounterResponse {
  encounter: OpenmrsEncounter | undefined;
  isLoading: boolean;
  error: Error | null;
  mutate: ReturnType<typeof useOpenmrsFetchAll<OpenmrsEncounter>>['mutate'];
}

export const useLatestValidEncounter = (
  patientUuid: string,
  encounterTypeUuid: string,
  formIdentifier?: string,
): UseLatestEncounterResponse => {
  const normalizedFormIdentifier = formIdentifier?.trim();
  const filterByFormName = Boolean(normalizedFormIdentifier && !isUuid(normalizedFormIdentifier));
  const url = useMemo(() => {
    const normalizedPatientUuid = patientUuid?.trim();
    const normalizedEncounterTypeUuid = encounterTypeUuid?.trim();
    const normalizedFormIdentifier = formIdentifier?.trim();

    if (!normalizedPatientUuid || !normalizedEncounterTypeUuid) {
      return null;
    }

    const formUuid =
      normalizedFormIdentifier && isUuid(normalizedFormIdentifier) ? normalizedFormIdentifier : undefined;
    const params = new URLSearchParams({
      patient: normalizedPatientUuid,
      encounterType: normalizedEncounterTypeUuid,
      v: latestEncounterRepresentation,
      order: 'desc',
      limit: filterByFormName ? '100' : '1',
      startIndex: '0',
    });
    if (formUuid) {
      params.set('form', formUuid);
    }

    return `${restBaseUrl}/encounter?${params.toString()}`;
  }, [encounterTypeUuid, formIdentifier, patientUuid, filterByFormName]);

  const {
    data,
    isLoading,
    error: swrError,
    mutate,
  } = useOpenmrsFetchAll<OpenmrsEncounter>(url ?? '', {
    fetcher: async (pageUrl) => {
      const response = await openmrsFetch<{
        results: OpenmrsEncounter[];
        links: Array<{ rel: 'next' | 'prev'; uri: string }>;
        totalCount: number;
      }>(pageUrl);
      // Names can span form versions and cannot be filtered by REST. Resolve
      // them against complete history; UUID-filtered queries already put the
      // latest match first and do not need the remaining pages.
      return filterByFormName ? response : { ...response, data: { ...response.data, links: [] } };
    },
    swrInfiniteConfig: {
      revalidateIfStale: true,
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 2000,
    },
  });

  const finalError = !url ? new Error('patientUuid and encounterTypeUuid are required') : swrError || null;

  const encounter = useMemo(() => {
    const normalizedFormIdentifier = formIdentifier?.trim().toLowerCase();
    const encounters = normalizedFormIdentifier
      ? (data ?? []).filter((candidate) =>
          [candidate.form?.uuid, candidate.form?.name, candidate.form?.display]
            .filter((value): value is string => Boolean(value))
            .some((value) => value.trim().toLowerCase() === normalizedFormIdentifier),
        )
      : (data ?? []);

    return encounters.slice().sort((first, second) => {
      const firstTime = Date.parse(first.encounterDatetime);
      const secondTime = Date.parse(second.encounterDatetime);

      if (!Number.isFinite(firstTime)) return Number.isFinite(secondTime) ? 1 : 0;
      if (!Number.isFinite(secondTime)) return -1;
      return secondTime - firstTime;
    })[0];
  }, [data, formIdentifier]);

  return {
    encounter,
    isLoading: isLoading && !finalError,
    error: finalError,
    mutate,
  };
};
