import { LineChart, ScaleTypes } from '@carbon/charts-react';
import { InlineNotification, Tab, TabList, Tabs } from '@carbon/react';
import classNames from 'classnames';
import type { TFunction } from 'i18next';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import styles from './partograph-chart.scss';
import {
  buildPartographChartData,
  type PartographChartPoint,
  type PartographMetricKey,
  type PartographRecord,
} from './partograph-utils';

interface PartographChartProps {
  partographRecords: PartographRecord[];
}

interface PartographMetric {
  id: PartographMetricKey;
  label: string;
  axisLabel: string;
  color: string;
  includeZero: boolean;
}

const PartographChart: React.FC<PartographChartProps> = ({ partographRecords = [] }) => {
  const { t } = useTranslation();
  const metrics = useMemo(() => getPartographMetrics(t), [t]);
  const [selectedMetricIndex, setSelectedMetricIndex] = useState(0);
  const selectedMetric = metrics[selectedMetricIndex] ?? metrics[0];

  const chartData = useMemo(
    () => buildPartographChartData(partographRecords, selectedMetric.id, selectedMetric.label),
    [partographRecords, selectedMetric],
  );

  const latestValue = chartData.at(-1)?.displayValue;
  const chartOptions = useMemo(
    () => ({
      title: selectedMetric.label,
      axes: {
        bottom: {
          title: t('time', 'Hora'),
          mapsTo: 'date',
          scaleType: ScaleTypes.TIME,
        },
        left: {
          mapsTo: 'value',
          title: selectedMetric.axisLabel,
          scaleType: ScaleTypes.LINEAR,
          includeZero: selectedMetric.includeZero,
        },
      },
      legend: {
        enabled: false,
      },
      color: {
        scale: {
          [selectedMetric.label]: selectedMetric.color,
        },
      },
      tooltip: {
        customHTML: (tooltipData: PartographChartPoint[]) => buildTooltipHtml(tooltipData[0], selectedMetric.axisLabel),
      },
      toolbar: {
        enabled: true,
        numberOfIcons: 4,
        controls: [
          { type: 'Zoom in' },
          { type: 'Zoom out' },
          { type: 'Reset zoom' },
          { type: 'Export as CSV' },
          { type: 'Export as PNG' },
          { type: 'Make fullscreen' },
        ],
      },
      zoomBar: {
        top: {
          enabled: true,
        },
      },
      height: '400px',
      points: {
        enabled: true,
        radius: 3,
      },
    }),
    [selectedMetric, t],
  );

  return (
    <div className={styles.vitalsChartContainer}>
      <div className={styles.partographSignsArea}>
        <label className={styles.vitalsSignLabel} htmlFor="partography-chart-tab-group">
          {t('partographyDisplay', 'Indicador del partograma')}
        </label>
        <Tabs
          selectedIndex={selectedMetricIndex}
          onChange={({ selectedIndex }) => setSelectedMetricIndex(selectedIndex)}
        >
          <TabList className={styles.tablist} aria-label={t('partographyData', 'Datos del partograma')}>
            {metrics.map((metric) => (
              <Tab
                key={metric.id}
                className={classNames(styles.tab, styles.bodyLong01, {
                  [styles.selectedTab]: selectedMetric.id === metric.id,
                })}
              >
                <span>{metric.label}</span>
                {selectedMetric.id === metric.id && latestValue ? (
                  <span className={styles.latestValue}>{latestValue}</span>
                ) : null}
              </Tab>
            ))}
          </TabList>
        </Tabs>
      </div>
      <div className={styles.vitalsChartArea}>
        {chartData.length ? (
          <LineChart data={chartData} options={chartOptions} />
        ) : (
          <InlineNotification
            className={styles.emptyMetricNotice}
            kind="info"
            lowContrast
            title={t('noPartographMetricData', 'Sin datos para este indicador')}
            subtitle={t(
              'noPartographMetricDataSubtitle',
              'El partograma tiene registros, pero no hay valores numéricos utilizables para este indicador.',
            )}
          />
        )}
      </div>
    </div>
  );
};

function getPartographMetrics(t: TFunction): PartographMetric[] {
  return [
    {
      id: 'fetalHeartRate',
      label: t('fetalHeartRate', 'Frecuencia cardíaca fetal'),
      axisLabel: t('fetalHeartRateBpm', 'Frecuencia cardíaca fetal (lpm)'),
      color: '#2b6693',
      includeZero: false,
    },
    {
      id: 'cervicalDilation',
      label: t('cervicalDilation', 'Dilatación cervical'),
      axisLabel: t('cervicalDilationCm', 'Dilatación cervical (cm)'),
      color: '#198038',
      includeZero: true,
    },
    {
      id: 'descentOfHeadValue',
      label: t('descentOfHead', 'Descenso de cabeza'),
      axisLabel: t('descentOfHeadFifths', 'Descenso de cabeza (quintos)'),
      color: '#8a3ffc',
      includeZero: true,
    },
    {
      id: 'contractionFrequency',
      label: t('contractionFrequency', 'Contracciones /10 min'),
      axisLabel: t('contractionFrequencyPer10Min', 'Contracciones /10 min'),
      color: '#ff832b',
      includeZero: true,
    },
    {
      id: 'contractionDuration',
      label: t('contractionDuration', 'Duración de contracción'),
      axisLabel: t('contractionDurationSeconds', 'Duración (s)'),
      color: '#da1e28',
      includeZero: true,
    },
  ];
}

function buildTooltipHtml(datum: PartographChartPoint | undefined, axisLabel: string) {
  if (!datum) {
    return '';
  }

  return `<div class="cds--tooltip cds--tooltip--shown" style="min-width:max-content;font-weight:600">
    ${escapeHtml(datum.group)}
    <div style="color:#c6c6c6;font-size:1rem;font-weight:400">${escapeHtml(datum.date.toLocaleString())}</div>
    <div style="font-size:0.875rem;font-weight:400">${escapeHtml(axisLabel)}: ${escapeHtml(datum.displayValue)}</div>
  </div>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default PartographChart;
