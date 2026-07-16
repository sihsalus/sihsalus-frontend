import { openmrsFetch, restBaseUrl, useConfig } from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import { useMemo } from 'react';
import useSWR from 'swr';

import type { ConfigObject } from '../config-schema';
import {
  encounterMatchesForm,
  flattenMaternalObservations,
  isWithinPregnancyEpisode,
  type MaternalEncounter,
} from '../utils/pregnancy-episode-utils';

import { useCurrentPregnancy } from './useCurrentPregnancy';

interface BirthPlanResult {
  hasBirthPlan: boolean;
  planDate: string | null;
  transportArranged: boolean;
  referenceHospital: string | null;
  encounterUuid: string | null;
  isLoading: boolean;
  error: Error | null;
  mutate: () => void;
}

interface EncounterResponse {
  results: MaternalEncounter[];
}

const representation =
  'custom:(uuid,encounterDatetime,form:(uuid,name,display),obs:(uuid,display,concept:(uuid),value:(uuid,display),groupMembers:(uuid,display,concept:(uuid),value:(uuid,display),groupMembers:(uuid,display,concept:(uuid),value:(uuid,display)))))';

export function useBirthPlan(patientUuid: string): BirthPlanResult {
  const config = useConfig<ConfigObject>();
  const { pregnancyStartDate, isLoading: isPregnancyLoading, error: pregnancyError } = useCurrentPregnancy(patientUuid);
  const encounterTypeUuid = config.birthPlan?.encounterTypeUuid;
  const transportConceptUuid = config.birthPlan?.transportConceptUuid;
  const referenceHospitalConceptUuid = config.birthPlan?.referenceHospitalConceptUuid;
  const formIdentifier = config.formsList.birthPlanForm;
  const url =
    patientUuid && encounterTypeUuid
      ? `${restBaseUrl}/encounter?patient=${patientUuid}&encounterType=${encounterTypeUuid}&v=${representation}&limit=100`
      : null;

  const { data, isLoading, error, mutate } = useSWR<EncounterResponse, Error>(url, async (fetchUrl) => {
    const response = await openmrsFetch<EncounterResponse>(fetchUrl);
    return response.data;
  });

  const result = useMemo(() => {
    const encounter = (data?.results ?? [])
      .filter(
        (candidate) =>
          encounterMatchesForm(candidate, formIdentifier) &&
          isWithinPregnancyEpisode(candidate.encounterDatetime, pregnancyStartDate),
      )
      .sort(
        (first, second) => new Date(second.encounterDatetime).getTime() - new Date(first.encounterDatetime).getTime(),
      )[0];

    if (!encounter) {
      return {
        hasBirthPlan: false,
        planDate: null,
        transportArranged: false,
        referenceHospital: null,
        encounterUuid: null,
      };
    }

    const observations = flattenMaternalObservations(encounter.obs);
    const transportObs = observations.find((observation) => observation.concept?.uuid === transportConceptUuid);
    const hospitalObs = observations.find((observation) => observation.concept?.uuid === referenceHospitalConceptUuid);
    const hospitalValue = hospitalObs?.value;
    const referenceHospital =
      typeof hospitalValue === 'string'
        ? hospitalValue
        : hospitalValue && typeof hospitalValue === 'object' && 'display' in hospitalValue
          ? String(hospitalValue.display)
          : null;

    return {
      hasBirthPlan: true,
      planDate: dayjs(encounter.encounterDatetime).format('DD/MM/YYYY'),
      transportArranged: Boolean(transportObs?.value),
      referenceHospital,
      encounterUuid: encounter.uuid,
    };
  }, [data?.results, formIdentifier, pregnancyStartDate, referenceHospitalConceptUuid, transportConceptUuid]);

  return {
    ...result,
    isLoading: isPregnancyLoading || isLoading,
    error: pregnancyError ?? error ?? null,
    mutate: () => {
      void mutate();
    },
  };
}

export default useBirthPlan;
