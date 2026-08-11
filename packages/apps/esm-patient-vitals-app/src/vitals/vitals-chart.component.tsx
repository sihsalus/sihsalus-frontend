import { LineChart } from '@carbon/charts-react';
import { Tab, TabListVertical, TabPanel, TabPanels, Tabs } from '@carbon/react';
import { formatDate, parseDate } from '@openmrs/esm-framework';
import React, { useId, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { type PatientVitalsAndBiometrics, useIsMobileChartLayout, withUnit } from '../common';
import { type ConfigObject } from '../config-schema';

import styles from './vitals-chart.scss';

enum ScaleTypes {
  LINEAR = 'linear',
  TIME = 'time',
}

interface VitalsChartProps {
  conceptUnits: Map<string, string>;
  config: ConfigObject;
  patientVitals: Array<PatientVitalsAndBiometrics>;
}

interface VitalsChartData {
  id: string;
  title: string;
  value: string;
}

const VitalsChart: React.FC<VitalsChartProps> = ({ patientVitals, conceptUnits, config }) => {
  const { t } = useTranslation();
  const vitalSignsLabelId = useId();
  const isMobileChartLayout = useIsMobileChartLayout();
  const [selectedVitalSignId, setSelectedVitalSignId] = React.useState('bloodPressure');

  const vitalSigns: Array<VitalsChartData> = [
    {
      id: 'bloodPressure',
      title: withUnit(t('bp', 'BP'), conceptUnits.get(config.concepts.systolicBloodPressureUuid) ?? '-'),
      value: 'systolic',
    },
    {
      id: 'oxygenSaturation',
      title: withUnit(t('spo2', 'SpO2'), conceptUnits.get(config.concepts.oxygenSaturationUuid) ?? '-'),
      value: 'spo2',
    },
    {
      id: 'temperature',
      title: withUnit(t('temp', 'Temp'), conceptUnits.get(config.concepts.temperatureUuid) ?? '-'),
      value: 'temperature',
    },
    {
      id: 'respiratoryRate',
      title: withUnit(t('respiratoryRate', 'R. rate'), conceptUnits.get(config.concepts.respiratoryRateUuid) ?? '-'),
      value: 'respiratoryRate',
    },
    {
      id: 'pulse',
      title: withUnit(t('pulse', 'Pulse'), conceptUnits.get(config.concepts.pulseUuid) ?? '-'),
      value: 'pulse',
    },
  ];
  const selectedVitalSign = vitalSigns.find((vitalSign) => vitalSign.id === selectedVitalSignId) ?? vitalSigns[0];
  const selectedVitalSignIndex = Math.max(
    0,
    vitalSigns.findIndex((vitalSign) => vitalSign.id === selectedVitalSignId),
  );

  const chartData = useMemo(() => {
    return patientVitals
      .filter((vitals) => vitals[selectedVitalSign.value] != null)
      .slice(0, 10)
      .sort((vitalA, vitalB) => new Date(vitalA.date).getTime() - new Date(vitalB.date).getTime())
      .flatMap((vitals) => {
        if (vitals[selectedVitalSign.value] != null) {
          if (['systolic', 'diastolic'].includes(selectedVitalSign.value)) {
            return [
              {
                group: 'Systolic blood pressure',
                key: formatDate(parseDate(vitals.date.toString()), { year: true }),
                value: vitals.systolic,
                date: vitals.date,
              },
              {
                group: 'Diastolic blood pressure',
                key: formatDate(parseDate(vitals.date.toString()), { year: true }),
                value: vitals.diastolic,
                date: vitals.date,
              },
            ];
          } else {
            return {
              group: selectedVitalSign.title,
              key: formatDate(parseDate(vitals.date.toString())),
              value: vitals[selectedVitalSign.value],
              date: vitals.date,
            };
          }
        }

        return [];
      });
  }, [patientVitals, selectedVitalSign]);

  const chartOptions = {
    title: selectedVitalSign.title,
    locale: {
      translations: {
        toolbar: {
          exportAsCSV: t('exportAsCSV', 'Export to CSV'),
          exportAsPNG: t('exportAsPNG', 'Export to PNG'),
          makeFullScreen: t('makeFullscreen', 'Make fullscreen'),
          exitFullScreen: t('exitFullscreen', 'Exit fullscreen'),
        },
      },
    },
    axes: {
      bottom: {
        title: t('date', 'Date'),
        mapsTo: 'date',
        scaleType: ScaleTypes.TIME,
      },
      left: {
        mapsTo: 'value',
        title: selectedVitalSign.title,
        scaleType: ScaleTypes.LINEAR,
        includeZero: false,
      },
    },
    legend: {
      enabled: false,
    },
    color: {
      scale: {
        [selectedVitalSign.title]: '#6929c4',
      },
    },
    tooltip: {
      customHTML: ([{ value, group, key }]) =>
        `<div class="cds--tooltip cds--tooltip--shown" style="min-width: max-content; font-weight:600">${value} - ${String(
          group,
        ).toUpperCase()}
        <span style="color: #c6c6c6; font-size: 1rem; font-weight:600">${key}</span></div>`,
    },
    fileDownload: {
      fileName: t('vitalsChartFileName', 'vitals-chart'),
    },
    toolbar: {
      enabled: true,
      numberOfIcons: 4,
      controls: [
        {
          type: 'Zoom in',
        },
        {
          type: 'Zoom out',
        },
        {
          type: 'Reset zoom',
        },
        {
          type: 'Export as CSV',
        },
        {
          type: 'Export as PNG',
        },
        {
          type: 'Make fullscreen',
        },
      ],
    },
    zoomBar: {
      top: {
        enabled: true,
      },
    },
    height: '400px',
  };

  return (
    <div className={styles.vitalsChartContainer}>
      <Tabs
        selectedIndex={selectedVitalSignIndex}
        onChange={({ selectedIndex }) => {
          const selectedVitalSign = vitalSigns[selectedIndex];
          if (selectedVitalSign) {
            setSelectedVitalSignId(selectedVitalSign.id);
          }
        }}
      >
        <div className={styles.vitalSignsArea}>
          <span className={styles.vitalsSignLabel} id={vitalSignsLabelId}>
            {t('vitalSignDisplayed', 'Vital sign displayed')}
          </span>
          <div className={styles.tablistWrapper} data-chart-tablist-wrapper="">
            <TabListVertical
              className={styles.tablist}
              aria-labelledby={vitalSignsLabelId}
              aria-orientation={isMobileChartLayout ? 'horizontal' : 'vertical'}
            >
              {vitalSigns.map(({ id, title }) => (
                <Tab key={id}>{title}</Tab>
              ))}
            </TabListVertical>
          </div>
        </div>
        <TabPanels>
          {vitalSigns.map(({ id }, index) => (
            <TabPanel className={styles.vitalsChartArea} key={id}>
              {selectedVitalSignIndex === index ? <LineChart data={chartData} options={chartOptions} /> : null}
            </TabPanel>
          ))}
        </TabPanels>
      </Tabs>
    </div>
  );
};

export default VitalsChart;
