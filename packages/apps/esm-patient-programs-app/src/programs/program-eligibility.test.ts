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
const wellChildProgram = createProgram('well-child-program', 'Control de Niño Sano');

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
  {
    programUuid: wellChildProgram.uuid,
    maxAgeYears: 11,
  },
];

describe('program eligibility', () => {
  it('calculates age from FHIR and OpenMRS REST patient shapes', () => {
    expect(getPatientAgeYears({ birthDate: '1960-06-08' }, today)).toBe(66);
    expect(getPatientAgeYears({ person: { birthdate: '1960-06-10T00:00:00.000+0000' } }, today)).toBe(65);
    expect(getPatientAgeYears({ age: 35 }, today)).toBe(35);
  });

  it.each(['2026-06-10', '2026-12-09', '2027-06-09'])(
    'rejects a future birth date %s without using the age fallback',
    (birthDate) => {
      const patient = { birthDate, age: 0 };
      expect(getPatientAgeYears(patient, today)).toBeUndefined();
      expect(isProgramEligibleForPatient(wellChildProgram, patient, rules, today)).toBe(false);
    },
  );

  it('rejects a future OpenMRS birth date without using its age fallback', () => {
    const patient = { person: { birthdate: '2026-06-10', age: 0 } };
    expect(getPatientAgeYears(patient, today)).toBeUndefined();
    expect(isProgramEligibleForPatient(wellChildProgram, patient, rules, today)).toBe(false);
  });

  it('accepts birth on the reference day even when its time is later', () => {
    const patient = { birthDate: '2026-06-09T23:59:59' };
    expect(getPatientAgeYears(patient, today)).toBe(0);
    expect(isProgramEligibleForPatient(wellChildProgram, patient, rules, today)).toBe(true);
  });

  it.each([{ age: -1 }, { person: { age: -0.5 } }])('rejects a negative age fallback %j', (patient) => {
    expect(getPatientAgeYears(patient, today)).toBeUndefined();
    expect(isProgramEligibleForPatient(wellChildProgram, patient, rules, today)).toBe(false);
  });

  it('retains the non-negative age fallback when the birth date is invalid', () => {
    expect(getPatientAgeYears({ birthDate: 'invalid-date', age: 11 }, today)).toBe(11);
    expect(isProgramEligibleForPatient(wellChildProgram, { birthDate: 'invalid-date', age: 11 }, rules, today)).toBe(
      true,
    );
    expect(getPatientAgeYears({ birthDate: 'invalid-date', age: -1 }, today)).toBeUndefined();
  });

  it('keeps unrestricted programs visible when the age is invalid', () => {
    const patient = { birthDate: '2026-06-10', age: -1 };
    expect(isProgramEligibleForPatient(tuberculosisProgram, patient, rules, today)).toBe(true);
    expect(
      isProgramEligibleForPatient(createProgram('unconfigured-program', 'Unconfigured'), patient, rules, today),
    ).toBe(true);
  });

  it('retains pediatric eligibility through age eleven and excludes the twelfth birthday', () => {
    expect(isProgramEligibleForPatient(wellChildProgram, { birthDate: '2014-06-11' }, rules, today)).toBe(true);
    expect(isProgramEligibleForPatient(wellChildProgram, { birthDate: '2014-06-10' }, rules, today)).toBe(true);
    expect(isProgramEligibleForPatient(wellChildProgram, { birthDate: '2014-06-09' }, rules, today)).toBe(false);
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

  it('shows child programs only while the patient is in the configured pediatric age range', () => {
    expect(isProgramEligibleForPatient(wellChildProgram, { birthDate: '2020-01-01' }, rules, today)).toBe(true);
    expect(isProgramEligibleForPatient(wellChildProgram, { birthDate: '2010-01-01' }, rules, today)).toBe(false);
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
