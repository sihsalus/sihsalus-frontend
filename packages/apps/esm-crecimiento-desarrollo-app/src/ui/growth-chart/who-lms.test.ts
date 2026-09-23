import { assert } from 'vitest';
import { schoolChartData } from './data-sets/WhoReference2007';
import boys from './data-sets/WhoReference2007/bmi-boys.json';
import girls from './data-sets/WhoReference2007/bmi-girls.json';
import height from './data-sets/WhoReference2007/hfa-boys.json';
import {
  getGrowthChartInterpretation,
  getMeasurementValue,
  getMeasurementXValue,
  isMeasurementUsableForDataset,
} from './growth-chart-utils';
import { DataSetLabels } from './data-sets';
import { calculateLMSZScore, measurementAtZ } from './who-lms';

describe('WHO 2007 school references', () => {
  it.each([
    [132, 30, 3.35],
    [192, 14, -3.8],
    [108, 19, 1.47],
  ])('matches WHO computation example at month %s', (month, bmi, expected) => {
    // The published worked examples round intermediate SD measurements to two decimals.
    const actual = calculateLMSZScore(boys, month, bmi, true);
    assert(actual !== null);
    expect(Math.abs(actual - expected)).toBeLessThan(0.01);
  });

  it('uses sex-specific data and the LMS median', () => {
    expect(calculateLMSZScore(boys, 61, 15.2641, true)).toBeCloseTo(0, 10);
    expect(calculateLMSZScore(girls, 61, 15.2441, true)).toBeCloseTo(0, 10);
    expect(calculateLMSZScore(height, 61, 110.2647, false)).toBeCloseTo(0, 10);
  });

  it('interpolates between monthly LMS rows without extrapolating outside the reference', () => {
    expect(calculateLMSZScore(boys, 61.5, (boys[0].m + boys[1].m) / 2, true)).toBeCloseTo(0, 10);
    for (const age of [60, 60.99, 228.01, 300, Number.NaN]) expect(calculateLMSZScore(boys, age, 16, true)).toBeNull();
    for (const value of [0, -1, Number.NaN, Number.POSITIVE_INFINITY])
      expect(calculateLMSZScore(boys, 72, value, true)).toBeNull();
    expect(calculateLMSZScore(boys, 228, boys[167].m, true)).toBeCloseTo(0, 10);
  });

  it.each([
    [-3.1, 'severeThinness'],
    [-3, 'thinness'],
    [-2, 'normal'],
    [1, 'normal'],
    [2, 'overweight'],
    [-2.1, 'thinness'],
    [0, 'normal'],
    [1.1, 'overweight'],
    [2.1, 'obesity'],
  ])('classifies school BMI z=%s using WHO school cutoffs', (z, code) => {
    const dataset = schoolChartData.bfa_b.datasets[DataSetLabels.y_5_19];
    const row = boys[0];
    expect(
      getGrowthChartInterpretation({
        category: 'bfa_b',
        xValue: 61,
        measurementValue: measurementAtZ(row, z),
        startIndex: 61,
        zScoreDatasetValues: dataset.zScoreDatasetValues,
        lmsReferences: boys,
      })?.code,
    ).toBe(code);
  });

  it('requires a shared encounter and valid weight and height for BMI', () => {
    const entry = {
      eventDate: '2026-01-01',
      encounterReference: 'Encounter/synthetic',
      dataValues: { weight: '24', height: '120' },
    };
    expect(getMeasurementValue(entry, 'bfa_b')).toBeCloseTo(16.666667, 5);
    expect(getMeasurementValue({ ...entry, encounterReference: undefined }, 'bfa_b')).toBeNull();
    for (const value of ['', '0', '-1', '120cm', 'NaN'])
      expect(getMeasurementValue({ ...entry, dataValues: { ...entry.dataValues, height: value } }, 'bfa_b')).toBeNull();
  });

  it('places school measurements by age at observation using WHO 30.4375-day months', () => {
    const birth = new Date('2020-01-01T00:00:00Z');
    const entry = { eventDate: new Date(birth.getTime() + 61.5 * 30.4375 * 86400000), dataValues: {} };
    const x = getMeasurementXValue(entry, 'bfa_b', DataSetLabels.y_5_19, birth);
    assert(x !== null);
    expect(x).toBe(61.5);
    expect(isMeasurementUsableForDataset(entry, 'bfa_b', DataSetLabels.y_5_19, birth, x, { start: 61, end: 228 })).toBe(
      true,
    );
  });
});
