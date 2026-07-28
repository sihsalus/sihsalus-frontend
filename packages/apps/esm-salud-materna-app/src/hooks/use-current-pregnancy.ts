import { openmrsFetch, restBaseUrl, useConfig } from '@openmrs/esm-framework';
import { useMemo } from 'react';
import useSWR from 'swr';

import type { ConfigObject } from '../config-schema';
import {
  encounterMatchesForm,
  getObservationValue,
  type MaternalEncounter,
  toDateString,
} from '../utils/pregnancy-episode-utils';

interface MaternalEncounterResponse {
  results: MaternalEncounter[];
}

const representation =
  'custom:(uuid,encounterDatetime,form:(uuid,name,display),obs:(uuid,concept:(uuid),value,groupMembers:(uuid,concept:(uuid),value,groupMembers:(uuid,concept:(uuid),value))))';

export function useCurrentPregnancy(patientUuid: string) {
  const config = useConfig<ConfigObject>();
  const encounterTypeUuid = config.encounterTypes.prenatalControl;
  const currentPregnancyForm = config.formsList.currentPregnancy;
  const lastMenstrualPeriodConceptUuid = config.pregnancyEpisode.lastMenstrualPeriodConceptUuid;
  const url =
    patientUuid && encounterTypeUuid
      ? `${restBaseUrl}/encounter?patient=${patientUuid}&encounterType=${encounterTypeUuid}&v=${representation}&limit=100`
      : null;

  const { data, error, isLoading, mutate } = useSWR<MaternalEncounterResponse, Error>(url, async (fetchUrl) => {
    const response = await openmrsFetch<MaternalEncounterResponse>(fetchUrl);
    return response.data;
  });

  const currentPregnancyEncounter = useMemo(
    () =>
      (data?.results ?? [])
        .filter((encounter) => encounterMatchesForm(encounter, currentPregnancyForm))
        .sort(
          (first, second) => new Date(second.encounterDatetime).getTime() - new Date(first.encounterDatetime).getTime(),
        )[0],
    [currentPregnancyForm, data?.results],
  );
  const lastMenstrualPeriod = toDateString(
    getObservationValue(currentPregnancyEncounter?.obs, lastMenstrualPeriodConceptUuid),
  );

  return {
    currentPregnancyEncounter,
    pregnancyStartDate: lastMenstrualPeriod ?? currentPregnancyEncounter?.encounterDatetime,
    isLoading,
    error: error ?? null,
    mutate,
  };
}
