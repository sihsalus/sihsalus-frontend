// utils/age-group-utils.ts

import dayjs from 'dayjs';

export interface AgeGroup {
  label: string;
  sublabel?: string;
  minDays?: number;
  maxDays?: number;
  minMonths?: number;
  maxMonths?: number;
  forms?: string[];
}

/**
 * Calcula la edad en días desde una fecha de nacimiento
 */
export function calculateAgeInDays(birthDate: string | Date, referenceDate: string | Date = new Date()): number {
  const birth = dayjs(birthDate);
  const now = dayjs(referenceDate);
  return now.diff(birth, 'day');
}

/**
 * Calcula la edad en meses desde una fecha de nacimiento
 */
export function calculateAgeInMonths(birthDate: string | Date, referenceDate: string | Date = new Date()): number {
  const birth = dayjs(birthDate);
  const now = dayjs(referenceDate);
  return now.diff(birth, 'month', true); // permite fracciones
}

/**
 * Devuelve el grupo etario que corresponde a una edad en meses usando la configuración proporcionada
 */
export function getAgeGroup(ageInMonths: number, ageGroups: AgeGroup[]): AgeGroup | null {
  return (
    ageGroups.find((group) => {
      const minMonths = group.minMonths ?? 0;
      const maxMonths = group.maxMonths ?? Infinity;
      return ageInMonths >= minMonths && ageInMonths < maxMonths;
    }) || null
  );
}

/**
 * Devuelve el grupo etario que corresponde a una fecha de nacimiento usando la configuración proporcionada
 */
export function getAgeGroupFromBirthDate(
  birthDate: string | Date,
  ageGroups: AgeGroup[],
  referenceDate: string | Date = new Date(),
): AgeGroup | null {
  const months = calculateAgeInMonths(birthDate, referenceDate);
  return getAgeGroup(months, ageGroups);
}

/**
 * Resolves mixed day- and month-based CRED age groups for a specific date.
 */
export function getConfiguredAgeGroupFromBirthDate(
  birthDate: string | Date,
  ageGroups: AgeGroup[],
  referenceDate: string | Date = new Date(),
): AgeGroup | null {
  const ageInDays = calculateAgeInDays(birthDate, referenceDate);
  const dayGroup = getAgeGroupInDays(ageInDays, ageGroups);
  if (dayGroup) return dayGroup;

  const ageInMonths = calculateAgeInMonths(birthDate, referenceDate);
  const monthGroup = getAgeGroup(
    ageInMonths,
    ageGroups.filter((group) => group.minMonths !== undefined && group.maxMonths !== undefined),
  );

  if (monthGroup) return monthGroup;

  return ageInDays >= 360 && ageInMonths < 12
    ? (ageGroups.find((group) => group.minDays === 270 && group.maxDays === 359) ?? null)
    : null;
}

/**
 * Devuelve el grupo etario en días usando la configuración proporcionada
 */
export function getAgeGroupInDays(ageInDays: number, ageGroups: AgeGroup[]): AgeGroup | null {
  return (
    ageGroups.find((group) => {
      if (group.minDays !== undefined && group.maxDays !== undefined) {
        return ageInDays >= group.minDays && ageInDays <= group.maxDays;
      }
      return false;
    }) || null
  );
}
