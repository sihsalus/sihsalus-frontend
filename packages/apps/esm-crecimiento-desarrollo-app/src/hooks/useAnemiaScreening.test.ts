import { getAnemiaScreeningIntervalMonths } from './useAnemiaScreening';

describe('getAnemiaScreeningIntervalMonths', () => {
  it('uses a three-month interval from 6 through 23 months', () => {
    expect(getAnemiaScreeningIntervalMonths('2025-01-01', '2026-07-01')).toBe(3);
  });

  it('uses a six-month interval from 24 through 59 months', () => {
    expect(getAnemiaScreeningIntervalMonths('2024-01-01', '2026-07-01')).toBe(6);
  });

  it('uses an annual interval from 5 through 11 years', () => {
    expect(getAnemiaScreeningIntervalMonths('2020-01-01', '2026-07-01')).toBe(12);
  });

  it('does not infer an interval outside the normative age range', () => {
    expect(getAnemiaScreeningIntervalMonths('2026-04-01', '2026-07-01')).toBeNull();
  });
});
