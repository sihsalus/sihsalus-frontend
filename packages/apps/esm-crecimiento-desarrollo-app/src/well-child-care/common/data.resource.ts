import { openmrsFetch, restBaseUrl, useConfig } from '@openmrs/esm-framework';
import { type PatientObservationRecord, useMappedPatientObservations } from '@openmrs/esm-patient-common-lib';
import { useCallback, useMemo } from 'react';
import useSWRImmutable from 'swr/immutable';

import type { ConfigObject } from '../../config-schema';

import { assessValue, calculateBodyMassIndex, getReferenceRangesForConcept, interpretBloodPressure } from './helpers';
import type { PatientVitalsAndBiometrics } from './types';

type VitalsAndBiometricsMode = 'vitals' | 'biometrics' | 'both';

export interface ConceptMetadata {
  uuid: string;
  display: string;
  hiNormal: number | null;
  hiAbsolute: number | null;
  hiCritical: number | null;
  lowNormal: number | null;
  lowAbsolute: number | null;
  lowCritical: number | null;
  units: string | null;
}

interface VitalsConceptMetadataResponse {
  setMembers: Array<ConceptMetadata>;
}

function getInterpretationKey(header: string) {
  return `${header}RenderInterpretation`;
}

function compactConceptUuids(conceptUuids: Array<string | null | undefined>) {
  return conceptUuids.filter(Boolean);
}

export function useVitalsConceptMetadata() {
  const { concepts } = useConfig<ConfigObject>();
  const vitalSignsConceptSetUuid = concepts.newbornVitalSignsConceptSetUuid;
  const customRepresentation =
    'custom:(setMembers:(uuid,display,hiNormal,hiAbsolute,hiCritical,lowNormal,lowAbsolute,lowCritical,units))';
  const apiUrl = `${restBaseUrl}/concept/${vitalSignsConceptSetUuid}?v=${customRepresentation}`;
  const { data, error, isLoading } = useSWRImmutable<{ data: VitalsConceptMetadataResponse }, Error>(
    apiUrl,
    openmrsFetch,
  );

  const conceptMetadata = data?.data?.setMembers;
  const conceptUnits = conceptMetadata?.length
    ? new Map<string, string>(conceptMetadata.map((concept) => [concept.uuid, concept.units]))
    : new Map<string, string>();
  const conceptRanges = conceptMetadata?.length
    ? new Map<string, { lowAbsolute: number | null; highAbsolute: number | null }>(
        conceptMetadata.map((concept) => [
          concept.uuid,
          {
            lowAbsolute: concept.lowAbsolute ?? null,
            highAbsolute: concept.hiAbsolute ?? null,
          },
        ]),
      )
    : new Map<string, { lowAbsolute: number | null; highAbsolute: number | null }>();

  return {
    data: conceptUnits,
    error,
    isLoading,
    conceptMetadata,
    conceptRanges,
  };
}

export const withUnit = (label: string, unit: string | null | undefined) => {
  return `${label} ${unit ? `(${unit})` : ''}`;
};

export function useVitalsAndBiometrics(patientUuid: string, mode: VitalsAndBiometricsMode = 'vitals') {
  const { conceptMetadata } = useVitalsConceptMetadata();
  const { concepts } = useConfig<ConfigObject>();

  const biometricsConcepts = useMemo(
    () =>
      compactConceptUuids([
        concepts.heightUuid,
        concepts.headCircumferenceUuid,
        concepts.chestCircumferenceUuid,
        concepts.weightUuid,
      ]),
    [concepts.heightUuid, concepts.headCircumferenceUuid, concepts.chestCircumferenceUuid, concepts.weightUuid],
  );

  const vitalsConcepts = useMemo(
    () =>
      compactConceptUuids([
        concepts.systolicBloodPressureUuid,
        concepts.diastolicBloodPressureUuid,
        concepts.pulseUuid,
        concepts.temperatureUuid,
        concepts.oxygenSaturationUuid,
        concepts.respiratoryRateUuid,
      ]),
    [
      concepts.diastolicBloodPressureUuid,
      concepts.oxygenSaturationUuid,
      concepts.pulseUuid,
      concepts.respiratoryRateUuid,
      concepts.systolicBloodPressureUuid,
      concepts.temperatureUuid,
    ],
  );

  const conceptUuids = useMemo(() => {
    if (mode === 'biometrics') {
      return biometricsConcepts;
    }
    if (mode === 'vitals') {
      return vitalsConcepts;
    }
    return [...vitalsConcepts, ...biometricsConcepts];
  }, [biometricsConcepts, mode, vitalsConcepts]);

  const getVitalsMapKey = useCallback(
    (conceptUuid: string): string | undefined => {
      switch (conceptUuid) {
        case concepts.systolicBloodPressureUuid:
          return 'systolic';
        case concepts.diastolicBloodPressureUuid:
          return 'diastolic';
        case concepts.pulseUuid:
          return 'pulse';
        case concepts.temperatureUuid:
          return 'temperature';
        case concepts.oxygenSaturationUuid:
          return 'spo2';
        case concepts.respiratoryRateUuid:
          return 'respiratoryRate';
        case concepts.heightUuid:
          return 'height';
        case concepts.weightUuid:
          return 'weight';
        case concepts.headCircumferenceUuid:
          return 'headCircumference';
        case concepts.chestCircumferenceUuid:
          return 'chestCircumference';
        default:
          return undefined;
      }
    },
    [
      concepts.chestCircumferenceUuid,
      concepts.diastolicBloodPressureUuid,
      concepts.headCircumferenceUuid,
      concepts.heightUuid,
      concepts.oxygenSaturationUuid,
      concepts.pulseUuid,
      concepts.respiratoryRateUuid,
      concepts.systolicBloodPressureUuid,
      concepts.temperatureUuid,
      concepts.weightUuid,
    ],
  );

  return useMappedPatientObservations<PatientVitalsAndBiometrics>({
    conceptUuids,
    finalizeRow: (row) => {
      const result = { ...row };

      if (mode === 'both' || mode === 'biometrics') {
        result.bmi = calculateBodyMassIndex(Number(result.weight), Number(result.height));
      }

      if (mode === 'both' || mode === 'vitals') {
        result.bloodPressureRenderInterpretation = interpretBloodPressure(
          result.systolic,
          result.diastolic,
          concepts,
          conceptMetadata,
        );
      }

      return result;
    },
    getObservationFields: ({ code, key, value }) => ({
      [key]: value,
      [getInterpretationKey(key)]: assessValue(value, getReferenceRangesForConcept(code, conceptMetadata)),
    }),
    getObservationKey: getVitalsMapKey,
    patientUuid,
  });
}

export function useBalance(patientUuid: string) {
  const { concepts } = useConfig<ConfigObject>();
  const balanceConcepts = useMemo(
    () =>
      compactConceptUuids([
        concepts.stoolCountUuid,
        concepts.stoolGramsUuid,
        concepts.urineCountUuid,
        concepts.urineGramsUuid,
        concepts.vomitCountUuid,
        concepts.vomitGramsMLUuid,
      ]),
    [
      concepts.stoolCountUuid,
      concepts.stoolGramsUuid,
      concepts.urineCountUuid,
      concepts.urineGramsUuid,
      concepts.vomitCountUuid,
      concepts.vomitGramsMLUuid,
    ],
  );

  const getBalanceMapKey = useCallback(
    (conceptUuid: string): string | undefined => {
      switch (conceptUuid) {
        case concepts.stoolCountUuid:
          return 'stoolCount';
        case concepts.stoolGramsUuid:
          return 'stoolGrams';
        case concepts.urineCountUuid:
          return 'urineCount';
        case concepts.urineGramsUuid:
          return 'urineGrams';
        case concepts.vomitCountUuid:
          return 'vomitCount';
        case concepts.vomitGramsMLUuid:
          return 'vomitGramsML';
        default:
          return undefined;
      }
    },
    [
      concepts.stoolCountUuid,
      concepts.stoolGramsUuid,
      concepts.urineCountUuid,
      concepts.urineGramsUuid,
      concepts.vomitCountUuid,
      concepts.vomitGramsMLUuid,
    ],
  );

  return useMappedPatientObservations<PatientVitalsAndBiometrics>({
    conceptUuids: balanceConcepts,
    getObservationFields: ({ key, value }: PatientObservationRecord) => ({ [key]: value }),
    getObservationKey: getBalanceMapKey,
    patientUuid,
  });
}
