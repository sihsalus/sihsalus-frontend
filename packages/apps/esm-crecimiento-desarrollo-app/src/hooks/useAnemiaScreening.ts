import { openmrsFetch, restBaseUrl, useConfig, usePatient } from '@openmrs/esm-framework';
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
  const { patient, isLoading: isPatientLoading, error: patientError } = usePatient(patientUuid);
  const conceptUuid = config.anemiaScreening?.hemoglobinaConceptUuid;
  const threshold = config.anemiaScreening?.anemiaThreshold ?? 11.0;

  const url = useMemo(() => {
    if (!patientUuid || !conceptUuid) return null;
    return `${restBaseUrl}/obs?patient=${patientUuid}&concept=${conceptUuid}&v=custom:(uuid,value,obsDatetime)&limit=1&sort=desc`;
  }, [patientUuid, conceptUuid]);

  const {
    data,
    isLoading: isObservationLoading,
    error: observationError,
    mutate,
  } = useSWR(url, async (fetchUrl: string) => {
    const response = await openmrsFetch(fetchUrl);
    return response?.data;
  });

  const result = useMemo(() => {
    const obs = data?.results?.[0];
    if (!obs) {
      return {
        lastHb: null,
        lastDate: null,
        isAnemic: false,
        nextDueDate: null,
      };
    }

    const hbValue = typeof obs.value === 'number' ? obs.value : parseFloat(obs.value);
    const obsDate = obs.obsDatetime ? dayjs(obs.obsDatetime).format('DD/MM/YYYY') : null;
    const isAnemic = !Number.isNaN(hbValue) && hbValue < threshold;

    const intervalMonths = getAnemiaScreeningIntervalMonths(patient?.birthDate, obs.obsDatetime);
    const nextDueDate = obs.obsDatetime
      ? dayjs(obs.obsDatetime).add(intervalMonths, 'months').format('DD/MM/YYYY')
      : null;

    return {
      lastHb: Number.isNaN(hbValue) ? null : hbValue,
      lastDate: obsDate,
      isAnemic,
      nextDueDate,
    };
  }, [data, patient?.birthDate, threshold]);

  return {
    ...result,
    isLoading: isPatientLoading || isObservationLoading,
    error: (patientError ?? observationError ?? null) as Error | null,
    mutate,
  };
}

export function getAnemiaScreeningIntervalMonths(birthDate?: string, screeningDate?: string): 6 | 12 {
  if (!birthDate || !screeningDate) return 6;

  return dayjs(screeningDate).diff(dayjs(birthDate), 'year', true) >= 2 ? 12 : 6;
}

export default useAnemiaScreening;
