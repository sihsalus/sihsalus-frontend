import { openmrsFetch, restBaseUrl, useConfig } from '@openmrs/esm-framework';
import { type ObsRecord, useMappedPatientObservations, useReferenceRanges } from '@openmrs/esm-patient-common-lib';
import { useCallback, useEffect, useMemo } from 'react';
import useSWRImmutable from 'swr/immutable';
import { type ConfigObject } from '../config-schema';
import { type VitalsBiometricsFormData } from '../vitals-biometrics-form/vitals-biometrics-form.workspace';

import { assessValue, calculateBodyMassIndex, getReferenceRangesForConcept, interpretBloodPressure } from './helpers';
import type { ObsReferenceRanges, PatientVitalsAndBiometrics } from './types';

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
  // Reason for `Render` string is to match the column header in the table
  return `${header}RenderInterpretation`;
}

function compactConceptUuids(conceptUuids: Array<string | null | undefined>) {
  return conceptUuids.filter(Boolean) as Array<string>;
}

export function useVitalsConceptMetadata() {
  const { concepts } = useConfig<ConfigObject>();
  const vitalSignsConceptSetUuid = concepts.vitalSignsConceptSetUuid;

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
    : new Map<string, string>([]);

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
    : new Map<string, { lowAbsolute: number | null; highAbsolute: number | null }>([]);

  const conceptRangeMap = useMemo(
    () => new Map<string, ConceptMetadata>(conceptMetadata?.map((c) => [c.uuid, c]) ?? []),
    [conceptMetadata],
  );

  return {
    data: conceptUnits,
    error,
    isLoading,
    conceptMetadata,
    conceptRanges,
    conceptRangeMap,
  };
}

export function useConceptUnits() {
  const { concepts } = useConfig<ConfigObject>();
  const vitalSignsConceptSetUuid = concepts.vitalSignsConceptSetUuid;
  const customRepresentation = 'custom:(setMembers:(uuid,display,units))';
  const apiUrl = `${restBaseUrl}/concept/${vitalSignsConceptSetUuid}?v=${customRepresentation}`;
  const { data, error, isLoading } = useSWRImmutable<{ data: VitalsConceptMetadataResponse }, Error>(
    apiUrl,
    openmrsFetch,
  );
  const conceptUnits = data?.data?.setMembers?.length
    ? new Map<string, string>(data.data.setMembers.map((c) => [c.uuid, c.units]))
    : new Map<string, string>();
  return { conceptUnits, error, isLoading };
}

export const withUnit = (label: string, unit: string | null | undefined) => {
  return `${label} ${unit ? `(${unit})` : ''}`;
};

// We need to track a bound mutator for basically every hook, because there does not appear to be
// a way to invalidate an SWRInfinite key that works other than using the bound mutator
// Each mutator is stored in the vitalsHooksMutates map and removed (via a useEffect hook) when the
// hook is unmounted.
let vitalsHooksCounter = 0;
const vitalsHooksMutates = new Map<number, () => void>();

function getPatientReferenceRange(
  conceptUuid: string | undefined | null,
  conceptMetadata: Array<ConceptMetadata> | undefined,
  patientReferenceRanges: Map<string, ObsReferenceRanges>,
): ObsReferenceRanges | undefined {
  if (!conceptUuid) {
    return undefined;
  }

  return patientReferenceRanges.get(conceptUuid) ?? getReferenceRangesForConcept(conceptUuid, conceptMetadata);
}

/**
 * Hook to get the vitals and / or biometrics for a patient
 *
 * @param patientUuid The uuid of the patient to get the vitals for
 * @param mode Either 'vitals', to load only vitals, 'biometrics', to load only biometrics or 'both' to load both
 * @returns An SWR-like structure that includes the cleaned-up vitals
 */
export function useVitalsAndBiometrics(patientUuid: string, mode: VitalsAndBiometricsMode = 'vitals') {
  const { conceptMetadata } = useVitalsConceptMetadata();
  const { concepts } = useConfig<ConfigObject>();
  const biometricsConcepts = useMemo(
    () => [
      concepts.heightUuid,
      concepts.midUpperArmCircumferenceUuid,
      concepts.abdominalCircumferenceUuid,
      concepts.headCircumferenceUuid,
      concepts.chestCircumferenceUuid,
      concepts.weightUuid,
    ],
    [
      concepts.abdominalCircumferenceUuid,
      concepts.chestCircumferenceUuid,
      concepts.headCircumferenceUuid,
      concepts.heightUuid,
      concepts.midUpperArmCircumferenceUuid,
      concepts.weightUuid,
    ],
  );
  const observationConcepts = useMemo(
    () => [
      concepts.systolicBloodPressureUuid,
      concepts.diastolicBloodPressureUuid,
      concepts.pulseUuid,
      concepts.temperatureUuid,
      concepts.oxygenSaturationUuid,
      concepts.heightUuid,
      concepts.weightUuid,
      concepts.respiratoryRateUuid,
      concepts.midUpperArmCircumferenceUuid,
      concepts.abdominalCircumferenceUuid,
      concepts.headCircumferenceUuid,
      concepts.chestCircumferenceUuid,
      concepts.glasgowEyeOpeningUuid,
      concepts.glasgowVerbalResponseUuid,
      concepts.glasgowMotorResponseUuid,
      concepts.glasgowTotalUuid,
      concepts.generalPatientNoteUuid,
    ],
    [
      concepts.abdominalCircumferenceUuid,
      concepts.chestCircumferenceUuid,
      concepts.diastolicBloodPressureUuid,
      concepts.glasgowEyeOpeningUuid,
      concepts.glasgowMotorResponseUuid,
      concepts.glasgowTotalUuid,
      concepts.glasgowVerbalResponseUuid,
      concepts.generalPatientNoteUuid,
      concepts.headCircumferenceUuid,
      concepts.heightUuid,
      concepts.midUpperArmCircumferenceUuid,
      concepts.oxygenSaturationUuid,
      concepts.pulseUuid,
      concepts.respiratoryRateUuid,
      concepts.systolicBloodPressureUuid,
      concepts.temperatureUuid,
      concepts.weightUuid,
    ],
  );
  const observationConceptUuidList = useMemo(
    () =>
      compactConceptUuids(
        mode === 'both'
          ? observationConcepts
          : observationConcepts.filter(
              (uuid) =>
                (mode === 'vitals' && !biometricsConcepts.includes(uuid)) ||
                (mode === 'biometrics' && biometricsConcepts.includes(uuid)),
            ),
      ),
    [observationConcepts, biometricsConcepts, mode],
  );
  const referenceRangeConceptUuidList = useMemo(
    () =>
      observationConceptUuidList.filter(
        (uuid) =>
          uuid !== concepts.generalPatientNoteUuid &&
          uuid !== concepts.glasgowEyeOpeningUuid &&
          uuid !== concepts.glasgowVerbalResponseUuid &&
          uuid !== concepts.glasgowMotorResponseUuid,
      ),
    [
      concepts.generalPatientNoteUuid,
      concepts.glasgowEyeOpeningUuid,
      concepts.glasgowMotorResponseUuid,
      concepts.glasgowVerbalResponseUuid,
      observationConceptUuidList,
    ],
  );
  const { ranges: patientReferenceRanges } = useReferenceRanges(patientUuid, referenceRangeConceptUuidList);

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
        case concepts.midUpperArmCircumferenceUuid:
          return 'muac';
        case concepts.abdominalCircumferenceUuid:
          return 'abdominalCircumference';
        case concepts.headCircumferenceUuid:
          return 'headCircumference';
        case concepts.chestCircumferenceUuid:
          return 'chestCircumference';
        case concepts.glasgowEyeOpeningUuid:
          return 'glasgowEyeOpening';
        case concepts.glasgowVerbalResponseUuid:
          return 'glasgowVerbalResponse';
        case concepts.glasgowMotorResponseUuid:
          return 'glasgowMotorResponse';
        case concepts.glasgowTotalUuid:
          return 'glasgowTotal';
        default:
          return undefined;
      }
    },
    [
      concepts.abdominalCircumferenceUuid,
      concepts.chestCircumferenceUuid,
      concepts.headCircumferenceUuid,
      concepts.heightUuid,
      concepts.glasgowEyeOpeningUuid,
      concepts.glasgowMotorResponseUuid,
      concepts.glasgowTotalUuid,
      concepts.glasgowVerbalResponseUuid,
      concepts.midUpperArmCircumferenceUuid,
      concepts.systolicBloodPressureUuid,
      concepts.oxygenSaturationUuid,
      concepts.diastolicBloodPressureUuid,
      concepts.pulseUuid,
      concepts.respiratoryRateUuid,
      concepts.temperatureUuid,
      concepts.weightUuid,
    ],
  );

  const observationResult = useMappedPatientObservations<PatientVitalsAndBiometrics>({
    conceptUuids: observationConceptUuidList,
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
          result.systolicRenderInterpretation,
          result.diastolicRenderInterpretation,
        );
      }

      return result;
    },
    getObservationFields: ({ code, key, value }) => {
      const numericValue = typeof value === 'number' ? value : undefined;
      const interpretation = assessValue(
        numericValue,
        getPatientReferenceRange(code, conceptMetadata, patientReferenceRanges),
      );
      return {
        [key]: value,
        [getInterpretationKey(key)]: interpretation,
      } as Partial<PatientVitalsAndBiometrics>;
    },
    getObservationKey: getVitalsMapKey,
    patientUuid,
  });

  useEffect(() => {
    const index = ++vitalsHooksCounter;
    vitalsHooksMutates.set(index, () => {
      void observationResult.mutate();
    });
    return () => {
      vitalsHooksMutates.delete(index);
    };
  }, [observationResult.mutate]);

  return observationResult;
}

export function saveVitalsAndBiometrics(
  encounterTypeUuid: string,
  concepts: ConfigObject['concepts'],
  patientUuid: string,
  vitals: VitalsBiometricsFormData,
  abortController: AbortController,
  location: string,
  visitUuid?: string,
) {
  return openmrsFetch<unknown>(`${restBaseUrl}/encounter`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    signal: abortController.signal,
    body: {
      patient: patientUuid,
      location: location,
      encounterType: encounterTypeUuid,
      ...(visitUuid ? { visit: visitUuid } : {}),
      obs: createObsObject(vitals, concepts),
    },
  });
}

export function updateVitalsAndBiometrics(
  concepts: ConfigObject['concepts'],
  patientUuid: string,
  vitals: VitalsBiometricsFormData,
  encounterDatetime: Date,
  abortController: AbortController,
  encounterUuid: string,
  location: string,
) {
  return openmrsFetch(`${restBaseUrl}/encounter/${encounterUuid}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    signal: abortController.signal,
    body: {
      encounterDatetime: encounterDatetime,
      location: location,
      patient: patientUuid,
      obs: createObsObject(vitals, concepts),
      orders: [],
    },
  });
}

function createObsObject(
  vitals: VitalsBiometricsFormData,
  concepts: ConfigObject['concepts'],
): Array<Omit<ObsRecord, 'effectiveDateTime' | 'conceptClass' | 'encounter'>> {
  return Object.entries(vitals)
    .filter(([_, result]) => result != null && result !== '')
    .map(([name, result]) => {
      return {
        concept: concepts[name + 'Uuid'],
        value: result,
      };
    });
}

/**
 * Invalidate all useVitalsAndBiometrics hooks data, to force them to reload
 */
export async function invalidateCachedVitalsAndBiometrics() {
  vitalsHooksMutates.forEach((mutate) => {
    mutate();
  });
}
