import { LineChart, ScaleTypes } from '@carbon/charts-react';
import { Tab, TabList, Tabs } from '@carbon/react';
import { formatDate, parseDate } from '@openmrs/esm-framework';
import classNames from 'classnames';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { LabourHistoryTableRow } from '../../../common/types';

import styles from './labour-history-chart.scss';

interface LabourHistoryChartProps {
  patientHistory: Array<LabourHistoryTableRow>;
}

interface ChartMetric {
  title: string;
  value: keyof LabourHistoryTableRow;
}

const LabourHistoryChart: React.FC<LabourHistoryChartProps> = ({ patientHistory }) => {
  const { t } = useTranslation();
  const [selectedMetric, setSelectedMetric] = useState<ChartMetric>({
    title: t('maternalPulse', 'Maternal Pulse (bpm)'),
    value: 'maternalPulse',
  });

  const chartMetrics: ChartMetric[] = [
    { title: t('maternalPulse', 'Maternal Pulse (bpm)'), value: 'maternalPulse' },
    { title: t('systolicBP', 'Systolic BP (mmHg)'), value: 'systolicBP' },
    { title: t('diastolicBP', 'Diastolic BP (mmHg)'), value: 'diastolicBP' },
    { title: t('temperatureCelsius', 'Temperature (°C)'), value: 'temperature' },
    { title: t('maternalWeight', 'Maternal Weight (Kg)'), value: 'maternalWeight' },
    { title: t('gestationalAge', 'Gestational Age (weeks)'), value: 'gestationalAge' },
    { title: t('fetalHeartRateBpm', 'Fetal heart rate (bpm)'), value: 'fetalHeartRate' },
    { title: t('uterineHeightCm', 'Uterine height (cm)'), value: 'uterineHeight' },
    { title: t('dilatation', 'Dilatation (cm)'), value: 'dilatation' },
  ];

  const chartData = useMemo(() => {
    return patientHistory
      .filter((entry) => entry[selectedMetric.value] && !Number.isNaN(Number(entry[selectedMetric.value])))
      .slice(0, 10)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((entry) => ({
        group: selectedMetric.title,
        key: formatDate(parseDate(entry.date), { year: false }),
        value: Number(entry[selectedMetric.value]),
        date: entry.date,
      }));
  }, [patientHistory, selectedMetric]);

  const chartOptions = {
    title: selectedMetric.title,
    axes: {
      bottom: { title: t('date', 'Date'), mapsTo: 'key', scaleType: ScaleTypes.LABELS },
      left: { mapsTo: 'value', title: selectedMetric.title, scaleType: ScaleTypes.LINEAR, includeZero: false },
    },
    legend: { enabled: false },
    color: { scale: { [selectedMetric.title]: '#6929c4' } },
    tooltip: {
      customHTML: ([{ value, group, key }]) =>
        `<div class="cds--tooltip cds--tooltip--shown" style="min-width: max-content; font-weight:600">${value} - ${String(group).toUpperCase()}
        <span style="color: #c6c6c6; font-size: 1rem; font-weight:600">${key}</span></div>`,
    },
    height: '400px',
  };

  return (
    <div className={styles.chartContainer}>
      <div className={styles.metricsArea}>
        <label className={styles.metricLabel}>{t('labourMetricDisplayed', 'Labour History Metric')}</label>
        <div className={styles.verticalTabs}>
          <Tabs>
            <TabList className={styles.tablist} aria-label="Labour History Metrics tabs">
              {chartMetrics.map(({ title, value }) => (
                <Tab
                  className={classNames(styles.tab, { [styles.selectedTab]: selectedMetric.title === title })}
                  key={value}
                  onClick={() => setSelectedMetric({ title, value })}
                >
                  {title}
                </Tab>
              ))}
            </TabList>
          </Tabs>
        </div>
      </div>
      <div className={styles.chartArea}>
        <LineChart data={chartData} options={chartOptions} />
      </div>
    </div>
  );
};

export default LabourHistoryChart;
