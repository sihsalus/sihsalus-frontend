import { openmrsFetch, restBaseUrl, useConfig, usePatient } from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import { useMemo } from 'react';
import useSWR from 'swr';

import type { ConfigObject } from '../config-schema';

interface AnemiaScreeningResult {
  lastHb: number | null;
  lastDate: string | null;
  nextDueDate: string | null;
  isLoading: boolean;
  error: Error | null;
  mutate: () => void;
}

/**
 * Hook para tamizaje de anemia según NTS 213 y RM 429-2024:
 * - 6 a 23 meses: inicio, tercer mes y término de la suplementación
 * - 24 a 59 meses: dos veces al año
 * - 5 a 11 años: una vez al año
 *
 * Usa: config.anemiaScreening.hemoglobinaConceptUuid
 */
export function useAnemiaScreening(patientUuid: string): AnemiaScreeningResult {
  const config = useConfig<ConfigObject>();
  const { patient, isLoading: isPatientLoading, error: patientError } = usePatient(patientUuid);
  const conceptUuid = config.anemiaScreening?.hemoglobinaConceptUuid;

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
        nextDueDate: null,
      };
    }

    const hbValue = typeof obs.value === 'number' ? obs.value : parseFloat(obs.value);
    const obsDate = obs.obsDatetime ? dayjs(obs.obsDatetime).format('DD/MM/YYYY') : null;
    const intervalMonths = getAnemiaScreeningIntervalMonths(patient?.birthDate, obs.obsDatetime);
    const nextDueDate =
      obs.obsDatetime && intervalMonths
        ? dayjs(obs.obsDatetime).add(intervalMonths, 'months').format('DD/MM/YYYY')
        : null;

    return {
      lastHb: Number.isNaN(hbValue) ? null : hbValue,
      lastDate: obsDate,
      nextDueDate,
    };
  }, [data, patient?.birthDate]);

  return {
    ...result,
    isLoading: isPatientLoading || isObservationLoading,
    error: (patientError ?? observationError ?? null) as Error | null,
    mutate,
  };
}

export function getAnemiaScreeningIntervalMonths(birthDate?: string, screeningDate?: string): 3 | 6 | 12 | null {
  if (!birthDate || !screeningDate) return null;

  const ageInMonths = dayjs(screeningDate).diff(dayjs(birthDate), 'month', true);

  if (ageInMonths >= 6 && ageInMonths < 24) return 3;
  if (ageInMonths >= 24 && ageInMonths < 60) return 6;
  if (ageInMonths >= 60 && ageInMonths < 144) return 12;

  return null;
}

export default useAnemiaScreening;
