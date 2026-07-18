import type { SearchedPatient } from '../types';

import { getPatientAgeForUnit, matchesPatientAge } from './patient-age-filter';

const referenceDate = { year: 2026, month: 7, day: 17 };

describe('patient age filter', () => {
  it.each([
    ['2026-07-07', 'days', 10],
    ['2025-11-17', 'months', 8],
    ['1980-07-18', 'years', 45],
  ] as const)('calculates %s in %s', (birthdate, unit, expectedAge) => {
    expect(getPatientAgeForUnit(birthdate, unit, referenceDate)).toBe(expectedAge);
  });

  it('matches the selected age and unit against the patient birthdate', () => {
    const patient = {
      person: { birthdate: '2025-11-17', age: 0 },
    } as SearchedPatient;

    expect(matchesPatientAge(patient, 8, 'months', referenceDate)).toBe(true);
    expect(matchesPatientAge(patient, 8, 'years', referenceDate)).toBe(false);
  });

  it('uses the REST age as a fallback only for years when birthdate is unavailable', () => {
    const patient = { person: { age: 46 } } as SearchedPatient;

    expect(matchesPatientAge(patient, 46, 'years', referenceDate)).toBe(true);
    expect(matchesPatientAge(patient, 46, 'months', referenceDate)).toBe(false);
  });
});
