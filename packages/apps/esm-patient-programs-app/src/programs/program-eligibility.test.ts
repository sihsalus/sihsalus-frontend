import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';
import type { PatientProgram, Program } from '../types';
import {
  filterEligiblePrograms,
  getPatientAgeYears,
  isProgramEligibleForPatient,
  normalizePatientGender,
  type ProgramEligibilityRule,
} from './program-eligibility';

const today = dayjs('2026-06-09');

const createProgram = (uuid: string, display: string): Program => ({
  uuid,
  display,
  name: display,
  allWorkflows: [],
  concept: {
    uuid: `${uuid}-concept`,
    display,
  },
});

const adultProgram = createProgram('adulto-mayor-program', 'Adulto Mayor');
const tuberculosisProgram = createProgram('tbc-program', 'Tuberculosis');
const maternalProgram = createProgram('maternal-program', 'Madre Gestante');

const rules: Array<ProgramEligibilityRule> = [
  {
    programUuid: tuberculosisProgram.uuid,
  },
  {
    programUuid: adultProgram.uuid,
    minAgeYears: 60,
  },
  {
    programUuid: maternalProgram.uuid,
    minAgeYears: 10,
    maxAgeYears: 59,
    genders: ['female'],
  },
];

describe('program eligibility', () => {
  it('calculates age from FHIR and OpenMRS REST patient shapes', () => {
    expect(getPatientAgeYears({ birthDate: '1960-06-08' }, today)).toBe(66);
    expect(getPatientAgeYears({ person: { birthdate: '1960-06-10T00:00:00.000+0000' } }, today)).toBe(65);
    expect(getPatientAgeYears({ age: 35 }, today)).toBe(35);
  });

  it('normalizes FHIR and OpenMRS gender values', () => {
    expect(normalizePatientGender('F')).toBe('female');
    expect(normalizePatientGender('female')).toBe('female');
    expect(normalizePatientGender('M')).toBe('male');
    expect(normalizePatientGender('male')).toBe('male');
  });

  it('keeps programs without restrictive rules visible for every patient', () => {
    expect(
      isProgramEligibleForPatient(tuberculosisProgram, { birthDate: '2020-01-01', gender: 'male' }, rules, today),
    ).toBe(true);
  });

  it('hides Adulto Mayor until the patient is at least 60 years old', () => {
    expect(isProgramEligibleForPatient(adultProgram, { birthDate: '1970-01-01' }, rules, today)).toBe(false);
    expect(isProgramEligibleForPatient(adultProgram, { birthDate: '1966-06-09' }, rules, today)).toBe(true);
  });

  it('applies combined age and gender rules', () => {
    expect(
      isProgramEligibleForPatient(maternalProgram, { birthDate: '1995-01-01', gender: 'female' }, rules, today),
    ).toBe(true);
    expect(
      isProgramEligibleForPatient(maternalProgram, { birthDate: '1995-01-01', gender: 'male' }, rules, today),
    ).toBe(false);
    expect(
      isProgramEligibleForPatient(maternalProgram, { birthDate: '1960-01-01', gender: 'female' }, rules, today),
    ).toBe(false);
  });

  it('filters out already-enrolled and demographically ineligible programs', () => {
    const enrollments = [
      {
        program: tuberculosisProgram,
      },
    ] as Array<PatientProgram>;

    expect(
      filterEligiblePrograms(
        [tuberculosisProgram, adultProgram, maternalProgram],
        enrollments,
        { birthDate: '1995-01-01', gender: 'female' },
        rules,
      ).map((program) => program.display),
    ).toEqual(['Madre Gestante']);
  });

  it('keeps programs eligible when the previous enrollment is completed', () => {
    const enrollments = [
      {
        program: tuberculosisProgram,
        dateCompleted: '2026-01-01',
      },
    ] as Array<PatientProgram>;

    expect(
      filterEligiblePrograms(
        [tuberculosisProgram, adultProgram],
        enrollments,
        { birthDate: '1995-01-01', gender: 'male' },
        rules,
      ).map((program) => program.display),
    ).toEqual(['Tuberculosis']);
  });
});
