import { openmrsFetch, restBaseUrl, useConfig } from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import { useMemo } from 'react';
import useSWR from 'swr';

import type { ConfigObject } from '../config-schema';

interface ScreeningItem {
  name: string;
  completed: boolean;
  date: string | null;
  result: string | null;
}

interface ScreeningIndicatorsResult {
  screenings: ScreeningItem[];
  completedCount: number;
  totalRequired: number;
  percentage: number;
  isLoading: boolean;
  error: Error | null;
  mutate: () => void;
}

/**
 * Hook para tamizajes obligatorios:
 * - CRED (NTS 238): Hemoglobina, desarrollo (EDI/vigilancia), violencia, visual, auditivo
 * - Prenatal (NTS 159): VIH, Sífilis (RPR/VDRL), Hepatitis B (HBsAg)
 *
 * Usa: config.anemiaScreening.hemoglobinaConceptUuid para Hb
 *      config.prenatalScreening.{vihResultConceptUuid, sifilisResultConceptUuid, hepatitisBResultConceptUuid}
 */
export function useScreeningIndicators(patientUuid: string): ScreeningIndicatorsResult {
  const config = useConfig<ConfigObject>();

  const screeningConcepts = useMemo(() => {
    const concepts: Array<{ name: string; uuid: string }> = [];

    if (config.anemiaScreening?.hemoglobinaConceptUuid) {
      concepts.push({ name: 'Hemoglobina', uuid: config.anemiaScreening.hemoglobinaConceptUuid });
    }
    if (config.prenatalScreening?.vihResultConceptUuid) {
      concepts.push({ name: 'VIH', uuid: config.prenatalScreening.vihResultConceptUuid });
    }
    if (config.prenatalScreening?.sifilisResultConceptUuid) {
      concepts.push({ name: 'Sífilis (RPR/VDRL)', uuid: config.prenatalScreening.sifilisResultConceptUuid });
    }
    if (config.prenatalScreening?.hepatitisBResultConceptUuid) {
      concepts.push({ name: 'Hepatitis B (HBsAg)', uuid: config.prenatalScreening.hepatitisBResultConceptUuid });
    }

    return concepts;
  }, [config]);

  const urls = useMemo(() => {
    if (!patientUuid || screeningConcepts.length === 0) return null;
    return screeningConcepts.map(
      (c) =>
        `${restBaseUrl}/obs?patient=${patientUuid}&concept=${c.uuid}&v=custom:(uuid,value,obsDatetime,display)&limit=1&sort=desc`,
    );
  }, [patientUuid, screeningConcepts]);

  const { data, isLoading, error, mutate } = useSWR(urls, async (fetchUrls: string[]) => {
    const responses = await Promise.all(fetchUrls.map((u) => openmrsFetch(u)));
    return responses.map((r) => r?.data);
  });

  const result = useMemo(() => {
    if (!data || data.length === 0) {
      return { screenings: [], completedCount: 0, totalRequired: screeningConcepts.length, percentage: 0 };
    }

    const screenings: ScreeningItem[] = screeningConcepts.map((concept, idx) => {
      const obs = data[idx]?.results?.[0];
      return {
        name: concept.name,
        completed: !!obs,
        date: obs?.obsDatetime ? dayjs(obs.obsDatetime).format('DD/MM/YYYY') : null,
        result: obs?.display ?? null,
      };
    });

    const completedCount = screenings.filter((s) => s.completed).length;
    const totalRequired = screenings.length;
    const percentage = totalRequired > 0 ? (completedCount / totalRequired) * 100 : 0;

    return { screenings, completedCount, totalRequired, percentage };
  }, [data, screeningConcepts]);

  return {
    ...result,
    isLoading,
    error,
    mutate,
  };
}

export default useScreeningIndicators;
