import dayjs from 'dayjs';
import type { i18n } from 'i18next';
import { describe, expect, it, vi } from 'vitest';
import { age, ageAsDuration, exactAgeAsDuration } from '.';

window.i18next = { language: 'en' } as i18n;

describe('Age Helper', () => {
  const now = dayjs('2024-07-30T08:30:55Z');

  it.each([
    {
      label: 'just born',
      birthDate: now,
      expectedOutput: '0 years 0 months 0 days',
    },
    {
      label: 'aged one day',
      birthDate: '2024-07-29',
      expectedOutput: '0 years 0 months 1 day',
    },
    {
      label: 'aged 72 years, 11 months and 6 days',
      birthDate: '1951-08-24',
      expectedOutput: '72 years 11 months 6 days',
    },
    {
      label: 'aged one year and eight days',
      birthDate: '2023-07-22',
      expectedOutput: '1 year 0 months 8 days',
    },
    {
      label: 'born in 2000',
      birthDate: '2000',
      expectedOutput: '24 years 0 months 0 days',
    },
    {
      label: 'born in June 2020',
      birthDate: '2020-06',
      expectedOutput: '4 years 1 month 0 days',
    },
    {
      label: 'born Feb 29th 2020',
      birthDate: '2020-02-29',
      expectedOutput: '4 years 5 months 1 day',
    },
    {
      label: 'born January 1st 2020',
      birthDate: '2020-01-01',
      expectedOutput: '4 years 6 months 29 days',
    },
  ])("should produce '$expectedOutput' for person $label", ({ birthDate, expectedOutput }) => {
    expect(age(birthDate, now)).toBe(expectedOutput);
  });

  it('uses full localized Spanish units without omitting zero-valued units', () => {
    window.i18next.language = 'es';

    expect(age('1951-08-24', now)).toBe('72 años 11 meses 6 días');

    window.i18next.language = 'en';
  });

  it('returns the exact age as years, months and days', () => {
    expect(exactAgeAsDuration('1951-08-24', now)).toEqual({ years: 72, months: 11, days: 6 });
  });

  it('returns null when the birth date is after the reference date', () => {
    expect(age('2024-07-31', now)).toBeNull();
  });
});

describe('ageAsDuration', () => {
  const now = dayjs('2024-07-30T08:30:55Z');

  it('returns null for null birthDate', () => {
    expect(ageAsDuration(null)).toBeNull();
  });

  it.each([
    {
      label: 'just born',
      birthDate: now,
      expected: { minutes: 0 },
    },
    {
      label: 'aged 1 hour 30 minutes',
      birthDate: now.subtract(1, 'hour').subtract(30, 'minutes'),
      expected: { minutes: 90 },
    },
    {
      label: 'aged 1 day 2 hours 5 minutes',
      birthDate: now.subtract(1, 'day').subtract(2, 'hours').subtract(5, 'minutes'),
      expected: { hours: 26 },
    },
    {
      label: 'aged 3 days 17 hours 30 minutes',
      birthDate: now.subtract(3, 'days').subtract(17, 'hours').subtract(30, 'minutes'),
      expected: { days: 3 },
    },
    {
      label: 'aged 29 days 5 hours 2 minutes',
      birthDate: now.subtract(29, 'days').subtract(5, 'hours').subtract(2, 'minutes'),
      expected: { weeks: 4, days: 1 },
    },
    {
      label: 'aged 1 year 8 days 5 hours',
      birthDate: now.subtract(1, 'year').subtract(8, 'days').subtract(5, 'hours'),
      expected: { months: 12, days: 8 },
    },
    {
      label: 'aged 4 years 38 days',
      birthDate: now.subtract(4, 'years').subtract(38, 'days').subtract(5, 'hours'),
      expected: { years: 4, months: 1 },
    },
    {
      label: 'aged 18 years 38 days',
      birthDate: now.subtract(18, 'years').subtract(38, 'days'),
      expected: { years: 18 },
    },
    {
      label: 'born in 2000 (string)',
      birthDate: '2000',
      expected: { years: 24 },
    },
    {
      label: 'born in June 2020 (string)',
      birthDate: '2020-06',
      expected: { years: 4, months: 1 },
    },
    {
      label: 'born Feb 29th 2020 (string)',
      birthDate: '2020-02-29',
      expected: { years: 4, months: 5 },
    },
    {
      label: 'born January 1st 2020 (string)',
      birthDate: '2020-01-01',
      expected: { years: 4, months: 6 },
    },
  ])('returns $expected for person $label', ({ birthDate, expected }) => {
    expect(ageAsDuration(birthDate, now)).toEqual(expected);
  });

  it('returns null for an invalid string', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(ageAsDuration('not a date', now)).toBeNull();
  });
});
