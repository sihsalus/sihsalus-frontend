import { openmrsFetch, restBaseUrl, useConfig, useOpenmrsFetchAll } from '@openmrs/esm-framework';
import { useMemo } from 'react';

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

interface SupplementationObservation {
  uuid: string;
  value?: number | string;
  obsDatetime?: string;
}

/**
 * Acumula sobres MMN entregados frente a una meta configurable de entregas.
 * No determina dosis, duración, consumo ni finalización de la suplementación.
 *
 * Usa: config.supplementation.mmnConceptUuid, config.supplementation.mmnTotalTarget
 */
export function useSupplementationTracker(patientUuid: string): SupplementationResult {
  const config = useConfig<ConfigObject>();
  const conceptUuid = config.supplementation?.mmnConceptUuid;
  const totalTarget = config.supplementation?.mmnTotalTarget ?? 360;

  const url = useMemo(() => {
    if (!patientUuid || !conceptUuid) return null;
    return `${restBaseUrl}/obs?patient=${patientUuid}&s=default&concept=${conceptUuid}&v=custom:(uuid,value,obsDatetime)`;
  }, [patientUuid, conceptUuid]);

  const { data, isLoading, error, mutate } = useOpenmrsFetchAll<SupplementationObservation>(url, {
    fetcher: openmrsFetch,
    swrInfiniteConfig: { keepPreviousData: false },
  });

  const result = useMemo(() => {
    const observations = data ?? [];
    const delivered = observations.reduce((sum, obs) => {
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
