import type { LMSReference } from '../who-lms';

export interface ChartData {
  [key: string]: {
    categoryMetadata?: {
      label: string;
      gender: string;
    };
    datasets: {
      [key: string]: {
        lmsReferences?: LMSReference[];
        zScoreDatasetValues: { [key: string]: number }[];
        percentileDatasetValues: { [key: string]: number }[];
        metadata: {
          chartLabel: string;
          yAxisLabel: string;
          xAxisLabel: string;
          range: { start: number; end: number };
        };
      };
    };
  };
}

export const TimeUnitCodes = Object.freeze({
  years: 'Years',
  months: 'Months',
  weeks: 'Weeks',
});

export const MeasurementTypeCodesLabel = Object.freeze({
  bmi: 'BMI',
  headCircumference: 'Head circumference',
  length: 'Length',
  height: 'Height',
  weight: 'Weight',
});

export const MeasurementTypeCodes = Object.freeze({
  bfa_b: 'bmi',
  bfa_g: 'bmi',
  hcfa_b: 'headCircumference',
  hcfa_g: 'headCircumference',
  lhfa_b: 'height',
  lhfa_g: 'height',
  wfa_g: 'weight',
  wfa_b: 'weight',
  wflh_b: 'weight',
  wflh_g: 'weight',
});

export const CategoryLabels = Object.freeze({
  hcfa: 'Perímetro cefálico (cm) para la edad',
  lhfa: 'Talla (cm) para la edad',
  wfa: 'Peso (kg) para la edad',
  wflh: 'Peso (kg) para la Talla (cm)',
});

export const CategoryCodes = Object.freeze({
  bfa_b: 'bfa_b',
  bfa_g: 'bfa_g',
  hcfa_b: 'hcfa_b',
  hcfa_g: 'hcfa_g',
  lhfa_b: 'lhfa_b',
  lhfa_g: 'lhfa_g',
  wfa_b: 'wfa_b',
  wfa_g: 'wfa_g',
  wflh_b: 'wflh_b',
  wflh_g: 'wflh_g',
});

export enum DataSetLabels {
  y_5_19 = 'y_5_19',
  w_0_13 = 'w_0_13',
  y_0_2 = 'y_0_2',
  y_0_5 = 'y_0_5',
  y_2_5 = 'y_2_5',
}

export type DataSetLabelValues = keyof typeof DataSetLabels;

export const ChartLabelCodes = Object.freeze({
  b_0_5_y: DataSetLabels.y_0_5,
  b_0_13_w: DataSetLabels.w_0_13,
  g_0_5_y: DataSetLabels.y_0_5,
  g_0_13_w: DataSetLabels.w_0_13,
  b_0_2_y: DataSetLabels.y_0_2,
  b_2_5_y: DataSetLabels.y_2_5,
  g_0_2_y: DataSetLabels.y_0_2,
  g_2_5_y: DataSetLabels.y_2_5,
});

export const ChartCodes = Object.freeze({
  hcfa_b_0_5_y_z: ChartLabelCodes.b_0_5_y,
  hcfa_b_0_13_w_z: ChartLabelCodes.b_0_13_w,
  hcfa_g_0_5_y_z: ChartLabelCodes.g_0_5_y,
  hcfa_g_0_13_w_z: ChartLabelCodes.g_0_13_w,
  lhfa_b_0_2_y_z: ChartLabelCodes.b_0_2_y,
  lhfa_b_0_13_w_z: ChartLabelCodes.b_0_13_w,
  lhfa_b_2_5_y_z: ChartLabelCodes.b_2_5_y,
  lhfa_g_0_2_y_z: ChartLabelCodes.g_0_2_y,
  lhfa_g_0_13_w_z: ChartLabelCodes.b_0_13_w,
  lhfa_g_2_5_y_z: ChartLabelCodes.g_2_5_y,
  wfa_b_0_5_y_z: ChartLabelCodes.b_0_5_y,
  wfa_b_0_13_w_z: ChartLabelCodes.b_0_13_w,
  wfa_g_0_5_y_z: ChartLabelCodes.g_0_5_y,
  wfa_g_0_13_w_z: ChartLabelCodes.g_0_13_w,
  wfh_g_2_5_y_z: ChartLabelCodes.g_2_5_y,
  wfl_g_0_2_y_z: ChartLabelCodes.g_0_2_y,
  wfh_b_2_5_y_z: ChartLabelCodes.b_2_5_y,
  wfl_b_0_2_y_z: ChartLabelCodes.b_0_2_y,
});

export const GenderCodes = Object.freeze({
  CGC_Male: 'M',
  CGC_Female: 'F',
});
