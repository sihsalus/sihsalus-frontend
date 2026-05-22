import {
  type AgeGroup,
  calculateAgeInDays,
  calculateAgeInMonths,
  getAgeGroup,
  getAgeGroupFromBirthDate,
  getAgeGroupInDays,
} from './age-group-utils';

describe('age-group-utils', () => {
  const ageGroups: AgeGroup[] = [
    { label: 'Neonatal', minDays: 0, maxDays: 28, minMonths: 0, maxMonths: 1 },
    { label: 'Infant', minDays: 29, maxDays: 365, minMonths: 1, maxMonths: 12 },
    { label: 'Toddler', minDays: 366, maxDays: 730, minMonths: 12, maxMonths: 24 },
  ];

  beforeEach(() => {
    vi.useFakeTimers().setSystemTime(new Date('2025-01-15T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calculates age in days and months from the current system date', () => {
    expect(calculateAgeInDays('2025-01-01T00:00:00.000Z')).toBe(14);
    expect(calculateAgeInMonths('2024-01-15T00:00:00.000Z')).toBe(12);
  });

  it('finds the matching age group from months and from birth date', () => {
    expect(getAgeGroup(6, ageGroups)).toEqual(ageGroups[1]);
    expect(getAgeGroupFromBirthDate('2024-07-15T00:00:00.000Z', ageGroups)).toEqual(ageGroups[1]);
    expect(getAgeGroup(30, ageGroups)).toBeNull();
  });

  it('finds the matching age group from days with inclusive boundaries', () => {
    expect(getAgeGroupInDays(28, ageGroups)).toEqual(ageGroups[0]);
    expect(getAgeGroupInDays(29, ageGroups)).toEqual(ageGroups[1]);
    expect(getAgeGroupInDays(999, ageGroups)).toBeNull();
  });
});
