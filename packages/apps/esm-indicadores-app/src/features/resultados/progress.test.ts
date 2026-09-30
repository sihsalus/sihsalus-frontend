import { META_STATUS_LOW_BELOW, META_STATUS_MEDIUM_BELOW, calculateProgress, getMetaStatus } from './progress';

describe('calculateProgress', () => {
  it('rounds the ratio of the value against the target', () => {
    expect(calculateProgress(1000, 750)).toBe(75);
    expect(calculateProgress(1000, 333)).toBe(33);
  });

  it('caps the percentage at 100 and floors it at 0', () => {
    expect(calculateProgress(100, 150)).toBe(100);
    expect(calculateProgress(100, -25)).toBe(0);
  });

  it('returns 0 for a non-positive or non-finite target instead of dividing by zero', () => {
    expect(calculateProgress(0, 50)).toBe(0);
    expect(calculateProgress(-10, 50)).toBe(0);
    expect(calculateProgress(Number.NaN, 50)).toBe(0);
    expect(calculateProgress(Number.POSITIVE_INFINITY, 50)).toBe(0);
  });
});

describe('getMetaStatus', () => {
  it('classifies values below the low threshold as low', () => {
    expect(getMetaStatus(0)).toBe('low');
    expect(getMetaStatus(META_STATUS_LOW_BELOW - 1)).toBe('low');
  });

  it('classifies the medium band between the two thresholds', () => {
    expect(getMetaStatus(META_STATUS_LOW_BELOW)).toBe('medium');
    expect(getMetaStatus(META_STATUS_MEDIUM_BELOW - 1)).toBe('medium');
  });

  it('classifies values at or above the high threshold as high', () => {
    expect(getMetaStatus(META_STATUS_MEDIUM_BELOW)).toBe('high');
    expect(getMetaStatus(100)).toBe('high');
  });
});
