import { openmrsFetch, restBaseUrl, useConfig } from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import { useMemo } from 'react';
import useSWR from 'swr';

import type { ConfigObject } from '../config-schema';

interface NutritionalAssessmentResult {
  nutritionClassification: string | null;
  weight: string | null;
  height: string | null;
  lastMeasurementDate: string | null;
  isLoading: boolean;
  error: Error | null;
}

function buildObsUrl(patientUuid: string, conceptUuid: string | undefined): string | null {
  if (!patientUuid || !conceptUuid) return null;
  return `${restBaseUrl}/obs?patient=${patientUuid}&concept=${conceptUuid}&v=custom:(uuid,value,obsDatetime,display)&limit=1&sort=desc`;
}

const fetcher = async (url: string) => {
  const response = await openmrsFetch(url);
  return response?.data;
};

function extractObsValue(data: { results?: Array<{ value?: { display?: string } | string | number }> }): string | null {
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

function extractObsDate(data: { results?: Array<{ obsDatetime?: string }> }): string | null {
  const obs = data?.results?.[0];
  return obs?.obsDatetime ? dayjs(obs.obsDatetime).format('DD/MM/YYYY') : null;
}

/**
 * Hook para consultar el último registro de evaluación nutricional infantil (NTS 238):
 * - Clasificación nutricional, peso y talla
 * - Última fecha de medición
 *
 * Usa: config.childNutrition.nutritionClassificationConceptUuid, weightConceptUuid, heightConceptUuid
 */
export function useNutritionalAssessment(patientUuid: string): NutritionalAssessmentResult {
  const config = useConfig<ConfigObject>();
  const cn = config.childNutrition;

  const classificationUrl = useMemo(
    () => buildObsUrl(patientUuid, cn?.nutritionClassificationConceptUuid),
    [patientUuid, cn?.nutritionClassificationConceptUuid],
  );
  const weightUrl = useMemo(
    () => buildObsUrl(patientUuid, cn?.weightConceptUuid),
    [patientUuid, cn?.weightConceptUuid],
  );
  const heightUrl = useMemo(
    () => buildObsUrl(patientUuid, cn?.heightConceptUuid),
    [patientUuid, cn?.heightConceptUuid],
  );

  const {
    data: classificationData,
    isLoading: classificationLoading,
    error: classificationError,
  } = useSWR(classificationUrl, fetcher);
  const { data: weightData, isLoading: weightLoading, error: weightError } = useSWR(weightUrl, fetcher);
  const { data: heightData, isLoading: heightLoading, error: heightError } = useSWR(heightUrl, fetcher);

  const result = useMemo(() => {
    const nutritionClassification = extractObsValue(classificationData);
    const weight = extractObsValue(weightData);
    const height = extractObsValue(heightData);

    const dates = [extractObsDate(classificationData), extractObsDate(weightData), extractObsDate(heightData)].filter(
      Boolean,
    );
    const lastMeasurementDate = dates.length > 0 ? dates[0] : null;

    return { nutritionClassification, weight, height, lastMeasurementDate };
  }, [classificationData, weightData, heightData]);

  return {
    ...result,
    isLoading: classificationLoading || weightLoading || heightLoading,
    error: classificationError || weightError || heightError,
  };
}

export default useNutritionalAssessment;
