import { LineChart } from '@carbon/charts-react';
import { Tab, TabList, Tabs } from '@carbon/react';
import { formatDate, parseDate } from '@openmrs/esm-framework';
import classNames from 'classnames';
import React, { useId, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import styles from './clinical-data-chart.scss';

enum ScaleTypes {
  LABELS = 'labels',
  LINEAR = 'linear',
  TIME = 'time',
}

interface ClinicalDataChartProps {
  patientData: Array<{
    date: string;
    [key: string]: string | number | null;
  }>;
  conceptUnits: Map<string, string>;
  vitalSigns: Array<{
    id: string;
    title: string;
    value: string;
  }>;
  mappings: { [key: string]: string };
  maxDataPoints?: number; // Nuevo prop opcional para limitar datos
}

const ClinicalDataChart: React.FC<ClinicalDataChartProps> = ({
  patientData,
  conceptUnits,
  vitalSigns,
  mappings,
  maxDataPoints = Infinity, // Por defecto, no hay límite
}) => {
  const { t } = useTranslation();
  const id = useId();
  const [selectedVitalSign, setSelectedVitalSign] = React.useState(vitalSigns[0]);

  const chartData = useMemo(() => {
    return patientData
      .filter((data) => data[selectedVitalSign.value])
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, maxDataPoints) // Usar slice en lugar de splice para no mutar el array
      .map((data) => {
        if (selectedVitalSign.value === 'systolic' && mappings['diastolic']) {
          return [
            {
              group: t('systolic', 'Systolic'),
              key: formatDate(parseDate(data.date), { year: false }),
              value: data.systolic,
              date: data.date,
            },
            {
              group: t('diastolic', 'Diastolic'),
              key: formatDate(parseDate(data.date), { year: false }),
              value: data[mappings['diastolic']],
              date: data.date,
            },
          ];
        }
        return {
          group: selectedVitalSign.title,
          key: formatDate(parseDate(data.date), { year: false }),
          value: data[selectedVitalSign.value],
          date: data.date,
        };
      })
      .flat(); // Aplanar el array para manejar casos como presión arterial
  }, [patientData, selectedVitalSign, mappings, maxDataPoints, t]);

  const chartOptions = {
    title: selectedVitalSign.title,
    axes: {
      bottom: {
        title: t('date', 'Date'),
        mapsTo: 'key',
        scaleType: ScaleTypes.LABELS,
      },
      left: {
        mapsTo: 'value',
        title: `${selectedVitalSign.title} (${conceptUnits.get(selectedVitalSign.value) || ''})`,
        scaleType: ScaleTypes.LINEAR,
        includeZero: false,
      },
    },
    legend: {
      enabled: mappings['diastolic'] && selectedVitalSign.value === 'systolic', // Mostrar leyenda solo si hay múltiples grupos
    },
    color: {
      scale: {
        [t('systolic', 'Systolic')]: '#6929c4',
        [t('diastolic', 'Diastolic')]: '#0066cc',
        [selectedVitalSign.title]: '#6929c4',
      },
    },
    tooltip: {
      customHTML: ([{ value, group, key }]): string =>
        `<div class="cds--tooltip cds--tooltip--shown" style="min-width: max-content; font-weight:600">${value} - ${group.toUpperCase()}
        <span style="color: #c6c6c6; font-size: 1rem; font-weight:600">${key}</span></div>`,
    },
    height: '400px',
  };

  return (
    <div className={styles.clinicalDataChartContainer}>
      <div className={styles.vitalSignsArea}>
        <label className={styles.vitalsSignLabel} htmlFor={`${id}-tabs`}>
          {t('dataDisplayed', 'Data displayed')}
        </label>
        <Tabs>
          <TabList className={styles.tablist} aria-label={t('dataTabs', 'Data selection tabs')} id={`${id}-tabs`}>
            {vitalSigns.map(({ id, title, value }) => (
              <Tab
                className={classNames(styles.tab, { [styles.selectedTab]: selectedVitalSign.title === title })}
                key={id}
                onClick={() => setSelectedVitalSign({ id, title, value })}
              >
                {title}
              </Tab>
            ))}
          </TabList>
        </Tabs>
      </div>
      <div className={styles.clinicalDataChartArea}>
        <LineChart data={chartData} options={chartOptions} />
      </div>
    </div>
  );
};

export default ClinicalDataChart;
