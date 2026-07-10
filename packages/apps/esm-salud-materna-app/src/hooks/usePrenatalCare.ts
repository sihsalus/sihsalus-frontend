import { openmrsFetch, restBaseUrl, useConfig } from '@openmrs/esm-framework';
import { useMemo } from 'react';
import useSWR from 'swr';

import type { ConfigObject } from '../config-schema';
import { encounterMatchesForm, isWithinPregnancyEpisode } from '../utils/pregnancy-episode-utils';

import { useCurrentPregnancy } from './useCurrentPregnancy';

type Obs = {
  uuid: string;
  display: string;
  groupMembers?: Obs[];
};

type ObsEncounter = {
  uuid: string;
  encounterDatetime: string;
  form: {
    uuid: string;
    display: string;
  };
  obs: Obs[];
};

type EncounterResponse = {
  results: ObsEncounter[];
};

const richRepresentation =
  'custom:(uuid,encounterDatetime,form:(uuid,display),obs:(uuid,display,groupMembers:(uuid,display)))';

export const usePrenatalCare = (
  patientUuid: string,
): {
  prenatalEncounters: ObsEncounter[];
  error: Error | null;
  isValidating: boolean;
  mutate: () => void;
} => {
  const config = useConfig<ConfigObject>();
  const encounterType = config.encounterTypes.prenatalControl;
  const formName = config.formsList.atencionPrenatal;
  const { pregnancyStartDate, isLoading: isPregnancyLoading, error: pregnancyError } = useCurrentPregnancy(patientUuid);

  const url = useMemo(() => {
    if (!patientUuid || !encounterType) return null;
    return `${restBaseUrl}/encounter?patient=${patientUuid}&encounterType=${encounterType}&v=${richRepresentation}`;
  }, [patientUuid, encounterType]);

  const { data, error, isValidating, mutate } = useSWR<EncounterResponse>(url, async (fetchUrl) => {
    const response = await openmrsFetch<EncounterResponse>(fetchUrl);
    return response?.data;
  });

  const prenatalEncounters = useMemo(() => {
    if (!data?.results) return [];
    if (!pregnancyStartDate) return [];
    return data.results
      .filter(
        (encounter) =>
          encounterMatchesForm(encounter, formName) &&
          isWithinPregnancyEpisode(encounter.encounterDatetime, pregnancyStartDate),
      )
      .sort((a, b) => new Date(a.encounterDatetime).getTime() - new Date(b.encounterDatetime).getTime());
  }, [data, formName, pregnancyStartDate]);

  return {
    prenatalEncounters,
    error: pregnancyError ?? error ?? null,
    isValidating: isPregnancyLoading || isValidating,
    mutate,
  };
};
