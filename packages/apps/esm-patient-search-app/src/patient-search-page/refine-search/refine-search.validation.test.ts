import { createRefineSearchSchema } from './refine-search.validation';

const t = (_key: string, defaultValue: string) => defaultValue;
const today = new Date(2026, 6, 13);
const schema = createRefineSearchSchema(t, 0, 140, today);

const validFilters = {
  query: '',
  gender: 'any' as const,
  dateOfBirth: 0,
  monthOfBirth: 0,
  yearOfBirth: 0,
  postcode: '',
  age: 0,
  attributes: {},
};

describe('refine search validation', () => {
  it('accepts empty optional filters', () => {
    expect(schema.safeParse(validFilters).success).toBe(true);
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
