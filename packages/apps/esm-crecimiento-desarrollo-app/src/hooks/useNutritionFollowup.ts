import { openmrsFetch, restBaseUrl, useConfig } from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import { useMemo } from 'react';
import useSWR from 'swr';

import type { ConfigObject } from '../config-schema';

interface NutritionFollowupResult {
  mmnStatus: string | null;
  ironStatus: string | null;
  counselingCount: number | null;
  lastFollowupDate: string | null;
  isLoading: boolean;
  error: Error | null;
}

const fetcher = async (url: string) => {
  const response = await openmrsFetch(url);
  return response?.data;
};

function buildObsUrl(patientUuid: string, conceptUuid: string | undefined): string | null {
  if (!patientUuid || !conceptUuid) return null;
  return `${restBaseUrl}/obs?patient=${patientUuid}&concept=${conceptUuid}&v=custom:(uuid,value,obsDatetime,display)&limit=1&sort=desc`;
}

function extractDisplayValue(data: Record<string, unknown> | undefined | null): string | null {
  const obs = data?.results?.[0];
  if (!obs) return null;
  if (typeof obs.value === 'object' && obs.value?.display) {
    return obs.value.display;
  }
  if (obs.value != null) {
    return String(obs.value);
  }
  return null;
}

/**
 * Hook para seguimiento nutricional infantil:
 * - ¿Recibiendo MMN? (Coded)
 * - ¿Tomando suplemento de hierro? (Coded)
 * - Número de consejería nutricional (Numeric)
 * - Última fecha de seguimiento
 *
 * Usa: config.childNutrition.mmnReceivingConceptUuid, ironReceivingConceptUuid, nutritionCounselingCountConceptUuid
 */
export function useNutritionFollowup(patientUuid: string): NutritionFollowupResult {
  const config = useConfig<ConfigObject>();
  const cn = config.childNutrition;

  const mmnUrl = useMemo(
    () => buildObsUrl(patientUuid, cn?.mmnReceivingConceptUuid),
    [patientUuid, cn?.mmnReceivingConceptUuid],
  );
  const ironUrl = useMemo(
    () => buildObsUrl(patientUuid, cn?.ironReceivingConceptUuid),
    [patientUuid, cn?.ironReceivingConceptUuid],
  );
  const counselingUrl = useMemo(
    () => buildObsUrl(patientUuid, cn?.nutritionCounselingCountConceptUuid),
    [patientUuid, cn?.nutritionCounselingCountConceptUuid],
  );

  const { data: mmnData, isLoading: mmnLoading, error: mmnError } = useSWR(mmnUrl, fetcher);
  const { data: ironData, isLoading: ironLoading, error: ironError } = useSWR(ironUrl, fetcher);
  const { data: counselingData, isLoading: counselingLoading, error: counselingError } = useSWR(counselingUrl, fetcher);

  const result = useMemo(() => {
    const mmnStatus = extractDisplayValue(mmnData);
    const ironStatus = extractDisplayValue(ironData);

    const counselingObs = counselingData?.results?.[0];
    const counselingCount =
      counselingObs?.value != null
        ? typeof counselingObs.value === 'number'
          ? counselingObs.value
          : parseFloat(counselingObs.value)
        : null;

    const dates = [
      mmnData?.results?.[0]?.obsDatetime,
      ironData?.results?.[0]?.obsDatetime,
      counselingData?.results?.[0]?.obsDatetime,
    ].filter(Boolean);
    const lastFollowupDate = dates.length > 0 ? dayjs(dates[0]).format('DD/MM/YYYY') : null;

    return {
      mmnStatus,
      ironStatus,
      counselingCount: counselingCount != null && !Number.isNaN(counselingCount) ? counselingCount : null,
      lastFollowupDate,
    };
  }, [mmnData, ironData, counselingData]);

  return {
    ...result,
    isLoading: mmnLoading || ironLoading || counselingLoading,
    error: mmnError || ironError || counselingError,
  };
}

export default useNutritionFollowup;
