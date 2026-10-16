import { openmrsFetch, restBaseUrl, useConfig, useOpenmrsFetchAll } from '@openmrs/esm-framework';
import type { ConfigObject } from '../config-schema';
import { isWithinPregnancyEpisode } from '../utils/pregnancy-episode-utils';
import { useCurrentPregnancy } from './useCurrentPregnancy';

interface IndicationObservation {
  uuid: string;
  value: number;
  obsDatetime: string;
}

function useIndications(patientUuid: string, conceptUuid?: string) {
  return useOpenmrsFetchAll<IndicationObservation>(
    patientUuid && conceptUuid
      ? `${restBaseUrl}/obs?patient=${patientUuid}&s=default&concept=${conceptUuid}&v=custom:(uuid,value,obsDatetime)`
      : null,
    { fetcher: openmrsFetch, swrInfiniteConfig: { keepPreviousData: false } },
  );
}

/** Recorded tablet indications in the latest pregnancy; not dispensing, consumption or adherence. */
export function usePrenatalSupplementation(patientUuid: string) {
  const config = useConfig<ConfigObject>();
  const { pregnancyStartDate, isLoading: isPregnancyLoading, error: pregnancyError } = useCurrentPregnancy(patientUuid);
  const folicAcid = useIndications(patientUuid, config.supplementation?.folicAcidConceptUuid);
  const ironFolicAcid = useIndications(patientUuid, config.supplementation?.ironConceptUuid);
  const calcium = useIndications(patientUuid, config.supplementation?.calciumConceptUuid);
  const readings = [
    { nameKey: 'prenatalFolicAcid', conceptUuid: config.supplementation?.folicAcidConceptUuid, ...folicAcid },
    { nameKey: 'prenatalIronFolicAcid', conceptUuid: config.supplementation?.ironConceptUuid, ...ironFolicAcid },
    { nameKey: 'prenatalCalcium', conceptUuid: config.supplementation?.calciumConceptUuid, ...calcium },
  ];

  return {
    supplements: readings
      .filter(({ conceptUuid }) => conceptUuid)
      .map(({ nameKey, data }) => {
        const observations = (data ?? []).filter((obs) =>
          isWithinPregnancyEpisode(obs.obsDatetime, pregnancyStartDate),
        );
        return {
          nameKey,
          indicatedTablets: observations.length ? observations.reduce((sum, obs) => sum + obs.value, 0) : null,
        };
      }),
    isLoading: isPregnancyLoading || readings.some(({ isLoading }) => isLoading),
    error: pregnancyError ?? readings.find(({ error }) => error)?.error ?? null,
    mutate: () => Promise.all(readings.map(({ mutate }) => mutate())),
  };
}

export default usePrenatalSupplementation;
