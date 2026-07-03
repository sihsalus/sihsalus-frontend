import { LineChart } from '@carbon/charts-react';
import { InlineNotification, Tab, TabListVertical, TabPanel, TabPanels, TabsVertical, Tag } from '@carbon/react';
import { age } from '@openmrs/esm-framework';
import classNames from 'classnames';
import { differenceInMonths, differenceInWeeks } from 'date-fns';
import type { TFunction } from 'i18next';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  type CategoryCodes,
  DataSetLabels,
  GenderCodes,
  MeasurementTypeCodes,
  MeasurementTypeCodesLabel,
  TimeUnitCodes,
} from './data-sets';
import { chartData as rawChartData } from './data-sets/WhoStandardDataSets/ChartData';
import styles from './growth-chart.scss';
import { buildGrowthChartOptions } from './growth-chart-options';
import {
  formatZScore,
  getGrowthChartInterpretation,
  type GrowthChartInterpretationCode,
  type GrowthChartInterpretationSeverity,
  type GrowthChartPoint,
  getMeasurementXValue,
  isMeasurementUsableForDataset,
  isWeightForLengthHeightCategory,
  toFiniteNumber,
} from './growth-chart-utils';
import { useAppropriateChartData } from './hooks/useAppropriateChartData';
import { useChartDataForGender } from './hooks/useChartDataForGender';
import { useChartLines } from './hooks/useChartLines';

const DEFAULT_METADATA = {
  chartLabel: '',
  yAxisLabel: '',
  xAxisLabel: '',
  range: { start: 0, end: 0 },
};

const REFERENCE_LINE_COLORS = {
  P3: '#da1e28',
  P97: '#da1e28',
  P15: '#ff832b',
  P85: '#ff832b',
  P50: '#198038',
  SD3: '#da1e28',
  SD3neg: '#da1e28',
  SD2: '#ff832b',
  SD2neg: '#ff832b',
  SD1: '#f1c21b',
  SD1neg: '#f1c21b',
  SD0: '#198038',
};

interface GrowthChartProps {
  measurementData: Array<{ eventDate: Date; dataValues: Record<string, string> }>;
  patientName: string;
  gender: string;
  dateOfBirth: Date;
  isPercentiles: boolean; // Nueva prop para controlar el modo desde el padre
}

interface GrowthChartCategoryItem {
  id: string;
  title: string;
  value: keyof typeof CategoryCodes;
}

const GrowthChart: React.FC<GrowthChartProps> = ({
  measurementData,
  patientName,
  gender,
  dateOfBirth,
  isPercentiles,
}) => {
  const { t } = useTranslation();

  const memoizedChartData = useMemo(() => rawChartData, []);
  const { chartDataForGender } = useChartDataForGender(gender, memoizedChartData);
  const currentDate = useMemo(() => new Date(), []);

  const categories: GrowthChartCategoryItem[] = useMemo(
    () =>
      Object.entries(chartDataForGender).map(([key, value]) => ({
        id: key,
        title: value.categoryMetadata?.label ?? key,
        value: key as keyof typeof CategoryCodes,
      })),
    [chartDataForGender],
  );

  const [selectedCategory, setSelectedCategory] = useState<GrowthChartCategoryItem | undefined>(categories[0]);

  useEffect(() => {
    if (!categories.length) {
      setSelectedCategory(undefined);
      return;
    }

    setSelectedCategory((currentCategory) => {
      if (currentCategory && categories.some((category) => category.value === currentCategory.value)) {
        return currentCategory;
      }

      return categories[0];
    });
  }, [categories]);

  const selectedCategoryValue = selectedCategory?.value ?? categories[0]?.value;
  const selectedCategoryKey = selectedCategoryValue ?? ('wfa_b' as keyof typeof CategoryCodes);
  const selectedCategoryIndex = useMemo(
    () =>
      Math.max(
        categories.findIndex((category) => category.value === selectedCategoryValue),
        0,
      ),
    [categories, selectedCategoryValue],
  );

  const handleCategoryChange = useCallback(
    ({ selectedIndex }: { selectedIndex: number }) => {
      const nextCategory = categories[selectedIndex];
      if (nextCategory) {
        setSelectedCategory(nextCategory);
      }
    },
    [categories],
  );

  const childAgeInWeeks = useMemo(() => differenceInWeeks(currentDate, dateOfBirth), [currentDate, dateOfBirth]);
  const childAgeInMonths = useMemo(() => differenceInMonths(currentDate, dateOfBirth), [currentDate, dateOfBirth]);

  const { selectedDataset } = useAppropriateChartData(
    chartDataForGender,
    selectedCategoryValue ?? '',
    gender,
    childAgeInWeeks,
    childAgeInMonths,
  );

  const dataSetEntry = useMemo(
    () => (selectedDataset ? chartDataForGender[selectedCategoryKey]?.datasets?.[selectedDataset] : undefined),
    [chartDataForGender, selectedCategoryKey, selectedDataset],
  );
  const datasetMetadata = dataSetEntry?.metadata ?? DEFAULT_METADATA;

  const dataSetValues = useMemo(
    () => (isPercentiles ? (dataSetEntry?.percentileDatasetValues ?? []) : (dataSetEntry?.zScoreDatasetValues ?? [])),
    [dataSetEntry, isPercentiles],
  );

  const keysDataSet = useMemo(() => Object.keys(dataSetValues[0] ?? {}), [dataSetValues]);
  const measurementCode = MeasurementTypeCodes[selectedCategoryKey];

  const startIndex = useMemo(
    () => determineStartIndex(selectedCategoryKey, selectedDataset, datasetMetadata.range.start),
    [selectedCategoryKey, selectedDataset, datasetMetadata.range.start],
  );

  const chartLineData = useChartLines(dataSetValues, keysDataSet, startIndex);

  const measurementPlotData = useMemo<GrowthChartPoint[]>(() => {
    const measurementDataValues: { x: number; y: number; eventDate: Date }[] = [];

    if (!measurementData) return [];

    const processEntry = (entry: { eventDate: Date; dataValues: Record<string, string> }) => {
      const xValue = getMeasurementXValue(entry, selectedCategoryKey, selectedDataset, dateOfBirth);
      const yValue =
        selectedCategoryKey === 'wflh_b' || selectedCategoryKey === 'wflh_g'
          ? toFiniteNumber(entry.dataValues.weight)
          : toFiniteNumber(entry.dataValues[measurementCode]);

      if (
        xValue !== null &&
        yValue !== null &&
        isMeasurementUsableForDataset(
          entry,
          selectedCategoryKey,
          selectedDataset,
          dateOfBirth,
          xValue,
          datasetMetadata.range,
        )
      ) {
        measurementDataValues.push({ x: xValue, y: yValue, eventDate: new Date(entry.eventDate) });
      }
    };

    measurementData.forEach(processEntry);
    return measurementDataValues
      .sort((left, right) => left.eventDate.getTime() - right.eventDate.getTime())
      .map((point) => ({
        group: patientName,
        date: point.x,
        value: point.y,
        eventDate: point.eventDate,
        isPatientMeasurement: true,
      }));
  }, [
    measurementData,
    measurementCode,
    selectedCategoryKey,
    selectedDataset,
    patientName,
    dateOfBirth,
    datasetMetadata.range,
  ]);

  const hasPatientMeasurements = measurementPlotData.length > 0;
  const latestMeasurement = useMemo(() => {
    return measurementPlotData.reduce<GrowthChartPoint | undefined>((latest, entry) => {
      const entryTime = entry.eventDate?.getTime();
      const latestTime = latest?.eventDate?.getTime();

      if (entryTime === undefined || Number.isNaN(entryTime)) {
        return latest;
      }

      return latestTime === undefined || Number.isNaN(latestTime) || entryTime > latestTime ? entry : latest;
    }, undefined);
  }, [measurementPlotData]);

  const latestInterpretation = useMemo(() => {
    if (!latestMeasurement) {
      return null;
    }

    return getGrowthChartInterpretation({
      category: selectedCategoryKey,
      xValue: latestMeasurement.date,
      measurementValue: latestMeasurement.value,
      zScoreDatasetValues: dataSetEntry?.zScoreDatasetValues ?? [],
      startIndex,
    });
  }, [dataSetEntry?.zScoreDatasetValues, latestMeasurement, selectedCategoryKey, startIndex]);

  const data = useMemo(() => [...chartLineData, ...measurementPlotData], [chartLineData, measurementPlotData]);
  const colorScale = useMemo<Record<string, string>>(() => {
    const dataGroups = new Set(data.map((entry) => entry.group));
    const visibleReferenceLineColors = Object.fromEntries(
      Object.entries(REFERENCE_LINE_COLORS).filter(([group]) => dataGroups.has(group)),
    );

    return {
      ...visibleReferenceLineColors,
      ...(hasPatientMeasurements ? { [patientName]: '#2b6693' } : {}),
    };
  }, [data, hasPatientMeasurements, patientName]);

  const yValues = useMemo(
    () => [
      ...dataSetValues.flatMap((entry) =>
        Object.values(entry).filter((value): value is number => typeof value === 'number' && Number.isFinite(value)),
      ),
      ...measurementPlotData.map((entry) => entry.value),
    ],
    [dataSetValues, measurementPlotData],
  );

  const yDomain = useMemo<[number, number]>(() => {
    if (!yValues.length) {
      return [0, 1];
    }

    const lowerBound = Math.min(...yValues);
    const upperBound = Math.max(...yValues);
    const padding = Math.max((upperBound - lowerBound) * 0.08, 1);
    return [Math.max(0, Math.floor(lowerBound - padding)), Math.ceil(upperBound + padding)];
  }, [yValues]);

  const chartTitle = selectedCategory?.title ?? datasetMetadata.chartLabel;
  const translatedXAxisLabel = useMemo(
    () => translateAxisLabel(datasetMetadata.xAxisLabel, t),
    [datasetMetadata.xAxisLabel, t],
  );
  const translatedYAxisLabel = useMemo(
    () => translateAxisLabel(datasetMetadata.yAxisLabel, t),
    [datasetMetadata.yAxisLabel, t],
  );
  const rangeUnitLabel = useMemo(
    () => getRangeUnitLabel(datasetMetadata.xAxisLabel, t),
    [datasetMetadata.xAxisLabel, t],
  );

  const options = useMemo(
    () =>
      buildGrowthChartOptions({
        chartTitle,
        colorScale,
        translatedXAxisLabel,
        translatedYAxisLabel,
        yDomain,
        tooltipHtml: (datum) =>
          buildTooltipHtml(datum, {
            patientName,
            xAxisLabel: translatedXAxisLabel,
            yAxisLabel: translatedYAxisLabel,
          }),
      }),
    [chartTitle, colorScale, patientName, translatedXAxisLabel, translatedYAxisLabel, yDomain],
  );

  if (!selectedCategoryValue || !dataSetEntry) {
    return (
      <div className={styles.growthChartContainer}>
        <InlineNotification
          kind="warning"
          lowContrast
          title={t('growthChartUnavailable', 'Growth chart unavailable')}
          subtitle={t(
            'growthChartUnavailableSubtitle',
            'No WHO reference dataset is available for the patient sex or selected indicator.',
          )}
        />
      </div>
    );
  }

  return (
    <div className={styles.growthChartContainer}>
      <div className={styles.growthArea}>
        <div className={styles.chartSummary}>
          <div className={styles.growthLabel}>
            <Tag type="gray" className={styles.modeTag}>
              {isPercentiles ? t('percentileMode', 'Percentiles') : t('zScoreMode', 'Z-Scores')}
            </Tag>
            <Tag type={gender === GenderCodes.CGC_Female ? 'magenta' : 'blue'}>
              {gender === GenderCodes.CGC_Female ? t('female', 'Femenino') : t('male', 'Masculino')}
            </Tag>
            <Tag type="gray" className={classNames('ml-2', styles.datasetTag)}>
              {age(dateOfBirth, currentDate)}
            </Tag>
            <Tag type="teal" className={styles.datasetTag}>
              {datasetMetadata.range.start}-{datasetMetadata.range.end} {rangeUnitLabel}
            </Tag>
            {latestInterpretation ? (
              <Tag type={getInterpretationTagType(latestInterpretation.severity)} className={styles.datasetTag}>
                {t('latestZScore', 'Z-score')} {formatZScore(latestInterpretation.zScore)}
              </Tag>
            ) : null}
          </div>
          <div className={styles.summaryText}>
            <span>{t('whoGrowthReference', 'Estándares OMS de crecimiento infantil')}</span>
            <span>
              {t('availableMeasurementsCount', '{{count}} mediciones útiles', {
                count: measurementPlotData.length,
              })}
            </span>
            {latestMeasurement ? (
              <span>
                {t('latestMeasurementDate', 'Última medición')}: {latestMeasurement.eventDate?.toLocaleDateString()}
              </span>
            ) : null}
            {latestInterpretation ? (
              <span>
                {t('growthInterpretation', 'Interpretación referencial')}: {translateInterpretationCode(latestInterpretation.code, t)}
              </span>
            ) : null}
          </div>
        </div>
        <TabsVertical selectedIndex={selectedCategoryIndex} onChange={handleCategoryChange}>
          <TabListVertical aria-label={t('growthChartTabs', 'Indicadores de crecimiento')}>
            {categories.map(({ id, title, value }) => (
              <Tab
                className={classNames(styles.tab, styles.bodyLong01, {
                  [styles.selectedTab]: selectedCategoryValue === value,
                })}
                id={`${id}-tab`}
                key={id}
                onClick={() => setSelectedCategory({ id, title, value })}
              >
                {title}
              </Tab>
            ))}
          </TabListVertical>
          <TabPanels>
            {categories.map(({ id, value }) => (
              <TabPanel key={id}>
                {value === selectedCategoryValue ? (
                  <>
                    {hasPatientMeasurements ? null : (
                      <InlineNotification
                        className={styles.emptyMeasurementNotice}
                        kind="info"
                        lowContrast
                        title={t('noMeasurementsForSelectedChart', 'Sin mediciones para este indicador')}
                        subtitle={t(
                          'noMeasurementsForSelectedChartSubtitle',
                          'Se muestran las curvas de referencia, pero no hay mediciones utilizables del paciente para este gráfico.',
                        )}
                      />
                    )}
                    <LineChart
                      data={data}
                      options={options}
                      key={`${id}-${selectedDataset}-${isPercentiles ? 'percentile' : 'zscore'}`}
                    />
                  </>
                ) : null}
              </TabPanel>
            ))}
          </TabPanels>
        </TabsVertical>
      </div>
    </div>
  );
};

function determineStartIndex(
  category: keyof typeof CategoryCodes,
  dataset: string | undefined,
  metadataRangeStart: number,
) {
  const adjustIndex = dataset === DataSetLabels.y_2_5 ? 24 : 0;
  return isWeightForLengthHeightCategory(category) ? metadataRangeStart : adjustIndex;
}

function translateAxisLabel(label: string, t: TFunction) {
  switch (label) {
    case TimeUnitCodes.weeks:
      return t('weeksAxisLabel', 'Semanas');
    case TimeUnitCodes.months:
      return t('monthsAxisLabel', 'Meses');
    case MeasurementTypeCodesLabel.weight:
      return t('weightKgAxisLabel', 'Peso (kg)');
    case MeasurementTypeCodesLabel.length:
      return t('lengthCmAxisLabel', 'Longitud (cm)');
    case MeasurementTypeCodesLabel.height:
      return t('heightCmAxisLabel', 'Talla (cm)');
    case MeasurementTypeCodesLabel.headCircumference:
      return t('headCircumferenceCmAxisLabel', 'Perímetro cefálico (cm)');
    default:
      return label;
  }
}

function getInterpretationTagType(severity: GrowthChartInterpretationSeverity): 'red' | 'warm-gray' | 'green' {
  switch (severity) {
    case 'critical':
      return 'red';
    case 'warning':
      return 'warm-gray';
    default:
      return 'green';
  }
}

function translateInterpretationCode(code: GrowthChartInterpretationCode, t: TFunction) {
  switch (code) {
    case 'veryLowWeight':
      return t('growthInterpretationVeryLowWeight', 'Peso muy bajo para la edad');
    case 'lowWeight':
      return t('growthInterpretationLowWeight', 'Bajo peso para la edad');
    case 'highWeight':
      return t('growthInterpretationHighWeight', 'Peso alto para la edad');
    case 'veryHighWeight':
      return t('growthInterpretationVeryHighWeight', 'Peso muy alto para la edad');
    case 'severeWasting':
      return t('growthInterpretationSevereWasting', 'Desnutrición aguda severa');
    case 'moderateWasting':
      return t('growthInterpretationModerateWasting', 'Desnutrición aguda moderada');
    case 'overweight':
      return t('growthInterpretationOverweight', 'Sobrepeso');
    case 'obesity':
      return t('growthInterpretationObesity', 'Obesidad');
    case 'veryShortStature':
      return t('growthInterpretationVeryShortStature', 'Talla muy baja para la edad');
    case 'shortStature':
      return t('growthInterpretationShortStature', 'Talla baja para la edad');
    case 'tallStature':
      return t('growthInterpretationTallStature', 'Talla alta para la edad');
    case 'veryLowHeadCircumference':
      return t('growthInterpretationVeryLowHeadCircumference', 'Perímetro cefálico muy bajo para la edad');
    case 'lowHeadCircumference':
      return t('growthInterpretationLowHeadCircumference', 'Perímetro cefálico bajo para la edad');
    case 'highHeadCircumference':
      return t('growthInterpretationHighHeadCircumference', 'Perímetro cefálico alto para la edad');
    case 'veryHighHeadCircumference':
      return t('growthInterpretationVeryHighHeadCircumference', 'Perímetro cefálico muy alto para la edad');
    default:
      return t('growthInterpretationNormal', 'Dentro del rango esperado');
  }
}

function getRangeUnitLabel(label: string, t: TFunction) {
  switch (label) {
    case TimeUnitCodes.weeks:
      return t('weeks', 'semanas');
    case TimeUnitCodes.months:
      return t('months', 'meses');
    case MeasurementTypeCodesLabel.length:
    case MeasurementTypeCodesLabel.height:
    case MeasurementTypeCodesLabel.headCircumference:
      return t('centimetersAbbreviation', 'cm');
    default:
      return '';
  }
}

function buildTooltipHtml(
  datum: GrowthChartPoint | undefined,
  labels: { patientName: string; xAxisLabel: string; yAxisLabel: string },
) {
  if (!datum) {
    return '';
  }

  const isPatientMeasurement = datum.isPatientMeasurement || datum.group === labels.patientName;
  const group = escapeHtml(String(datum.group));
  const xValue = escapeHtml(formatChartNumber(datum.date));
  const yValue = escapeHtml(formatChartNumber(datum.value));

  if (isPatientMeasurement) {
    const measurementDate = datum.eventDate ? new Date(datum.eventDate).toLocaleDateString() : '';
    return `<div class="cds--tooltip cds--tooltip--shown" style="min-width:max-content;font-weight:600">
      ${group}
      <div style="color:#c6c6c6;font-size:1rem;font-weight:400">${escapeHtml(measurementDate)}</div>
      <div style="font-size:0.875rem;font-weight:400">${escapeHtml(labels.xAxisLabel)}: ${xValue}</div>
      <div style="font-size:0.875rem;font-weight:400">${escapeHtml(labels.yAxisLabel)}: ${yValue}</div>
    </div>`;
  }

  return `<div class="cds--tooltip cds--tooltip--shown" style="min-width:max-content;font-weight:600">
    ${group}
    <div style="font-size:0.875rem;font-weight:400">${escapeHtml(labels.xAxisLabel)}: ${xValue}</div>
    <div style="font-size:0.875rem;font-weight:400">${escapeHtml(labels.yAxisLabel)}: ${yValue}</div>
  </div>`;
}

function formatChartNumber(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(2);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default GrowthChart;
