import { openmrsFetch, restBaseUrl, useConfig } from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import { useMemo } from 'react';
import useSWR from 'swr';

import type { ConfigObject } from '../config-schema';
import { isWithinPregnancyEpisode } from '../utils/pregnancy-episode-utils';

import { useCurrentPregnancy } from './useCurrentPregnancy';

interface PsychoprophylaxisResult {
  sessionsCompleted: number;
  totalSessions: number;
  percentage: number;
  isComplete: boolean;
  lastSessionDate: string | null;
  isLoading: boolean;
  error: Error | null;
  mutate: () => void;
}

/**
 * Hook para psicoprofilaxis obstétrica según NTS 105-MINSA / RM 361-2011:
 * - 6 sesiones obligatorias durante el embarazo (configurable)
 * - Inician a partir de la semana 20 de gestación
 * - Cada encounter del tipo psicoprofilaxis = 1 sesión
 *
 * Usa: config.psychoprophylaxis.encounterTypeUuid
 *      config.psychoprophylaxis.totalSessionsRequired
 */
export function usePsychoprophylaxis(patientUuid: string): PsychoprophylaxisResult {
  const config = useConfig<ConfigObject>();
  const { pregnancyStartDate, isLoading: isPregnancyLoading, error: pregnancyError } = useCurrentPregnancy(patientUuid);
  const encounterTypeUuid = config.psychoprophylaxis?.encounterTypeUuid;
  const totalSessions = config.psychoprophylaxis?.totalSessionsRequired ?? 6;

  const url = useMemo(() => {
    if (!patientUuid || !encounterTypeUuid) return null;
    return `${restBaseUrl}/encounter?patient=${patientUuid}&encounterType=${encounterTypeUuid}&v=custom:(uuid,encounterDatetime)`;
  }, [patientUuid, encounterTypeUuid]);

  const { data, isLoading, error, mutate } = useSWR(url, async (fetchUrl: string) => {
    const response = await openmrsFetch(fetchUrl);
    return response?.data;
  });

  const result = useMemo(() => {
    const encounters = (data?.results ?? []).filter((encounter: { encounterDatetime?: string }) =>
      isWithinPregnancyEpisode(encounter.encounterDatetime, pregnancyStartDate),
    );
    const sessionsCompleted = encounters.length;
    const percentage = totalSessions > 0 ? Math.min((sessionsCompleted / totalSessions) * 100, 100) : 0;
    const isComplete = sessionsCompleted >= totalSessions;

    const sorted = [...encounters].sort(
      (a: { encounterDatetime: string }, b: { encounterDatetime: string }) =>
        new Date(b.encounterDatetime).getTime() - new Date(a.encounterDatetime).getTime(),
    );
    const lastSessionDate = sorted[0]?.encounterDatetime
      ? dayjs(sorted[0].encounterDatetime).format('DD/MM/YYYY')
      : null;

    return {
      sessionsCompleted,
      totalSessions,
      percentage,
      isComplete,
      lastSessionDate,
    };
  }, [data, pregnancyStartDate, totalSessions]);

  return {
    ...result,
    isLoading: isPregnancyLoading || isLoading,
    error: pregnancyError ?? error ?? null,
    mutate,
  };
}

export default usePsychoprophylaxis;
