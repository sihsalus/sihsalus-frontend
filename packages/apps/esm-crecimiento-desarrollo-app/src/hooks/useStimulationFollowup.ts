import { openmrsFetch, restBaseUrl, useConfig } from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import { useMemo } from 'react';
import useSWR from 'swr';

import type { ConfigObject } from '../config-schema';

interface StimulationFollowupResult {
  lastEvaluationResult: string | null;
  lastEvaluationDate: string | null;
  coordinationResult: string | null;
  motorResult: string | null;
  hasStimulationLack: boolean;
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

function extractDisplayValue(data: {
  results?: Array<{ value?: { display?: string } | string | number }>;
}): string | null {
  const obs = data?.results?.[0];
  if (!obs) return null;
  if (typeof obs.value === 'object' && obs.value?.display) {
    return obs.value.display;
  }
  return obs.value != null ? String(obs.value) : null;
}

function isDevelopmentRisk(value: string | null): boolean {
  if (!value) {
    return false;
  }

  const normalizedValue = value.toLowerCase();
  return (
    normalizedValue.includes('riesgo') ||
    normalizedValue.includes('retraso') ||
    normalizedValue.includes('risk') ||
    normalizedValue.includes('delay')
  );
}

/**
 * Hook de lectura histórica para seguimientos EEDP/TEPSI previos a NTS 238.
 * Las evaluaciones vigentes se lanzan desde DevelopmentOverview (Huanca, EDI y habilidades).
 *
 * Usa: config.earlyStimulation.tepsiCoordinationConceptUuid, tepsiMotorConceptUuid y clasificación CRED-004
 */
export function useStimulationFollowup(patientUuid: string): StimulationFollowupResult {
  const config = useConfig<ConfigObject>();
  const es = config.earlyStimulation;

  const coordUrl = useMemo(
    () => buildObsUrl(patientUuid, es?.tepsiCoordinationConceptUuid),
    [patientUuid, es?.tepsiCoordinationConceptUuid],
  );
  const motorUrl = useMemo(
    () => buildObsUrl(patientUuid, es?.tepsiMotorConceptUuid),
    [patientUuid, es?.tepsiMotorConceptUuid],
  );
  const lackUrl = useMemo(
    () => buildObsUrl(patientUuid, es?.stimulationLackConceptUuid),
    [patientUuid, es?.stimulationLackConceptUuid],
  );

  const { data: coordData, isLoading: coordLoading, error: coordError } = useSWR(coordUrl, fetcher);
  const { data: motorData, isLoading: motorLoading, error: motorError } = useSWR(motorUrl, fetcher);
  const { data: lackData, isLoading: lackLoading, error: lackError } = useSWR(lackUrl, fetcher);

  const result = useMemo(() => {
    const coordinationResult = extractDisplayValue(coordData);
    const motorResult = extractDisplayValue(motorData);
    const developmentClassification = extractDisplayValue(lackData);
    const hasStimulationLack = isDevelopmentRisk(developmentClassification);

    let lastEvaluationResult: string | null = null;
    if (coordinationResult || motorResult) {
      const parts = [
        coordinationResult ? `Coord: ${coordinationResult}` : null,
        motorResult ? `Motor: ${motorResult}` : null,
      ].filter(Boolean);
      lastEvaluationResult = parts.join(' | ');
    } else if (developmentClassification) {
      lastEvaluationResult = developmentClassification;
    }

    const dates = [
      coordData?.results?.[0]?.obsDatetime,
      motorData?.results?.[0]?.obsDatetime,
      lackData?.results?.[0]?.obsDatetime,
    ].filter(Boolean);
    const lastEvaluationDate = dates.length > 0 ? dayjs(dates[0]).format('DD/MM/YYYY') : null;

    return { lastEvaluationResult, lastEvaluationDate, coordinationResult, motorResult, hasStimulationLack };
  }, [coordData, motorData, lackData]);

  return {
    ...result,
    isLoading: coordLoading || motorLoading || lackLoading,
    error: coordError || motorError || lackError,
  };
}

export default useStimulationFollowup;
