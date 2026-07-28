import { openmrsFetch, restBaseUrl, useConfig } from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import { useMemo } from 'react';
import useSWR from 'swr';

import type { ConfigObject } from '../config-schema';

interface StimulationSessionsResult {
  totalSessions: number | null;
  lastSessionDate: string | null;
  developmentAreas: string | null;
  isLoading: boolean;
  error: Error | null;
}

const fetcher = async (url: string) => {
  const response = await openmrsFetch(url);
  return response?.data;
};

/**
 * Hook para sesiones de estimulación temprana:
 * - Cuenta encounters con el formulario de estimulación
 * - Obtiene última evaluación de desarrollo
 *
 * Usa: config.earlyStimulation.developmentEvalConceptUuid
 */
export function useStimulationSessions(patientUuid: string): StimulationSessionsResult {
  const config = useConfig<ConfigObject>();
  const devEvalUuid = config.earlyStimulation?.developmentEvalConceptUuid;

  const devEvalUrl = useMemo(() => {
    if (!patientUuid || !devEvalUuid) return null;
    return `${restBaseUrl}/obs?patient=${patientUuid}&concept=${devEvalUuid}&v=custom:(uuid,value,obsDatetime,display)&sort=desc`;
  }, [patientUuid, devEvalUuid]);

  const { data: devData, isLoading, error } = useSWR(devEvalUrl, fetcher);

  const result = useMemo(() => {
    const results = devData?.results;
    if (!results || results.length === 0) {
      return { totalSessions: null, lastSessionDate: null, developmentAreas: null };
    }

    const totalSessions = results.length;
    const lastObs = results[0];
    const lastSessionDate = lastObs?.obsDatetime ? dayjs(lastObs.obsDatetime).format('DD/MM/YYYY') : null;

    let developmentAreas: string | null = null;
    if (lastObs?.value) {
      developmentAreas =
        typeof lastObs.value === 'object' && lastObs.value?.display ? lastObs.value.display : String(lastObs.value);
    }

    return { totalSessions, lastSessionDate, developmentAreas };
  }, [devData]);

  return { ...result, isLoading, error };
}

export default useStimulationSessions;
