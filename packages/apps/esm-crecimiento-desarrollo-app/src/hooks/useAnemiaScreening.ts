import { openmrsFetch, restBaseUrl, useConfig } from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import { useMemo } from 'react';
import useSWR from 'swr';

import type { ConfigObject } from '../config-schema';

interface AnemiaScreeningResult {
  lastHb: number | null;
  lastDate: string | null;
  isAnemic: boolean;
  nextDueDate: string | null;
  isLoading: boolean;
  error: Error | null;
  mutate: () => void;
}

/**
 * Hook para tamizaje de anemia según NTS 238:
 * - Primer dosaje de Hb a los 6 meses
 * - Frecuencia semestral hasta los 2 años
 * - Frecuencia anual a partir de los 2 años
 * - Anemia: Hb < 11 g/dL (configurable via anemiaScreening.anemiaThreshold)
 *
 * Usa: config.anemiaScreening.hemoglobinaConceptUuid
 */
export function useAnemiaScreening(patientUuid: string): AnemiaScreeningResult {
  const config = useConfig<ConfigObject>();
  const conceptUuid = config.anemiaScreening?.hemoglobinaConceptUuid;
  const threshold = config.anemiaScreening?.anemiaThreshold ?? 11.0;

  const url = useMemo(() => {
    if (!patientUuid || !conceptUuid) return null;
    return `${restBaseUrl}/obs?patient=${patientUuid}&concept=${conceptUuid}&v=custom:(uuid,value,obsDatetime)&limit=1&sort=desc`;
  }, [patientUuid, conceptUuid]);

  const { data, isLoading, error, mutate } = useSWR(url, async (fetchUrl: string) => {
    const response = await openmrsFetch(fetchUrl);
    return response?.data;
  });

  const result = useMemo(() => {
    const obs = data?.results?.[0];
    if (!obs) {
      return { lastHb: null, lastDate: null, isAnemic: false, nextDueDate: null };
    }

    const hbValue = typeof obs.value === 'number' ? obs.value : parseFloat(obs.value);
    const obsDate = obs.obsDatetime ? dayjs(obs.obsDatetime).format('DD/MM/YYYY') : null;
    const isAnemic = !isNaN(hbValue) && hbValue < threshold;

    // Calcular próximo tamizaje: 6 meses después del último
    const nextDueDate = obs.obsDatetime ? dayjs(obs.obsDatetime).add(6, 'months').format('DD/MM/YYYY') : null;

    return { lastHb: isNaN(hbValue) ? null : hbValue, lastDate: obsDate, isAnemic, nextDueDate };
  }, [data, threshold]);

  return {
    ...result,
    isLoading,
    error,
    mutate,
  };
}

export default useAnemiaScreening;
