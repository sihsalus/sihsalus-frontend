import { createRefineSearchSchema } from './refine-search.validation';

const t = (_key: string, defaultValue: string) => defaultValue;
const today = new Date(2026, 6, 13);
const schema = createRefineSearchSchema(t, 0, 140, today);

const validFilters = {
  query: '',
  gender: 'any' as const,
  dateOfBirth: null,
  monthOfBirth: null,
  yearOfBirth: null,
  postcode: '',
  age: null,
  attributes: {},
};

describe('refine search validation', () => {
  it('accepts empty optional filters', () => {
    expect(schema.safeParse(validFilters).success).toBe(true);
  });

  it('keeps age zero distinct from an empty age filter', () => {
    expect(schema.safeParse({ ...validFilters, age: 0 }).success).toBe(true);
  });

  it.each([
    ['day greater than 31', { dateOfBirth: 32 }],
    ['month greater than 12', { monthOfBirth: 13 }],
    ['year in the future', { yearOfBirth: 2027 }],
    ['year outside the 140-year registration horizon', { yearOfBirth: 1885 }],
    ['age greater than 140', { age: 141 }],
  ])('rejects %s', (_label, override) => {
    expect(schema.safeParse({ ...validFilters, ...override }).success).toBe(false);
  });

  it.each([
    ['31 April', { dateOfBirth: 31, monthOfBirth: 4, yearOfBirth: 2000 }],
    ['29 February in a non-leap year', { dateOfBirth: 29, monthOfBirth: 2, yearOfBirth: 2025 }],
    ['a future full date', { dateOfBirth: 14, monthOfBirth: 7, yearOfBirth: 2026 }],
    ['a date more than 140 years ago', { dateOfBirth: 12, monthOfBirth: 7, yearOfBirth: 1886 }],
    ['a future partial month and year', { monthOfBirth: 8, yearOfBirth: 2026 }],
    ['a partial month and year before the oldest boundary', { monthOfBirth: 6, yearOfBirth: 1886 }],
    ['31 April without a year', { dateOfBirth: 31, monthOfBirth: 4 }],
  ])('rejects %s', (_label, override) => {
    expect(schema.safeParse({ ...validFilters, ...override }).success).toBe(false);
  });

  it.each([
    ['leap day', { dateOfBirth: 29, monthOfBirth: 2, yearOfBirth: 2024 }],
    ['the exact 140-year boundary', { dateOfBirth: 13, monthOfBirth: 7, yearOfBirth: 1886 }],
  ])('accepts %s', (_label, override) => {
    expect(schema.safeParse({ ...validFilters, ...override }).success).toBe(true);
  });
});
