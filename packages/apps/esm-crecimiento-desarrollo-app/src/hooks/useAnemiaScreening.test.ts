import { getAnemiaScreeningIntervalMonths } from './useAnemiaScreening';

describe('getAnemiaScreeningIntervalMonths', () => {
  it('uses a six-month interval before two years of age', () => {
    expect(getAnemiaScreeningIntervalMonths('2025-01-01', '2026-07-01')).toBe(6);
  });

  it('uses an annual interval from two years of age', () => {
    expect(getAnemiaScreeningIntervalMonths('2024-01-01', '2026-07-01')).toBe(12);
  });
});
