import { openmrsFetch, restBaseUrl, useConfig } from '@openmrs/esm-framework';
import { useMemo } from 'react';
import useSWR from 'swr';

import type { ConfigObject } from '../config-schema';
import { isWithinPregnancyEpisode } from '../utils/pregnancy-episode-utils';

import { useCurrentPregnancy } from './useCurrentPregnancy';

interface SupplementItem {
  name: string;
  delivered: number;
  total: number;
  percentage: number;
  isComplete: boolean;
}

interface PrenatalSupplementationResult {
  supplements: SupplementItem[];
  overallPercentage: number;
  isLoading: boolean;
  error: Error | null;
  mutate: () => void;
}

/**
 * Hook para suplementación prenatal según NTS 105-MINSA:
 * - Ácido fólico: 400 μg/día (desde antes de la concepción hasta semana 13)
 * - Sulfato ferroso: 60mg Fe elemental/día (desde semana 14)
 * - Calcio: 500mg/día (desde semana 20 hasta el parto)
 *
 * Usa: config.supplementation.{ironConceptUuid, folicAcidConceptUuid, calciumConceptUuid}
 */
export function usePrenatalSupplementation(patientUuid: string): PrenatalSupplementationResult {
  const config = useConfig<ConfigObject>();
  const { pregnancyStartDate, isLoading: isPregnancyLoading, error: pregnancyError } = useCurrentPregnancy(patientUuid);

  const supplementDefs = useMemo(() => {
    const defs: Array<{ name: string; uuid: string; total: number }> = [];

    if (config.supplementation?.folicAcidConceptUuid) {
      defs.push({
        name: 'Ácido Fólico',
        uuid: config.supplementation.folicAcidConceptUuid,
        total: 90,
      });
    }
    if (config.supplementation?.ironConceptUuid) {
      defs.push({
        name: 'Sulfato Ferroso',
        uuid: config.supplementation.ironConceptUuid,
        total: 180,
      });
    }
    if (config.supplementation?.calciumConceptUuid) {
      defs.push({
        name: 'Calcio',
        uuid: config.supplementation.calciumConceptUuid,
        total: 140,
      });
    }

    return defs;
  }, [config]);

  const urls = useMemo(() => {
    if (!patientUuid || supplementDefs.length === 0) return null;
    return supplementDefs.map(
      (s) => `${restBaseUrl}/obs?patient=${patientUuid}&concept=${s.uuid}&v=custom:(uuid,value,obsDatetime)`,
    );
  }, [patientUuid, supplementDefs]);

  const { data, isLoading, error, mutate } = useSWR(urls, async (fetchUrls: string[]) => {
    const responses = await Promise.all(fetchUrls.map((u) => openmrsFetch(u)));
    return responses.map((r) => r?.data);
  });

  const result = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        supplements: supplementDefs.map((s) => ({
          name: s.name,
          delivered: 0,
          total: s.total,
          percentage: 0,
          isComplete: false,
        })),
        overallPercentage: 0,
      };
    }

    const supplements: SupplementItem[] = supplementDefs.map((def, idx) => {
      const observations = (data[idx]?.results ?? []).filter((obs: { obsDatetime?: string }) =>
        isWithinPregnancyEpisode(obs.obsDatetime, pregnancyStartDate),
      );
      const delivered = observations.reduce((sum: number, obs: { value?: number | string }) => {
        const val = typeof obs.value === 'number' ? obs.value : Number.parseFloat(obs.value);
        return sum + (Number.isNaN(val) ? 0 : val);
      }, 0);

      const percentage = def.total > 0 ? Math.min((delivered / def.total) * 100, 100) : 0;
      const isComplete = delivered >= def.total;

      return {
        name: def.name,
        delivered,
        total: def.total,
        percentage,
        isComplete,
      };
    });

    const overallPercentage =
      supplements.length > 0 ? supplements.reduce((sum, s) => sum + s.percentage, 0) / supplements.length : 0;

    return { supplements, overallPercentage };
  }, [data, pregnancyStartDate, supplementDefs]);

  return {
    ...result,
    isLoading: isPregnancyLoading || isLoading,
    error: pregnancyError ?? error ?? null,
    mutate,
  };
}

export default usePrenatalSupplementation;
