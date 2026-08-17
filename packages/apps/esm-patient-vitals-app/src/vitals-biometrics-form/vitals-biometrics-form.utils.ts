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
