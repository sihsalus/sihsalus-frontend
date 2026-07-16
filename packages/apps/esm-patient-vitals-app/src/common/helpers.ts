import dayjs from 'dayjs';

import { type ConceptMetadata } from '../common';
import { type BiometricsConfigObject } from '../config-schema';

import type { FHIRInterpretation, ObservationInterpretation, ObsReferenceRanges } from './types';

export function calculateBodyMassIndex(weight: number, height: number) {
  if (weight > 0 && height > 0) {
    return Number((weight / (height / 100) ** 2).toFixed(1));
  }
  return null;
}

export function assessValue(value: number | undefined, range?: ObsReferenceRanges): ObservationInterpretation {
  if (range && value != null) {
    // A value inside the normal range is never critical, even when the critical
    // threshold overlaps it (e.g. SpO2 with hiNormal = hiCritical = 100).
    const aboveNormal = range.hiNormal == null || value > range.hiNormal;
    const belowNormal = range.lowNormal == null || value < range.lowNormal;

    if (range.hiCritical != null && value >= range.hiCritical && aboveNormal) {
      return 'critically_high';
    }

    if (range.hiNormal != null && value > range.hiNormal) {
      return 'high';
    }

    if (range.lowCritical != null && value <= range.lowCritical && belowNormal) {
      return 'critically_low';
    }

    if (range.lowNormal != null && value < range.lowNormal) {
      return 'low';
    }
  }

  return 'normal';
}

export function interpretBloodPressure(
  systolic: number | undefined,
  diastolic: number | undefined,
  concepts: { systolicBloodPressureUuid?: string; diastolicBloodPressureUuid?: string } | undefined,
  conceptMetadata: Array<ConceptMetadata> | undefined,
  systolicInterpretation?: ObservationInterpretation,
  diastolicInterpretation?: ObservationInterpretation,
): ObservationInterpretation {
  if (!conceptMetadata) {
    return 'normal';
  }

  const systolicAssessment =
    systolicInterpretation ??
    assessValue(systolic, getReferenceRangesForConcept(concepts?.systolicBloodPressureUuid, conceptMetadata));

  const diastolicAssessment =
    diastolicInterpretation ??
    (concepts?.diastolicBloodPressureUuid
      ? assessValue(diastolic, getReferenceRangesForConcept(concepts.diastolicBloodPressureUuid, conceptMetadata))
      : 'normal');

  if (systolicAssessment === 'critically_high' || diastolicAssessment === 'critically_high') {
    return 'critically_high';
  }

  if (systolicAssessment === 'critically_low' || diastolicAssessment === 'critically_low') {
    return 'critically_low';
  }

  if (systolicAssessment === 'high' || diastolicAssessment === 'high') {
    return 'high';
  }

  if (systolicAssessment === 'low' || diastolicAssessment === 'low') {
    return 'low';
  }

  return 'normal';
}

export const getPatientAge = (patient: fhir.Patient): number | null => {
  if (!patient.birthDate) return null;
  const birthDate = dayjs(patient.birthDate);
  return birthDate.isValid() ? dayjs().diff(birthDate, 'years') : null;
};

export const shouldShowBmi = (patient: fhir.Patient | undefined, biometricsConfig: BiometricsConfigObject): boolean => {
  if (!patient) return true;
  const minAge = biometricsConfig.bmiMinimumAge ?? 0;
  if (minAge <= 0) return true;
  const patientAge = getPatientAge(patient);
  if (patientAge === null) return true;
  return patientAge >= minAge;
};

export function mapFhirInterpretationToObservationInterpretation(
  interpretation: FHIRInterpretation,
): ObservationInterpretation {
  const normalized = interpretation?.trim();
  switch (normalized) {
    case 'Critically Low':
      return 'critically_low';
    case 'Critically High':
      return 'critically_high';
    case 'High':
      return 'high';
    case 'Low':
      return 'low';
    default:
      return 'normal';
  }
}

export function generatePlaceholder(value: string) {
  switch (value) {
    case 'BMI':
      return '';

    case 'Temperature':
    case 'Weight':
      return '--.-';

    case 'Height':
    case 'diastolic':
    case 'systolic':
    case 'Pulse':
      return '---';

    default:
      return '--';
  }
}

export function getReferenceRangesForConcept(
  conceptUuid: string | undefined | null,
  conceptMetadata: Array<ConceptMetadata> | undefined,
): ConceptMetadata | undefined {
  if (!conceptUuid || !conceptMetadata?.length) {
    return undefined;
  }

  return conceptMetadata?.find((metadata) => metadata.uuid === conceptUuid);
}
