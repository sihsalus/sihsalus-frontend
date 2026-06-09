import dayjs, { type Dayjs } from 'dayjs';
import type { PatientProgram, Program } from '../types';

export interface ProgramEligibilityRule {
  label?: string;
  programUuid: string;
  minAgeYears?: number;
  maxAgeYears?: number;
  genders?: Array<string>;
}

export type PatientLike =
  | {
      birthDate?: string;
      birthdate?: string;
      gender?: string;
      age?: number;
      person?: {
        birthDate?: string;
        birthdate?: string;
        gender?: string;
        age?: number;
      };
    }
  | null
  | undefined;

function getPatientBirthDate(patient: PatientLike): string | undefined {
  return patient?.birthDate ?? patient?.birthdate ?? patient?.person?.birthDate ?? patient?.person?.birthdate;
}

function getPatientAgeFallback(patient: PatientLike): number | undefined {
  const age = patient?.age ?? patient?.person?.age;
  return typeof age === 'number' && Number.isFinite(age) ? age : undefined;
}

export function getPatientAgeYears(patient: PatientLike, today: Dayjs = dayjs()): number | undefined {
  const birthDate = getPatientBirthDate(patient);

  if (birthDate) {
    const parsedBirthDate = dayjs(birthDate);
    if (parsedBirthDate.isValid()) {
      return today.diff(parsedBirthDate, 'year');
    }
  }

  return getPatientAgeFallback(patient);
}

export function normalizePatientGender(gender: string | null | undefined): string | undefined {
  if (!gender) {
    return undefined;
  }

  const normalizedGender = gender.trim().toLowerCase();
  if (['f', 'female', 'femenino'].includes(normalizedGender)) {
    return 'female';
  }
  if (['m', 'male', 'masculino'].includes(normalizedGender)) {
    return 'male';
  }
  if (['o', 'other', 'otro'].includes(normalizedGender)) {
    return 'other';
  }
  if (['u', 'unknown', 'desconocido'].includes(normalizedGender)) {
    return 'unknown';
  }

  return normalizedGender;
}

function getPatientGender(patient: PatientLike): string | undefined {
  return normalizePatientGender(patient?.gender ?? patient?.person?.gender);
}

export function isProgramEligibleForPatient(
  program: Program,
  patient: PatientLike,
  rules: Array<ProgramEligibilityRule> = [],
  today: Dayjs = dayjs(),
): boolean {
  const rule = rules.find((candidate) => candidate.programUuid === program.uuid);
  if (!rule) {
    return true;
  }

  const hasAgeRule = typeof rule.minAgeYears === 'number' || typeof rule.maxAgeYears === 'number';
  if (hasAgeRule) {
    const ageYears = getPatientAgeYears(patient, today);
    if (ageYears === undefined) {
      return false;
    }
    if (typeof rule.minAgeYears === 'number' && ageYears < rule.minAgeYears) {
      return false;
    }
    if (typeof rule.maxAgeYears === 'number' && ageYears > rule.maxAgeYears) {
      return false;
    }
  }

  const allowedGenders = rule.genders?.map(normalizePatientGender).filter(Boolean);
  if (allowedGenders?.length) {
    const patientGender = getPatientGender(patient);
    return Boolean(patientGender && allowedGenders.includes(patientGender));
  }

  return true;
}

export function filterEligiblePrograms(
  programs: Array<Program> | null | undefined,
  enrollments: Array<PatientProgram> | null | undefined,
  patient: PatientLike,
  rules: Array<ProgramEligibilityRule> = [],
): Array<Program> {
  const activeEnrolledProgramUuids = new Set(
    (enrollments ?? [])
      .filter((enrollment) => !enrollment?.dateCompleted)
      .map((enrollment) => enrollment?.program?.uuid)
      .filter(Boolean),
  );

  return (programs ?? []).filter(
    (program) => !activeEnrolledProgramUuids.has(program.uuid) && isProgramEligibleForPatient(program, patient, rules),
  );
}
