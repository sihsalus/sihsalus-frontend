import { openmrsFetch, restBaseUrl, useConfig } from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import { useMemo } from 'react';
import useSWR from 'swr';

import type { ConfigObject } from '../config-schema';

interface FeedingAssessmentResult {
  feedingType: string | null;
  lastAssessmentDate: string | null;
  isBreastfeeding: boolean | null;
  isLoading: boolean;
  error: Error | null;
}

const fetcher = async (url: string) => {
  const response = await openmrsFetch(url);
  return response?.data;
};

type ObsValue = { uuid?: string; display?: string } | string | number | boolean | null | undefined;

function getObsValueDisplay(value: ObsValue): string | null {
  if (typeof value === 'object' && value?.display) {
    return value.display;
  }
  return value != null ? String(value) : null;
}

function isBreastfeedingAnswer(value: ObsValue, breastfeedingAnswerConceptUuid: string | undefined): boolean {
  if (!value) {
    return false;
  }

  if (typeof value === 'object') {
    if (breastfeedingAnswerConceptUuid && value.uuid === breastfeedingAnswerConceptUuid) {
      return true;
    }

    return Boolean(value.display?.toLowerCase().includes('lactancia materna'));
  }

  return String(value).toLowerCase().includes('lactancia materna');
}

/**
 * Hook para evaluación de alimentación infantil:
 * - Tipo de alimentación (evaluación general)
 * - ¿Recibe lactancia materna?
 * - Última fecha de evaluación
 *
 * Usa: config.childNutrition.feedingAssessmentConceptUuid, breastfeedingAnswerConceptUuid
 */
export function useFeedingAssessment(patientUuid: string): FeedingAssessmentResult {
  const config = useConfig<ConfigObject>();
  const cn = config.childNutrition;

  const feedingUrl = useMemo(() => {
    if (!patientUuid || !cn?.feedingAssessmentConceptUuid) return null;
    return `${restBaseUrl}/obs?patient=${patientUuid}&concept=${cn.feedingAssessmentConceptUuid}&v=custom:(uuid,value,obsDatetime,display)&limit=1&sort=desc`;
  }, [patientUuid, cn?.feedingAssessmentConceptUuid]);

  const { data: feedingData, isLoading: feedingLoading, error: feedingError } = useSWR(feedingUrl, fetcher);

  const result = useMemo(() => {
    const feedingObs = feedingData?.results?.[0];

    let feedingType: string | null = null;
    if (feedingObs) {
      feedingType = getObsValueDisplay(feedingObs.value);
    }

    const lastAssessmentDate = feedingObs?.obsDatetime ? dayjs(feedingObs.obsDatetime).format('DD/MM/YYYY') : null;
    const isBreastfeeding = feedingObs
      ? isBreastfeedingAnswer(feedingObs.value, cn?.breastfeedingAnswerConceptUuid)
      : null;

    return { feedingType, lastAssessmentDate, isBreastfeeding };
  }, [feedingData, cn?.breastfeedingAnswerConceptUuid]);

  return {
    ...result,
    isLoading: feedingLoading,
    error: feedingError,
  };
}

export default useFeedingAssessment;
