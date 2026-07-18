import { createRefineSearchSchema } from './refine-search.validation';

const t = (_key: string, defaultValue: string) => defaultValue;
const schema = createRefineSearchSchema(t, 0, 140, new Date(2026, 6, 13));

const validFilters = {
  query: '',
  gender: 'any' as const,
  postcode: '',
  age: null,
  ageUnit: 'years' as const,
  hasActiveVisit: false,
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
    ['more than 140 years', { age: 141, ageUnit: 'years' }],
    ['more than 27 days', { age: 28, ageUnit: 'days' }],
    ['more than 23 months', { age: 24, ageUnit: 'months' }],
    ['a negative age', { age: -1, ageUnit: 'years' }],
  ])('rejects %s', (_label, override) => {
    expect(schema.safeParse({ ...validFilters, ...override }).success).toBe(false);
  });

  it.each([
    ['the neonatal day boundary', { age: 27, ageUnit: 'days' }],
    ['the infant month boundary', { age: 23, ageUnit: 'months' }],
    ['the OpenMRS year boundary', { age: 140, ageUnit: 'years' }],
  ])('accepts %s', (_label, override) => {
    expect(schema.safeParse({ ...validFilters, ...override }).success).toBe(true);
  });
});
