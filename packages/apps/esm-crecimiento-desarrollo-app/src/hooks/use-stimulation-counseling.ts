import { openmrsFetch, restBaseUrl, useConfig } from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import { useMemo } from 'react';
import useSWR from 'swr';

import type { ConfigObject } from '../config-schema';

interface StimulationCounselingResult {
  totalSessions: number | null;
  lastCounselingDate: string | null;
  lastCounselingResult: string | null;
  isLoading: boolean;
  error: Error | null;
}

const fetcher = async (url: string) => {
  const response = await openmrsFetch(url);
  return response?.data;
};

/**
 * Hook para consejería a padres en estimulación temprana:
 * - Cuenta observaciones de orientación/consejería
 * - Obtiene última fecha y resultado
 *
 * Usa: config.earlyStimulation.counselingConceptUuid
 */
export function useStimulationCounseling(patientUuid: string): StimulationCounselingResult {
  const config = useConfig<ConfigObject>();
  const counselingUuid = config.earlyStimulation?.counselingConceptUuid;

  const url = useMemo(() => {
    if (!patientUuid || !counselingUuid) return null;
    return `${restBaseUrl}/obs?patient=${patientUuid}&concept=${counselingUuid}&v=custom:(uuid,value,obsDatetime,display)&sort=desc`;
  }, [patientUuid, counselingUuid]);

  const { data, isLoading, error } = useSWR(url, fetcher);

  const result = useMemo(() => {
    const results = data?.results;
    if (!results || results.length === 0) {
      return { totalSessions: null, lastCounselingDate: null, lastCounselingResult: null };
    }

    const totalSessions = results.length;
    const lastObs = results[0];
    const lastCounselingDate = lastObs?.obsDatetime ? dayjs(lastObs.obsDatetime).format('DD/MM/YYYY') : null;

    let lastCounselingResult: string | null = null;
    if (lastObs?.value) {
      lastCounselingResult =
        typeof lastObs.value === 'object' && lastObs.value?.display ? lastObs.value.display : String(lastObs.value);
    }

    return { totalSessions, lastCounselingDate, lastCounselingResult };
  }, [data]);

  return { ...result, isLoading, error };
}

export default useStimulationCounseling;
