import { LineChart, ScaleTypes } from '@carbon/charts-react';
import { InlineNotification, Tab, TabListVertical, TabPanel, TabPanels, TabsVertical, Tag } from '@carbon/react';
import { age } from '@openmrs/esm-framework';
import classNames from 'classnames';
import { differenceInMonths, differenceInWeeks } from 'date-fns';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { type CategoryCodes, DataSetLabels, GenderCodes, MeasurementTypeCodes } from './data-sets';
import { chartData as rawChartData } from './data-sets/WhoStandardDataSets/ChartData';
import styles from './growth-chart.scss';
import { useAppropriateChartData } from './hooks/useAppropriateChartData';
import { useChartDataForGender } from './hooks/useChartDataForGender';
import { useChartLines } from './hooks/useChartLines';

const DEFAULT_METADATA = {
  chartLabel: '',
  yAxisLabel: '',
  xAxisLabel: '',
  range: { start: 0, end: 0 },
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const DAYS_PER_MONTH = 30.44;

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

  const childAgeInWeeks = useMemo(() => differenceInWeeks(new Date(), dateOfBirth), [dateOfBirth]);
  const childAgeInMonths = useMemo(() => differenceInMonths(new Date(), dateOfBirth), [dateOfBirth]);

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

  const chartLineData = useChartLines(dataSetValues, keysDataSet, startIndex, isPercentiles);

  const measurementPlotData = useMemo(() => {
    const measurementDataValues: { x: number; y: number; eventDate: Date }[] = [];

    if (!measurementData) return [];

    const processEntry = (entry: { eventDate: Date; dataValues: Record<string, string> }) => {
      const xValue = getMeasurementXValue(entry, selectedCategoryKey, selectedDataset, dateOfBirth);
      const yValue =
        selectedCategoryKey === 'wflh_b' || selectedCategoryKey === 'wflh_g'
          ? toFiniteNumber(entry.dataValues.weight)
          : toFiniteNumber(entry.dataValues[measurementCode]);

      if (xValue !== null && yValue !== null) {
        measurementDataValues.push({ x: xValue, y: yValue, eventDate: new Date(entry.eventDate) });
      }
    };

    measurementData.forEach(processEntry);
    return measurementDataValues
      .sort((left, right) => left.eventDate.getTime() - right.eventDate.getTime())
      .map((point) => ({ group: patientName, date: point.x, value: point.y }));
  }, [measurementData, measurementCode, selectedCategoryKey, selectedDataset, patientName, dateOfBirth]);

  const hasPatientMeasurements = measurementPlotData.length > 0;
  const latestMeasurement = useMemo(() => {
    return measurementData
      ?.map((entry) => ({ ...entry, eventDate: new Date(entry.eventDate) }))
      .filter((entry) => !Number.isNaN(entry.eventDate.getTime()))
      .sort((left, right) => right.eventDate.getTime() - left.eventDate.getTime())[0];
  }, [measurementData]);

  const data = useMemo(() => [...chartLineData, ...measurementPlotData], [chartLineData, measurementPlotData]);
  const yValues = useMemo(
    () => [
      ...dataSetValues.flatMap((entry) =>
        Object.values(entry).filter((value): value is number => typeof value === 'number' && Number.isFinite(value)),
      ),
      ...measurementPlotData.map((entry) => entry.value),
    ],
    [dataSetValues, measurementPlotData],
  );

  const yDomain = useMemo(() => {
    if (!yValues.length) {
      return [0, 1];
    }

    const lowerBound = Math.min(...yValues);
    const upperBound = Math.max(...yValues);
    const padding = Math.max((upperBound - lowerBound) * 0.08, 1);
    return [Math.max(0, Math.floor(lowerBound - padding)), Math.ceil(upperBound + padding)];
  }, [yValues]);

  const options = useMemo(
    () => ({
      title: datasetMetadata.chartLabel,
      axes: {
        bottom: {
          title: datasetMetadata.xAxisLabel,
          mapsTo: 'date',
          scaleType: ScaleTypes.LINEAR,
        },
        left: {
          title: datasetMetadata.yAxisLabel,
          mapsTo: 'value',
          scaleType: ScaleTypes.LINEAR,
          domain: yDomain,
        },
      },
      legend: { enabled: true },
      tooltip: { enabled: true },
      height: '400px',
      points: { enabled: true, radius: 2 },
      color: {
        scale: {
          ...REFERENCE_LINE_COLORS,
          ...(hasPatientMeasurements ? { [patientName]: '#2b6693' } : {}),
        },
      },
    }),
    [datasetMetadata, yDomain, patientName, hasPatientMeasurements],
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
              {age(dateOfBirth, new Date())}
            </Tag>
            <Tag type="teal" className={styles.datasetTag}>
              {datasetMetadata.range.start}-{datasetMetadata.range.end}{' '}
              {datasetMetadata.xAxisLabel === 'Weeks' ? t('weeks', 'weeks') : t('months', 'months')}
            </Tag>
          </div>
          <div className={styles.summaryText}>
            <span>{t('whoGrowthReference', 'WHO Child Growth Standards')}</span>
            <span>
              {t('availableMeasurementsCount', '{{count}} measurements', {
                count: measurementPlotData.length,
              })}
            </span>
            {latestMeasurement ? (
              <span>
                {t('latestMeasurementDate', 'Latest measurement')}: {latestMeasurement.eventDate.toLocaleDateString()}
              </span>
            ) : null}
          </div>
        </div>
        <TabsVertical>
          <TabListVertical aria-label="Growth Chart vertical tabs">
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
            {categories.map(({ id }) => (
              <TabPanel key={id}>
                {hasPatientMeasurements ? null : (
                  <InlineNotification
                    className={styles.emptyMeasurementNotice}
                    kind="info"
                    lowContrast
                    title={t('noMeasurementsForSelectedChart', 'No measurements for this indicator')}
                    subtitle={t(
                      'noMeasurementsForSelectedChartSubtitle',
                      'Reference curves are shown, but the patient has no usable measurements for the selected chart.',
                    )}
                  />
                )}
                <LineChart data={data} options={options} key={`${id}-${isPercentiles ? 'percentile' : 'zscore'}`} />
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
  const isWFLH = category === 'wflh_b' || category === 'wflh_g';
  return isWFLH ? metadataRangeStart : adjustIndex;
}

function getMeasurementXValue(
  entry: { eventDate: Date; dataValues: Record<string, string> },
  category: keyof typeof CategoryCodes,
  dataset: string | undefined,
  dateOfBirth: Date,
) {
  if (category === 'wflh_b' || category === 'wflh_g') {
    return toFiniteNumber(entry.dataValues.height);
  }

  const obsDate = new Date(entry.eventDate);
  const diff = obsDate.getTime() - dateOfBirth.getTime();

  if (Number.isNaN(diff) || diff < 0) {
    return null;
  }

  const days = diff / MS_PER_DAY;

  if (dataset === DataSetLabels.w_0_13) {
    return Number((days / 7).toFixed(2));
  }

  return Number((days / DAYS_PER_MONTH).toFixed(2));
}

function toFiniteNumber(value: string | number | undefined) {
  const numberValue = typeof value === 'number' ? value : Number.parseFloat(value ?? '');
  return Number.isFinite(numberValue) ? numberValue : null;
}

export default GrowthChart;
