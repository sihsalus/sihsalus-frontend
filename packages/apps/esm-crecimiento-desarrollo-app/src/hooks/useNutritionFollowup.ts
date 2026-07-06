import { openmrsFetch, restBaseUrl, useConfig } from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import { useMemo } from 'react';
import useSWR from 'swr';

import type { ConfigObject } from '../config-schema';

interface NutritionFollowupResult {
  mmnStatus: string | null;
  ironStatus: string | null;
  nutritionCounseling: string | null;
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
 * - Cantidad de MMN recibidos
 * - Cantidad de suplemento de hierro recibido
 * - Consejería nutricional brindada
 * - Última fecha de seguimiento
 *
 * Usa: config.childNutrition.mmnReceivingConceptUuid, ironReceivingConceptUuid, nutritionCounselingConceptUuid
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
    () => buildObsUrl(patientUuid, cn?.nutritionCounselingConceptUuid),
    [patientUuid, cn?.nutritionCounselingConceptUuid],
  );

  const { data: mmnData, isLoading: mmnLoading, error: mmnError } = useSWR(mmnUrl, fetcher);
  const { data: ironData, isLoading: ironLoading, error: ironError } = useSWR(ironUrl, fetcher);
  const { data: counselingData, isLoading: counselingLoading, error: counselingError } = useSWR(counselingUrl, fetcher);

  const result = useMemo(() => {
    const mmnStatus = extractDisplayValue(mmnData);
    const ironStatus = extractDisplayValue(ironData);
    const nutritionCounseling = extractDisplayValue(counselingData);

    const dates = [
      mmnData?.results?.[0]?.obsDatetime,
      ironData?.results?.[0]?.obsDatetime,
      counselingData?.results?.[0]?.obsDatetime,
    ].filter(Boolean);
    const lastFollowupDate = dates.length > 0 ? dayjs(dates[0]).format('DD/MM/YYYY') : null;

    return {
      mmnStatus,
      ironStatus,
      nutritionCounseling,
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
