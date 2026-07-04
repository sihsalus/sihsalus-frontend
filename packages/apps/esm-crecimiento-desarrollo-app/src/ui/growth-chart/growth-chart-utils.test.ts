import { CategoryCodes, type ChartData, DataSetLabels, MeasurementTypeCodesLabel, TimeUnitCodes } from './data-sets';
import {
  formatZScore,
  getGrowthChartInterpretation,
  getMeasurementXValue,
  isMeasurementUsableForDataset,
  selectDatasetForCategory,
} from './growth-chart-utils';

const chartData = {
  [CategoryCodes.wflh_b]: {
    datasets: {
      lengthDataset: {
        zScoreDatasetValues: [],
        percentileDatasetValues: [],
        metadata: {
          chartLabel: 'lengthDataset',
          xAxisLabel: MeasurementTypeCodesLabel.length,
          yAxisLabel: MeasurementTypeCodesLabel.weight,
          range: { start: 45, end: 110 },
        },
      },
      heightDataset: {
        zScoreDatasetValues: [],
        percentileDatasetValues: [],
        metadata: {
          chartLabel: 'heightDataset',
          xAxisLabel: MeasurementTypeCodesLabel.height,
          yAxisLabel: MeasurementTypeCodesLabel.weight,
          range: { start: 65, end: 120 },
        },
      },
    },
  },
  [CategoryCodes.wfa_b]: {
    datasets: {
      weekDataset: {
        zScoreDatasetValues: [],
        percentileDatasetValues: [],
        metadata: {
          chartLabel: 'weekDataset',
          xAxisLabel: TimeUnitCodes.weeks,
          yAxisLabel: MeasurementTypeCodesLabel.weight,
          range: { start: 0, end: 13 },
        },
      },
      monthDataset: {
        zScoreDatasetValues: [],
        percentileDatasetValues: [],
        metadata: {
          chartLabel: 'monthDataset',
          xAxisLabel: TimeUnitCodes.months,
          yAxisLabel: MeasurementTypeCodesLabel.weight,
          range: { start: 0, end: 60 },
        },
      },
    },
  },
  [CategoryCodes.lhfa_b]: {
    datasets: {
      youngerDataset: {
        zScoreDatasetValues: [],
        percentileDatasetValues: [],
        metadata: {
          chartLabel: 'youngerDataset',
          xAxisLabel: TimeUnitCodes.months,
          yAxisLabel: MeasurementTypeCodesLabel.length,
          range: { start: 0, end: 24 },
        },
      },
      olderDataset: {
        zScoreDatasetValues: [],
        percentileDatasetValues: [],
        metadata: {
          chartLabel: 'olderDataset',
          xAxisLabel: TimeUnitCodes.months,
          yAxisLabel: MeasurementTypeCodesLabel.height,
          range: { start: 24, end: 60 },
        },
      },
    },
  },
} as ChartData;

describe('growth-chart-utils', () => {
  it('selects length vs height datasets for weight-for-length/height by age', () => {
    expect(selectDatasetForCategory(chartData, CategoryCodes.wflh_b, 52, 12)).toBe('lengthDataset');
    expect(selectDatasetForCategory(chartData, CategoryCodes.wflh_b, 120, 30)).toBe('heightDataset');
  });

  it('selects weekly references for newborns and monthly references afterwards', () => {
    expect(selectDatasetForCategory(chartData, CategoryCodes.wfa_b, 8, 1)).toBe('weekDataset');
    expect(selectDatasetForCategory(chartData, CategoryCodes.wfa_b, 20, 4)).toBe('monthDataset');
  });

  it('switches split month datasets at the two-year boundary', () => {
    expect(selectDatasetForCategory(chartData, CategoryCodes.lhfa_b, 90, 23)).toBe('youngerDataset');
    expect(selectDatasetForCategory(chartData, CategoryCodes.lhfa_b, 104, 24)).toBe('olderDataset');
  });

  it('calculates x values from age or height depending on the selected chart', () => {
    const dateOfBirth = new Date('2024-01-01T00:00:00.000Z');

    expect(
      getMeasurementXValue(
        { eventDate: new Date('2024-01-15T00:00:00.000Z'), dataValues: { weight: '4', height: '52' } },
        CategoryCodes.wfa_b,
        DataSetLabels.w_0_13,
        dateOfBirth,
      ),
    ).toBe(2);

    expect(
      getMeasurementXValue(
        { eventDate: new Date('2024-02-01T00:00:00.000Z'), dataValues: { weight: '4', height: '52.5' } },
        CategoryCodes.wflh_b,
        DataSetLabels.y_0_2,
        dateOfBirth,
      ),
    ).toBe(52.5);
  });

  it('estimates z-score by interpolating between reference rows and z-score bands', () => {
    const interpretation = getGrowthChartInterpretation({
      category: CategoryCodes.wfa_b,
      xValue: 0.5,
      measurementValue: 16,
      startIndex: 0,
      zScoreDatasetValues: [
        { SD3neg: 4, SD2neg: 6, SD1neg: 8, SD0: 10, SD1: 12, SD2: 14, SD3: 16 },
        { SD3neg: 14, SD2neg: 16, SD1neg: 18, SD0: 20, SD1: 22, SD2: 24, SD3: 26 },
      ],
    });

    expect(interpretation?.zScore).toBeCloseTo(0.5);
    expect(interpretation?.code).toBe('normal');
    expect(interpretation?.severity).toBe('normal');
    expect(formatZScore(interpretation?.zScore ?? 0)).toBe('+0.5');
  });

  it('classifies severe wasting for weight-for-length/height charts', () => {
    const interpretation = getGrowthChartInterpretation({
      category: CategoryCodes.wflh_b,
      xValue: 45,
      measurementValue: 1.8,
      startIndex: 45,
      zScoreDatasetValues: [{ SD3neg: 2, SD2neg: 3, SD1neg: 4, SD0: 5, SD1: 6, SD2: 7, SD3: 8 }],
    });

    expect(interpretation?.zScore).toBeLessThan(-3);
    expect(interpretation?.code).toBe('severeWasting');
    expect(interpretation?.severity).toBe('critical');
  });

  it('returns null when no z-score reference row is available', () => {
    expect(
      getGrowthChartInterpretation({
        category: CategoryCodes.wfa_b,
        xValue: 0,
        measurementValue: 10,
        startIndex: 0,
        zScoreDatasetValues: [],
      }),
    ).toBeNull();
  });

  it('filters measurements outside the selected dataset range or age band', () => {
    const dateOfBirth = new Date('2024-01-01T00:00:00.000Z');
    const infantMeasurement = {
      eventDate: new Date('2025-01-01T00:00:00.000Z'),
      dataValues: { weight: '9', height: '75' },
    };
    const toddlerMeasurement = {
      eventDate: new Date('2026-07-01T00:00:00.000Z'),
      dataValues: { weight: '12', height: '90' },
    };

    expect(
      isMeasurementUsableForDataset(infantMeasurement, CategoryCodes.wflh_b, DataSetLabels.y_2_5, dateOfBirth, 75, {
        start: 65,
        end: 120,
      }),
    ).toBe(false);

    expect(
      isMeasurementUsableForDataset(toddlerMeasurement, CategoryCodes.wflh_b, DataSetLabels.y_2_5, dateOfBirth, 90, {
        start: 65,
        end: 120,
      }),
    ).toBe(true);

    expect(
      isMeasurementUsableForDataset(toddlerMeasurement, CategoryCodes.wflh_b, DataSetLabels.y_2_5, dateOfBirth, 130, {
        start: 65,
        end: 120,
      }),
    ).toBe(false);
  });
});
