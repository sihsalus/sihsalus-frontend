import { type ChartData, DataSetLabels, GenderCodes, MeasurementTypeCodesLabel, TimeUnitCodes } from '..';
import { type LMSReference, measurementAtZ } from '../../who-lms';
import bmiBoys from './bmi-boys.json';
import bmiGirls from './bmi-girls.json';
import heightBoys from './hfa-boys.json';
import heightGirls from './hfa-girls.json';

function dataset(rows: LMSReference[], yAxisLabel: string): ChartData[string]['datasets'][string] {
  const zValues = { SD3neg: -3, SD2neg: -2, SD1neg: -1, SD0: 0, SD1: 1, SD2: 2, SD3: 3 };
  const percentiles = { P3: -1.880793608151, P15: -1.036433389494, P50: 0, P85: 1.036433389494, P97: 1.880793608151 };
  const curves = (values: Record<string, number>) =>
    rows.map((row) => Object.fromEntries(Object.entries(values).map(([key, z]) => [key, measurementAtZ(row, z)])));
  return {
    lmsReferences: rows,
    zScoreDatasetValues: curves(zValues),
    percentileDatasetValues: curves(percentiles),
    metadata: {
      chartLabel: DataSetLabels.y_5_19,
      xAxisLabel: TimeUnitCodes.months,
      yAxisLabel,
      range: { start: 61, end: 228 },
    },
  };
}

export const schoolChartData: ChartData = {
  bfa_b: {
    categoryMetadata: { label: 'growthBmiForAge', gender: GenderCodes.CGC_Male },
    datasets: { [DataSetLabels.y_5_19]: dataset(bmiBoys, MeasurementTypeCodesLabel.bmi) },
  },
  bfa_g: {
    categoryMetadata: { label: 'growthBmiForAge', gender: GenderCodes.CGC_Female },
    datasets: { [DataSetLabels.y_5_19]: dataset(bmiGirls, MeasurementTypeCodesLabel.bmi) },
  },
  lhfa_b: {
    categoryMetadata: { label: 'growthHeightForAge', gender: GenderCodes.CGC_Male },
    datasets: { [DataSetLabels.y_5_19]: dataset(heightBoys, MeasurementTypeCodesLabel.height) },
  },
  lhfa_g: {
    categoryMetadata: { label: 'growthHeightForAge', gender: GenderCodes.CGC_Female },
    datasets: { [DataSetLabels.y_5_19]: dataset(heightGirls, MeasurementTypeCodesLabel.height) },
  },
};
