import { validatePlainNumberInput } from '@openmrs/esm-utils';
import isNumber from 'lodash-es/isNumber';

import { type ConceptMetadata } from '../common';
import type { ObsReferenceRanges } from '../common/types';
import type { ConditionalBiometricFieldConfig } from '../config-schema';

/** Shared vitals workspace fields that callers can force show/hide for a specific workflow */
export type ConditionalFieldId = 'chestCircumference' | 'headCircumference' | 'glasgowComaScale';

export type VitalsBiometricsWorkspaceProfile = 'default' | 'emergency-triage';

export const MUAC_MIN_CM = 6;
export const MUAC_MAX_CM = 26;
export const MUAC_MAX_AGE_MONTHS = 59;

// WHO 2006 weight-for-age +3 SD reference (kg), indexed by completed month
// from birth through 59 months. This is a temporary data-quality warning for
// obviously extreme entries; it is not an overweight/obesity diagnosis.
// Source: https://www.who.int/toolkits/child-growth-standards/standards/weight-for-age
const WHO_WEIGHT_FOR_AGE_PLUS_3_SD_KG = {
  male: [
    5.0, 6.6, 8.0, 9.0, 9.7, 10.4, 10.9, 11.4, 11.9, 12.3, 12.7, 13.0, 13.3, 13.7, 14.0, 14.3, 14.6, 14.9, 15.3, 15.6,
    15.9, 16.2, 16.5, 16.8, 17.1, 17.5, 17.8, 18.1, 18.4, 18.7, 19.0, 19.3, 19.6, 19.9, 20.2, 20.4, 20.7, 21.0, 21.3,
    21.6, 21.9, 22.1, 22.4, 22.7, 23.0, 23.3, 23.6, 23.9, 24.2, 24.5, 24.8, 25.1, 25.4, 25.7, 26.0, 26.3, 26.6, 26.9,
    27.2, 27.6,
  ],
  female: [
    4.8, 6.2, 7.5, 8.5, 9.3, 10.0, 10.6, 11.1, 11.6, 12.0, 12.4, 12.8, 13.1, 13.5, 13.8, 14.1, 14.5, 14.8, 15.1, 15.4,
    15.7, 16.0, 16.4, 16.7, 17.0, 17.3, 17.7, 18.0, 18.3, 18.7, 19.0, 19.3, 19.6, 20.0, 20.3, 20.6, 20.9, 21.3, 21.6,
    22.0, 22.3, 22.7, 23.0, 23.4, 23.7, 24.1, 24.5, 24.8, 25.2, 25.5, 25.9, 26.3, 26.6, 27.0, 27.4, 27.7, 28.1, 28.5,
    28.8, 29.2,
  ],
} as const;

export interface ConditionalFieldOverrides {
  /** Force-show these fields regardless of age rules (e.g. CRED launching for a newborn) */
  showFields?: Array<ConditionalFieldId>;
  /** Force-hide these fields regardless of age rules (takes precedence over showFields) */
  hideFields?: Array<ConditionalFieldId>;
}

interface ClinicalNumberInputConstraints {
  integer?: boolean;
  max?: number | null;
  min?: number | null;
}

export interface ClinicalNumberInputValidation {
  isInvalid: boolean;
  isInvalidFormat: boolean;
  isOutOfRange: boolean;
  parsedValue: number | undefined;
}

export function validateClinicalNumberInput(
  value: string | number,
  constraints: ClinicalNumberInputConstraints = {},
): ClinicalNumberInputValidation {
  return validatePlainNumberInput(value, { ...constraints, nonNegative: true });
}

export function mergeReferenceRanges(
  fallbackRange: ObsReferenceRanges | undefined,
  patientRange: ObsReferenceRanges | undefined,
): ObsReferenceRanges | undefined {
  if (!patientRange) {
    return fallbackRange;
  }

  if (!fallbackRange) {
    return patientRange;
  }

  return {
    hiAbsolute: patientRange.hiAbsolute ?? fallbackRange.hiAbsolute,
    hiCritical: patientRange.hiCritical ?? fallbackRange.hiCritical,
    hiNormal: patientRange.hiNormal ?? fallbackRange.hiNormal,
    lowAbsolute: patientRange.lowAbsolute ?? fallbackRange.lowAbsolute,
    lowCritical: patientRange.lowCritical ?? fallbackRange.lowCritical,
    lowNormal: patientRange.lowNormal ?? fallbackRange.lowNormal,
  };
}

export function getAgeInDays(birthDate: string | undefined, asOf: Date = new Date()): number | null {
  if (!birthDate) {
    return null;
  }
  const parsed = new Date(birthDate);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  // Date-only strings parse as UTC midnight but `asOf` is local time, so day boundaries
  // would shift (5h early in UTC-5); rebuild those dates from their UTC parts as local dates
  const isDateOnly = /^\d{4}(-\d{2}){0,2}$/.test(birthDate.trim());
  const birth = isDateOnly ? new Date(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()) : parsed;
  return Math.floor((asOf.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24));
}

export function getAgeInCompletedMonths(birthDate: string | undefined, asOf: Date = new Date()): number | null {
  if (!birthDate) {
    return null;
  }
  const parsed = new Date(birthDate);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  const isDateOnly = /^\d{4}(-\d{2}){0,2}$/.test(birthDate.trim());
  const birth = isDateOnly ? new Date(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()) : parsed;
  let months = (asOf.getFullYear() - birth.getFullYear()) * 12 + asOf.getMonth() - birth.getMonth();
  if (asOf.getDate() < birth.getDate()) {
    months -= 1;
  }
  return months;
}

/** MINSA MUAC screening applies from birth through 59 completed months. */
export function isMuacApplicableAge(birthDate: string | undefined, asOf: Date = new Date()): boolean {
  const ageInMonths = getAgeInCompletedMonths(birthDate, asOf);
  return ageInMonths != null && ageInMonths >= 0 && ageInMonths <= MUAC_MAX_AGE_MONTHS;
}

/**
 * Flags a weight above the WHO weight-for-age +3 SD reference for children
 * under five. Unknown sex uses the higher reference to avoid false positives.
 * The result is only a measurement-review warning; weight-for-age alone must
 * not be used to diagnose pediatric overweight or obesity.
 */
export function isPediatricWeightAboveWhoReference(
  weight: number | undefined,
  ageInMonths: number | null,
  gender: string | undefined,
): boolean {
  if (
    weight == null ||
    !Number.isFinite(weight) ||
    ageInMonths == null ||
    !Number.isInteger(ageInMonths) ||
    ageInMonths < 0 ||
    ageInMonths > MUAC_MAX_AGE_MONTHS
  ) {
    return false;
  }

  const normalizedGender = gender?.trim().toLowerCase();
  const maleReference = WHO_WEIGHT_FOR_AGE_PLUS_3_SD_KG.male[ageInMonths];
  const femaleReference = WHO_WEIGHT_FOR_AGE_PLUS_3_SD_KG.female[ageInMonths];
  const reference =
    normalizedGender === 'male' || normalizedGender === 'm'
      ? maleReference
      : normalizedGender === 'female' || normalizedGender === 'f'
        ? femaleReference
        : Math.max(maleReference, femaleReference);

  return weight > reference;
}

export function isConditionalFieldVisible(
  field: ConditionalFieldId,
  rule: ConditionalBiometricFieldConfig,
  ageInDays: number | null,
  overrides?: ConditionalFieldOverrides,
): boolean {
  if (overrides?.hideFields?.includes(field)) {
    return false;
  }
  if (overrides?.showFields?.includes(field)) {
    return true;
  }
  if (!rule.enabled) {
    return false;
  }
  // Without a birth date there is no way to apply the age rule; hide pediatric fields
  if (ageInDays == null) {
    return false;
  }
  return ageInDays >= rule.minAgeDays && ageInDays <= rule.maxAgeDays;
}

export function calculateBodyMassIndex(weight: number, height: number): number | undefined {
  if (!weight || !height) return undefined;

  if (weight > 0 && height > 0) {
    return Number((weight / (height / 100) ** 2).toFixed(1));
  }

  return undefined;
}

export function calculateGlasgowComaScaleTotal(
  eyeOpening: number | undefined,
  verbalResponse: number | undefined,
  motorResponse: number | undefined,
): number | undefined {
  if (eyeOpening == null || verbalResponse == null || motorResponse == null) {
    return undefined;
  }

  return eyeOpening + verbalResponse + motorResponse;
}

export function isValueWithinReferenceRange(
  conceptMetadata: Array<ConceptMetadata> | undefined,
  conceptUuid: string,
  value: string | number,
  referenceRange?: ObsReferenceRanges,
) {
  const concept = referenceRange ?? conceptMetadata?.find((c) => c.uuid === conceptUuid);

  if (value === undefined || value === '' || concept === undefined) {
    return true;
  }

  return isNumber(concept?.lowAbsolute) && isNumber(concept?.hiAbsolute)
    ? Number(value) >= Number(concept.lowAbsolute) && Number(value) <= Number(concept.hiAbsolute)
    : true;
}

// Convert age into an integer (whole number)
export function extractNumbers(str: string) {
  const regex = /\d+/g;
  const match = str.match(regex);
  if (!match) {
    return null;
  }
  return parseInt(match[0], 10);
}

export function getMuacColorCode(ageInMonths: number, muac: number, setColorCode: (color: string) => void) {
  switch (true) {
    case ageInMonths < 0 || ageInMonths > MUAC_MAX_AGE_MONTHS || muac <= 0:
      setColorCode('');
      break;
    case muac <= 11.5:
      setColorCode('red');
      break;
    case muac < 12.5:
      setColorCode('yellow');
      break;
    default:
      setColorCode('green');
      break;
  }
}
