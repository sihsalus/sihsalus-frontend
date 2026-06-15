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

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const DAYS_PER_MONTH = 30.44;
const RANGE_TOLERANCE = 0.001;

const measurementAxisLabels = Object.values(MeasurementTypeCodesLabel) as string[];

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
