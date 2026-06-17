import { validatePlainNumberInput } from '@openmrs/esm-utils';
import isNumber from 'lodash-es/isNumber';

import { type ConceptMetadata } from '../common';
import type { ObsReferenceRanges } from '../common/types';
import type { ConditionalBiometricFieldConfig } from '../config-schema';

/** Shared vitals workspace fields that callers can force show/hide for a specific workflow */
export type ConditionalFieldId = 'chestCircumference' | 'headCircumference' | 'glasgowComaScale';

export type VitalsBiometricsWorkspaceProfile = 'default' | 'emergency-triage';

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

export function getAgeInDays(birthDate: string | undefined, asOf: Date = new Date()): number | null {
  if (!birthDate) {
    return null;
  }
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) {
    return null;
  }
  return Math.floor((asOf.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24));
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

export function getMuacColorCode(age: number, muac: number, setColorCode: (color) => void) {
  switch (true) {
    // children 5 years and below with a muac equal to 14
    case age <= 5 && muac <= 11.5 && muac > 0:
      setColorCode('red');
      break;
    case age < 5 && muac > 11.5 && muac < 12.5:
      setColorCode('yellow');
      break;
    case age < 5 && muac > 12.5:
      setColorCode('green');
      break;
    // above 5 but less than 10
    case age > 5 && age < 10 && muac <= 13.5 && muac > 0:
      setColorCode('red');
      break;
    case age > 5 && age < 10 && muac > 13.5 && muac < 14.5:
      setColorCode('yellow');
      break;
    case age > 5 && age < 10 && muac > 14.5:
      setColorCode('green');
      break;
    //above 10 but less than 18
    case age > 10 && age < 18 && muac <= 16.5 && muac > 0:
      setColorCode('red');
      break;
    case age > 10 && age < 18 && muac > 16.5 && muac < 19.0:
      setColorCode('yellow');
      break;
    case age > 10 && age < 18 && muac > 19.0:
      setColorCode('green');
      break;
    // above 18
    case age > 18 && muac <= 19.5 && muac > 0:
      setColorCode('red');
      break;
    case age > 18 && muac > 19.5 && muac < 22.0:
      setColorCode('yellow');
      break;
    case age > 18 && muac > 22.0:
      setColorCode('green');
      break;
  }
}
