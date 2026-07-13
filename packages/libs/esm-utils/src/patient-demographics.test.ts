import { describe, expect, it } from 'vitest';

import {
  calendarDateToLocalDate,
  calculatePatientAge,
  calculatePatientAgeInMonths,
  estimatePatientBirthdateFromAge,
  getOldestAllowedPatientBirthdate,
  hasPossiblePatientBirthdate,
  normalizePatientAgeRange,
  parsePatientBirthdate,
  validatePatientBirthdate,
} from './patient-demographics';

const today = { year: 2026, month: 7, day: 13 };

describe('patient demographic calendar dates', () => {
  it('parses OpenMRS and FHIR birthdates without applying a timezone offset', () => {
    expect(parsePatientBirthdate('2020-01-01')).toEqual({ year: 2020, month: 1, day: 1 });
    expect(parsePatientBirthdate('2020-01-01T00:00:00.000+0000')).toEqual({ year: 2020, month: 1, day: 1 });
  });

  it('adapts a calendar date to a local Date without changing its recorded day', () => {
    const localDate = calendarDateToLocalDate({ year: 2020, month: 1, day: 1 });

    expect(localDate).not.toBeNull();
    expect(
      localDate && { year: localDate.getFullYear(), month: localDate.getMonth() + 1, day: localDate.getDate() },
    ).toEqual({ year: 2020, month: 1, day: 1 });
  });

  it.each(['2025-02-29', '2026-04-31', '13/07/2026', '2026-7-13'])('rejects invalid date %s', (value) => {
    expect(parsePatientBirthdate(value)).toBeNull();
  });

  it('uses the same 140-year calendar boundary as OpenMRS Core', () => {
    expect(getOldestAllowedPatientBirthdate(today)).toEqual({ year: 1886, month: 7, day: 13 });
    expect(validatePatientBirthdate({ year: 1886, month: 7, day: 13 }, today)).toBe('valid');
    expect(validatePatientBirthdate({ year: 1886, month: 7, day: 12 }, today)).toBe('too-old');
    expect(validatePatientBirthdate({ year: 2026, month: 7, day: 14 }, today)).toBe('future');
  });

  it('calculates completed years instead of subtracting birth years', () => {
    expect(calculatePatientAge({ year: 2025, month: 7, day: 13 }, today)).toBe(1);
    expect(calculatePatientAge({ year: 2025, month: 7, day: 14 }, today)).toBe(0);
  });

  it('calculates completed calendar months for estimated age fields', () => {
    expect(calculatePatientAgeInMonths({ year: 2025, month: 6, day: 13 }, today)).toBe(13);
    expect(calculatePatientAgeInMonths({ year: 2025, month: 6, day: 14 }, today)).toBe(12);
  });

  it.each([
    ['empty criteria', {}, true],
    ['a valid leap day without a year', { day: 29, month: 2 }, true],
    ['31 April', { day: 31, month: 4 }, false],
    ['a future month in the current year', { month: 8, year: 2026 }, false],
    ['a month entirely before the oldest boundary', { month: 6, year: 1886 }, false],
    ['the oldest year with possible dates', { year: 1886 }, true],
  ])('evaluates %s as a partial birthdate', (_label, partial, expected) => {
    expect(hasPossiblePatientBirthdate(partial, today)).toBe(expected);
  });

  it('keeps zero as a valid estimated age and rejects values over the backend limit', () => {
    expect(estimatePatientBirthdateFromAge(0, today)).toBe('2026-07-13');
    expect(estimatePatientBirthdateFromAge(140, today)).toBe('1886-07-13');
    expect(estimatePatientBirthdateFromAge(141, today)).toBeNull();
  });

  it('does not let configuration widen the backend-supported age range', () => {
    expect(normalizePatientAgeRange(-10, 100000)).toEqual({ minimumAge: 0, maximumAge: 140 });
    expect(normalizePatientAgeRange(18, 65)).toEqual({ minimumAge: 18, maximumAge: 65 });
    expect(normalizePatientAgeRange(18.2, 65.8)).toEqual({ minimumAge: 19, maximumAge: 65 });
    expect(normalizePatientAgeRange(Number.NaN, Number.POSITIVE_INFINITY)).toEqual({
      minimumAge: 0,
      maximumAge: 140,
    });
  });
});
