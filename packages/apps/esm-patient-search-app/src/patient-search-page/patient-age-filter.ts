import {
  calculatePatientAge,
  calculatePatientAgeInMonths,
  getLocalCalendarDate,
  parsePatientBirthdate,
} from '@openmrs/esm-utils';

import type { PatientAgeUnit, SearchedPatient } from '../types';

export const MAX_PATIENT_AGE_DAYS = 27;
export const MAX_PATIENT_AGE_MONTHS = 23;

export function getPatientAgeForUnit(
  birthdateValue: string | undefined,
  unit: PatientAgeUnit,
  referenceDate = getLocalCalendarDate(),
) {
  if (!birthdateValue) {
    return null;
  }

  const birthdate = parsePatientBirthdate(birthdateValue);
  if (!birthdate) {
    return null;
  }

  if (unit === 'years') {
    return calculatePatientAge(birthdate, referenceDate);
  }

  if (unit === 'months') {
    return calculatePatientAgeInMonths(birthdate, referenceDate);
  }

  const birthdateUtc = Date.UTC(birthdate.year, birthdate.month - 1, birthdate.day);
  const referenceDateUtc = Date.UTC(referenceDate.year, referenceDate.month - 1, referenceDate.day);
  const elapsedDays = Math.floor((referenceDateUtc - birthdateUtc) / 86_400_000);

  return elapsedDays >= 0 ? elapsedDays : null;
}

export function matchesPatientAge(
  patient: SearchedPatient,
  expectedAge: number,
  unit: PatientAgeUnit,
  referenceDate = getLocalCalendarDate(),
) {
  const calculatedAge = getPatientAgeForUnit(patient.person.birthdate, unit, referenceDate);

  if (calculatedAge != null) {
    return calculatedAge === expectedAge;
  }

  return unit === 'years' && Number(patient.person.age) === expectedAge;
}
