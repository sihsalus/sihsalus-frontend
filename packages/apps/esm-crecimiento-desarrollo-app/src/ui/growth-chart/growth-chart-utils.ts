import { CategoryCodes, type ChartData, DataSetLabels, MeasurementTypeCodesLabel, TimeUnitCodes } from './data-sets';

export interface GrowthMeasurementEntry {
  eventDate: Date | string;
  dataValues: Record<string, string>;
}

export interface GrowthChartPoint {
  group: string;
  date: number;
  value: number;
  eventDate?: Date;
  isPatientMeasurement?: boolean;
}

export type GrowthChartInterpretationCode =
  | 'normal'
  | 'veryLowWeight'
  | 'lowWeight'
  | 'highWeight'
  | 'veryHighWeight'
  | 'severeWasting'
  | 'moderateWasting'
  | 'overweight'
  | 'obesity'
  | 'veryShortStature'
  | 'shortStature'
  | 'tallStature'
  | 'veryLowHeadCircumference'
  | 'lowHeadCircumference'
  | 'highHeadCircumference'
  | 'veryHighHeadCircumference';

export type GrowthChartInterpretationSeverity = 'normal' | 'warning' | 'critical';

export interface GrowthChartInterpretation {
  zScore: number;
  code: GrowthChartInterpretationCode;
  severity: GrowthChartInterpretationSeverity;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const DAYS_PER_MONTH = 30.44;
const RANGE_TOLERANCE = 0.001;

const measurementAxisLabels = Object.values(MeasurementTypeCodesLabel) as string[];
const zScoreReferencePoints = [
  { key: 'SD3neg', zScore: -3 },
  { key: 'SD2neg', zScore: -2 },
  { key: 'SD1neg', zScore: -1 },
  { key: 'SD0', zScore: 0 },
  { key: 'SD1', zScore: 1 },
  { key: 'SD2', zScore: 2 },
  { key: 'SD3', zScore: 3 },
];

export function selectDatasetForCategory(
  chartDataForGender: ChartData,
  category: keyof typeof CategoryCodes | undefined,
  childAgeInWeeks: number,
  childAgeInMonths: number,
) {
  if (!category || !chartDataForGender[category]) {
    return undefined;
  }

  const datasetEntries = Object.entries(chartDataForGender[category].datasets);
  if (!datasetEntries.length) {
    return undefined;
  }

  const measurementDataset = selectMeasurementAxisDataset(datasetEntries, childAgeInMonths);
  if (measurementDataset) {
    return measurementDataset;
  }

  const weekDataset = datasetEntries.find(([, value]) => {
    const { xAxisLabel, range } = value.metadata;
    return xAxisLabel === TimeUnitCodes.weeks && childAgeInWeeks >= range.start && childAgeInWeeks < range.end;
  });

  if (weekDataset) {
    return weekDataset[0];
  }

  const monthDataset = datasetEntries.find(([, value]) => {
    const { xAxisLabel, range } = value.metadata;
    return xAxisLabel === TimeUnitCodes.months && childAgeInMonths >= range.start && childAgeInMonths < range.end;
  });

  if (monthDataset) {
    return monthDataset[0];
  }

  return datasetEntries.reduce((closest, current) =>
    current[1].metadata.range.end > closest[1].metadata.range.end ? current : closest,
  )[0];
}

export function getMeasurementXValue(
  entry: GrowthMeasurementEntry,
  category: keyof typeof CategoryCodes,
  dataset: string | undefined,
  dateOfBirth: Date,
) {
  if (isWeightForLengthHeightCategory(category)) {
    return toFiniteNumber(entry.dataValues.height);
  }

  const ageValues = getAgeValues(entry.eventDate, dateOfBirth);
  if (!ageValues) {
    return null;
  }

  if (dataset === DataSetLabels.w_0_13) {
    return Number(ageValues.weeks.toFixed(2));
  }

  return Number(ageValues.months.toFixed(2));
}

export function isMeasurementUsableForDataset(
  entry: GrowthMeasurementEntry,
  category: keyof typeof CategoryCodes,
  dataset: string | undefined,
  dateOfBirth: Date,
  xValue: number,
  range: { start: number; end: number },
) {
  if (!isWithinRange(xValue, range)) {
    return false;
  }

  const ageValues = getAgeValues(entry.eventDate, dateOfBirth);
  if (!ageValues) {
    return false;
  }

  switch (dataset) {
    case DataSetLabels.w_0_13:
      return ageValues.weeks >= 0 && ageValues.weeks <= 13;
    case DataSetLabels.y_0_2:
      return ageValues.months >= 0 && ageValues.months < 24;
    case DataSetLabels.y_2_5:
      return ageValues.months >= 24 && ageValues.months <= 60;
    case DataSetLabels.y_0_5:
      return ageValues.months >= 0 && ageValues.months <= 60;
    default:
      return isWeightForLengthHeightCategory(category);
  }
}

export function getReferenceLineXValue(index: number, startIndex: number) {
  return startIndex + index;
}

export function toFiniteNumber(value: string | number | undefined) {
  const numberValue = typeof value === 'number' ? value : Number.parseFloat(value ?? '');
  return Number.isFinite(numberValue) ? numberValue : null;
}

export function isWeightForLengthHeightCategory(category: keyof typeof CategoryCodes) {
  return category === CategoryCodes.wflh_b || category === CategoryCodes.wflh_g;
}

export function getGrowthChartInterpretation({
  category,
  xValue,
  measurementValue,
  zScoreDatasetValues,
  startIndex,
}: {
  category: keyof typeof CategoryCodes;
  xValue: number;
  measurementValue: number;
  zScoreDatasetValues: Array<Record<string, number>>;
  startIndex: number;
}): GrowthChartInterpretation | null {
  const referenceRow = getInterpolatedZScoreReferenceRow(zScoreDatasetValues, xValue, startIndex);
  if (!referenceRow) {
    return null;
  }

  const zScore = estimateZScore(measurementValue, referenceRow);
  if (zScore === null) {
    return null;
  }

  const code = getInterpretationCode(category, zScore);
  return {
    zScore,
    code,
    severity: getInterpretationSeverity(code),
  };
}

export function formatZScore(zScore: number) {
  const roundedValue = Number(zScore.toFixed(1));
  return (roundedValue > 0 ? '+' : '') + roundedValue.toFixed(1);
}

function selectMeasurementAxisDataset(
  datasetEntries: Array<[string, ChartData[string]['datasets'][string]]>,
  childAgeInMonths: number,
) {
  const measurementEntries = datasetEntries.filter(([, value]) =>
    measurementAxisLabels.includes(value.metadata.xAxisLabel),
  );

  if (!measurementEntries.length) {
    return undefined;
  }

  const preferredAxis = childAgeInMonths < 24 ? MeasurementTypeCodesLabel.length : MeasurementTypeCodesLabel.height;
  return (
    measurementEntries.find(([, value]) => value.metadata.xAxisLabel === preferredAxis)?.[0] ?? measurementEntries[0][0]
  );
}

function getAgeValues(date: Date | string, dateOfBirth: Date) {
  const measurementDate = new Date(date);
  const diff = measurementDate.getTime() - dateOfBirth.getTime();

  if (Number.isNaN(diff) || diff < 0) {
    return null;
  }

  const days = diff / MS_PER_DAY;
  return {
    weeks: days / 7,
    months: days / DAYS_PER_MONTH,
  };
}

function isWithinRange(value: number, range: { start: number; end: number }) {
  return value >= range.start - RANGE_TOLERANCE && value <= range.end + RANGE_TOLERANCE;
}

function getInterpolatedZScoreReferenceRow(
  zScoreDatasetValues: Array<Record<string, number>>,
  xValue: number,
  startIndex: number,
) {
  if (!zScoreDatasetValues.length) {
    return null;
  }

  const position = xValue - startIndex;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);

  if (lowerIndex < 0 || upperIndex >= zScoreDatasetValues.length) {
    return null;
  }

  const lowerRow = zScoreDatasetValues[lowerIndex];
  const upperRow = zScoreDatasetValues[upperIndex];
  const ratio = upperIndex === lowerIndex ? 0 : position - lowerIndex;
  const interpolatedRow: Record<string, number> = {};

  zScoreReferencePoints.forEach(({ key }) => {
    const lowerValue = toFiniteNumber(lowerRow[key]);
    const upperValue = toFiniteNumber(upperRow[key]);

    if (lowerValue !== null && upperValue !== null) {
      interpolatedRow[key] = lowerValue + (upperValue - lowerValue) * ratio;
    }
  });

  return Object.keys(interpolatedRow).length ? interpolatedRow : null;
}

function estimateZScore(measurementValue: number, referenceRow: Record<string, number>) {
  const referencePoints = zScoreReferencePoints
    .map(({ key, zScore }) => {
      const value = toFiniteNumber(referenceRow[key]);
      return value === null ? null : { value, zScore };
    })
    .filter((point): point is { value: number; zScore: number } => point !== null)
    .sort((left, right) => left.value - right.value);

  if (referencePoints.length < 2) {
    return null;
  }

  const exactPoint = referencePoints.find((point) => Math.abs(point.value - measurementValue) <= RANGE_TOLERANCE);
  if (exactPoint) {
    return exactPoint.zScore;
  }

  if (measurementValue < referencePoints[0].value) {
    return interpolateZScore(referencePoints[0], referencePoints[1], measurementValue);
  }

  const lastIndex = referencePoints.length - 1;
  if (measurementValue > referencePoints[lastIndex].value) {
    return interpolateZScore(referencePoints[lastIndex - 1], referencePoints[lastIndex], measurementValue);
  }

  for (let index = 0; index < referencePoints.length - 1; index++) {
    const lowerPoint = referencePoints[index];
    const upperPoint = referencePoints[index + 1];

    if (measurementValue >= lowerPoint.value && measurementValue <= upperPoint.value) {
      return interpolateZScore(lowerPoint, upperPoint, measurementValue);
    }
  }

  return null;
}

function interpolateZScore(
  lowerPoint: { value: number; zScore: number },
  upperPoint: { value: number; zScore: number },
  measurementValue: number,
) {
  if (Math.abs(upperPoint.value - lowerPoint.value) <= RANGE_TOLERANCE) {
    return lowerPoint.zScore;
  }

  const ratio = (measurementValue - lowerPoint.value) / (upperPoint.value - lowerPoint.value);
  return lowerPoint.zScore + (upperPoint.zScore - lowerPoint.zScore) * ratio;
}

function getInterpretationCode(
  category: keyof typeof CategoryCodes,
  zScore: number,
): GrowthChartInterpretationCode {
  if (isWeightForLengthHeightCategory(category)) {
    if (zScore <= -3) return 'severeWasting';
    if (zScore < -2) return 'moderateWasting';
    if (zScore >= 3) return 'obesity';
    if (zScore > 2) return 'overweight';
    return 'normal';
  }

  if (category === CategoryCodes.wfa_b || category === CategoryCodes.wfa_g) {
    if (zScore <= -3) return 'veryLowWeight';
    if (zScore < -2) return 'lowWeight';
    if (zScore >= 3) return 'veryHighWeight';
    if (zScore > 2) return 'highWeight';
    return 'normal';
  }

  if (category === CategoryCodes.lhfa_b || category === CategoryCodes.lhfa_g) {
    if (zScore <= -3) return 'veryShortStature';
    if (zScore < -2) return 'shortStature';
    if (zScore > 2) return 'tallStature';
    return 'normal';
  }

  if (category === CategoryCodes.hcfa_b || category === CategoryCodes.hcfa_g) {
    if (zScore <= -3) return 'veryLowHeadCircumference';
    if (zScore < -2) return 'lowHeadCircumference';
    if (zScore >= 3) return 'veryHighHeadCircumference';
    if (zScore > 2) return 'highHeadCircumference';
  }

  return 'normal';
}

function getInterpretationSeverity(code: GrowthChartInterpretationCode): GrowthChartInterpretationSeverity {
  switch (code) {
    case 'normal':
      return 'normal';
    case 'lowWeight':
    case 'highWeight':
    case 'moderateWasting':
    case 'overweight':
    case 'shortStature':
    case 'tallStature':
    case 'lowHeadCircumference':
    case 'highHeadCircumference':
      return 'warning';
    default:
      return 'critical';
  }
}
