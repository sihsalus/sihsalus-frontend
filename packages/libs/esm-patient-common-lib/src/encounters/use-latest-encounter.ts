import { type FetchResponse, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { useMemo } from 'react';
import useSWR, { type KeyedMutator } from 'swr';
import { validate as isUuid } from 'uuid';

import type { OpenmrsEncounter } from '../encounter-list/types';

const latestEncounterRepresentation =
  'custom:(uuid,encounterDatetime,encounterType:(uuid,display),location:(uuid,display),patient:(uuid,display),' +
  'obs:(uuid,obsDatetime,concept:(uuid,display),value:(uuid,display,name:(uuid,name)),groupMembers:(uuid,concept:(uuid,display),value:(uuid,display))),form:(uuid,name,display))';
interface UseLatestEncounterResponse {
  encounter: OpenmrsEncounter | undefined;
  isLoading: boolean;
  error: Error | null;
  mutate: KeyedMutator<FetchResponse<{ results: OpenmrsEncounter[] }>>;
}

export const useLatestValidEncounter = (
  patientUuid: string,
  encounterTypeUuid: string,
  formIdentifier?: string,
): UseLatestEncounterResponse => {
  const url = useMemo(() => {
    const normalizedPatientUuid = patientUuid?.trim();
    const normalizedEncounterTypeUuid = encounterTypeUuid?.trim();
    const normalizedFormIdentifier = formIdentifier?.trim();

    if (!normalizedPatientUuid || !normalizedEncounterTypeUuid) {
      return null;
    }

    const formUuid = normalizedFormIdentifier && isUuid(normalizedFormIdentifier) ? normalizedFormIdentifier : undefined;
    const params = new URLSearchParams({
      patient: normalizedPatientUuid,
      encounterType: normalizedEncounterTypeUuid,
      v: latestEncounterRepresentation,
      order: 'desc',
      limit: formUuid ? '1' : '100',
      startIndex: '0',
    });
    if (formUuid) {
      params.set('form', formUuid);
    }

    return `${restBaseUrl}/encounter?${params.toString()}`;
  }, [encounterTypeUuid, formIdentifier, patientUuid]);

  const {
    data,
    isLoading,
    error: swrError,
    mutate,
  } = useSWR<FetchResponse<{ results: OpenmrsEncounter[] }>, Error>(url, openmrsFetch, {
    revalidateIfStale: true,
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    dedupingInterval: 2000,
  });

  const finalError = !url ? new Error('patientUuid and encounterTypeUuid are required') : swrError || null;

  const encounter = useMemo(() => {
    const normalizedFormIdentifier = formIdentifier?.trim().toLowerCase();
    const encounters = normalizedFormIdentifier
      ? (data?.data?.results ?? []).filter((candidate) =>
          [candidate.form?.uuid, candidate.form?.name, candidate.form?.display]
            .filter((value): value is string => Boolean(value))
            .some((value) => value.trim().toLowerCase() === normalizedFormIdentifier),
        )
      : (data?.data?.results ?? []);

    return encounters.slice().sort((first, second) => {
      const firstTime = Date.parse(first.encounterDatetime);
      const secondTime = Date.parse(second.encounterDatetime);

      if (!Number.isFinite(firstTime)) return Number.isFinite(secondTime) ? 1 : 0;
      if (!Number.isFinite(secondTime)) return -1;
      return secondTime - firstTime;
    })[0];
  }, [data?.data?.results, formIdentifier]);

  return {
    encounter,
    isLoading,
    error: finalError,
    mutate,
  };
};
