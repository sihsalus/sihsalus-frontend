import { openmrsFetch, restBaseUrl, useConfig, useOpenmrsFetchAll } from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import { useMemo } from 'react';

import type { ConfigObject } from '../config-schema';
import { isWithinPregnancyEpisode } from '../utils/pregnancy-episode-utils';

import { useCurrentPregnancy } from './useCurrentPregnancy';

type RiskLevel = 'bajo' | 'alto' | 'muy-alto' | 'indeterminado';

type RiskObservation = {
  uuid: string;
  obsDatetime?: string;
  value?: { uuid?: string; display?: string };
};

interface ObstetricRiskResult {
  riskLevel: RiskLevel;
  riskFactors: string[];
  lastEvaluationDate: string | null;
  isLoading: boolean;
  error: Error | null;
  mutate: () => void;
}

/**
 * Hook para clasificación de riesgo obstétrico según NTS 105-MINSA:
 * - Bajo riesgo (Mínimo): sin factores de riesgo identificados
 * - Alto riesgo: uno o más factores (edad <15 o >35, antecedentes, etc.)
 * - Muy alto riesgo: preeclampsia, hemorragia, etc.
 *
 * Usa: config.obstetricRisk.classificationConceptUuid (Grupo de Riesgo #1530)
 *      config.obstetricRisk.highRiskConceptUuid / lowRiskConceptUuid / veryHighRiskConceptUuid
 *      config.obstetricRisk.riskFactorsConceptUuid (Motivo derivación #378, 23 answers)
 */
export function useObstetricRisk(patientUuid: string): ObstetricRiskResult {
  const config = useConfig<ConfigObject>();
  const { pregnancyStartDate, isLoading: isPregnancyLoading, error: pregnancyError } = useCurrentPregnancy(patientUuid);
  const classificationConceptUuid = config.obstetricRisk?.classificationConceptUuid;
  const highRiskConceptUuid = config.obstetricRisk?.highRiskConceptUuid;
  const lowRiskConceptUuid = config.obstetricRisk?.lowRiskConceptUuid;
  const veryHighRiskConceptUuid = config.obstetricRisk?.veryHighRiskConceptUuid;
  const riskFactorsConceptUuid = config.obstetricRisk?.riskFactorsConceptUuid;

  // Fetch risk classification (latest obs for Grupo de Riesgo)
  const classificationUrl = useMemo(() => {
    if (!patientUuid || !classificationConceptUuid) return null;
    return `${restBaseUrl}/obs?patient=${patientUuid}&concept=${classificationConceptUuid}&s=default&v=custom:(uuid,value:(uuid,display),obsDatetime)`;
  }, [patientUuid, classificationConceptUuid]);

  // Fetch risk factors (all obs for Motivo derivación casa espera)
  const riskFactorsUrl = useMemo(() => {
    if (!patientUuid || !riskFactorsConceptUuid) return null;
    return `${restBaseUrl}/obs?patient=${patientUuid}&concept=${riskFactorsConceptUuid}&s=default&v=custom:(uuid,value:(uuid,display),obsDatetime)`;
  }, [patientUuid, riskFactorsConceptUuid]);

  const {
    data: classificationData,
    isLoading: classLoading,
    error: classError,
    mutate: classificationMutate,
  } = useOpenmrsFetchAll<RiskObservation>(classificationUrl, { fetcher: openmrsFetch });

  const {
    data: factorsData,
    isLoading: factorsLoading,
    error: factorsError,
    mutate: factorsMutate,
  } = useOpenmrsFetchAll<RiskObservation>(riskFactorsUrl, { fetcher: openmrsFetch });

  const result = useMemo(() => {
    const obs = (classificationData ?? [])
      .filter((candidate) => isWithinPregnancyEpisode(candidate.obsDatetime, pregnancyStartDate))
      .sort(
        (first, second) =>
          new Date(second.obsDatetime ?? 0).getTime() - new Date(first.obsDatetime ?? 0).getTime(),
      )[0];
    if (!obs) {
      return {
        riskLevel: 'indeterminado' as RiskLevel,
        riskFactors: [] as string[],
        lastEvaluationDate: null,
      };
    }

    const valueUuid = obs.value?.uuid;
    let riskLevel: RiskLevel = 'indeterminado';

    if (valueUuid === lowRiskConceptUuid) {
      riskLevel = 'bajo';
    } else if (valueUuid === highRiskConceptUuid) {
      riskLevel = 'alto';
    } else if (valueUuid === veryHighRiskConceptUuid) {
      riskLevel = 'muy-alto';
    }

    const lastEvaluationDate = obs.obsDatetime ? dayjs(obs.obsDatetime).format('DD/MM/YYYY') : null;

    // Parse risk factors from Motivo derivación obs
    const riskFactors: string[] = (factorsData ?? [])
      .filter((factorObs) => isWithinPregnancyEpisode(factorObs.obsDatetime, pregnancyStartDate))
      .map((factorObs) => factorObs.value?.display)
      .filter((value): value is string => Boolean(value));

    return { riskLevel, riskFactors, lastEvaluationDate };
  }, [
    classificationData,
    factorsData,
    highRiskConceptUuid,
    lowRiskConceptUuid,
    pregnancyStartDate,
    veryHighRiskConceptUuid,
  ]);

  return {
    ...result,
    isLoading: isPregnancyLoading || classLoading || factorsLoading,
    error: pregnancyError || classError || factorsError,
    mutate: () => {
      classificationMutate();
      factorsMutate();
    },
  };
}

export default useObstetricRisk;
