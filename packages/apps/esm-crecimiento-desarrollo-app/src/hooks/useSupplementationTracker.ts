import { openmrsFetch, restBaseUrl, useConfig } from '@openmrs/esm-framework';
import { useMemo } from 'react';
import useSWR from 'swr';

import type { ConfigObject } from '../config-schema';

interface SupplementationResult {
  delivered: number;
  total: number;
  percentage: number;
  isComplete: boolean;
  isLoading: boolean;
  error: Error | null;
  mutate: () => void;
}

/**
 * Hook para tracking de suplementación con MMN según Directiva 068-MINSA:
 * - 360 sobres de multimicronutrientes (MMN) en polvo
 * - 1 sobre diario desde los 6 meses hasta completar 360
 *
 * Usa: config.supplementation.mmnConceptUuid, config.supplementation.mmnTotalTarget
 */
export function useSupplementationTracker(patientUuid: string): SupplementationResult {
  const config = useConfig<ConfigObject>();
  const conceptUuid = config.supplementation?.mmnConceptUuid;
  const totalTarget = config.supplementation?.mmnTotalTarget ?? 360;

  const url = useMemo(() => {
    if (!patientUuid || !conceptUuid) return null;
    return `${restBaseUrl}/obs?patient=${patientUuid}&concept=${conceptUuid}&v=custom:(uuid,value,obsDatetime)`;
  }, [patientUuid, conceptUuid]);

  const { data, isLoading, error, mutate } = useSWR(url, async (fetchUrl: string) => {
    const response = await openmrsFetch(fetchUrl);
    return response?.data;
  });

  const result = useMemo(() => {
    const observations = data?.results ?? [];
    const delivered = observations.reduce((sum: number, obs: { value?: number | string }) => {
      const val = typeof obs.value === 'number' ? obs.value : parseFloat(obs.value);
      return sum + (Number.isNaN(val) ? 0 : val);
    }, 0);

    const percentage = totalTarget > 0 ? Math.min((delivered / totalTarget) * 100, 100) : 0;
    const isComplete = delivered >= totalTarget;

    return { delivered, total: totalTarget, percentage, isComplete };
  }, [data, totalTarget]);

  return {
    ...result,
    isLoading,
    error,
    mutate,
  };
}

export default useSupplementationTracker;
