import { LineChart } from '@carbon/charts-react';
import { Tab, TabListVertical, TabPanel, TabPanels, Tabs } from '@carbon/react';
import { formatDate, parseDate } from '@openmrs/esm-framework';
import React, { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { type PatientVitalsAndBiometrics, useIsMobileChartLayout } from '../common';
import { type ConfigObject } from '../config-schema';

import styles from './biometrics-chart.scss';

enum ScaleTypes {
  LINEAR = 'linear',
  TIME = 'time',
}

interface BiometricsChartProps {
  conceptUnits: Map<string, string>;
  config: ConfigObject;
  patientBiometrics: Array<PatientVitalsAndBiometrics>;
  showMuac?: boolean;
}

interface BiometricChartData {
  id: string;
  title: string;
  value: string;
  groupName: 'Weight' | 'Height' | 'Body mass index' | string;
}

const chartColors = {
  weight: '#6929c4',
  height: '#6929c4',
  bmi: '#6929c4',
  muac: '#6929c4',
  abdominalCircumference: '#6929c4',
};

const BiometricsChart: React.FC<BiometricsChartProps> = ({ patientBiometrics, conceptUnits, config, showMuac = true }) => {
  const { t } = useTranslation();
  const biometricLabelId = useId();
  const isMobileChartLayout = useIsMobileChartLayout();
  const { abdominalCircumferenceUnit, bmiUnit } = config.biometrics;
  const biometricOptions: Array<BiometricChartData> = [
    {
      id: 'weight',
      title: `${t('weight', 'Weight')} (${conceptUnits.get(config.concepts.weightUuid) ?? ''})`,
      value: 'weight',
      groupName: 'weight',
    },
    {
      id: 'height',
      title: `${t('height', 'Height')} (${conceptUnits.get(config.concepts.heightUuid) ?? ''})`,
      value: 'height',
      groupName: 'height',
    },
    { id: 'bmi', title: `${t('bmi', 'BMI')} (${bmiUnit})`, value: 'bmi', groupName: 'bmi' },
    ...(showMuac
      ? [
          {
            id: 'muac',
            title: `${t('muac', 'MUAC')} (${conceptUnits.get(config.concepts.midUpperArmCircumferenceUuid) ?? ''})`,
            value: 'muac',
            groupName: 'muac',
          },
        ]
      : []),
    {
      id: 'abdominalCircumference',
      title: `${t('abdominalCircumference', 'Abdominal circumference')} (${
        conceptUnits.get(config.concepts.abdominalCircumferenceUuid) ?? abdominalCircumferenceUnit
      })`,
      value: 'abdominalCircumference',
      groupName: 'abdominalCircumference',
    },
  ];
  const [selectedBiometricId, setSelectedBiometricId] = useState('weight');
  const selectedBiometrics =
    biometricOptions.find((biometric) => biometric.id === selectedBiometricId) ?? biometricOptions[0];
  const selectedBiometricIndex = Math.max(
    0,
    biometricOptions.findIndex((biometric) => biometric.id === selectedBiometricId),
  );

  const chartData = useMemo(
    () =>
      patientBiometrics
        .filter((biometrics) => biometrics[selectedBiometrics.value] != null)
        .slice(0, 10)
        .sort((biometricA, biometricB) => new Date(biometricA.date).getTime() - new Date(biometricB.date).getTime())
        .map((biometric) => {
          return (
            biometric[selectedBiometrics.value] != null && {
              group: selectedBiometrics.groupName,
              key: formatDate(parseDate(biometric.date), { year: true }),
              value: biometric[selectedBiometrics.value],
              date: biometric.date,
            }
          );
        }),
    [patientBiometrics, selectedBiometrics.groupName, selectedBiometrics.value],
  );

  const chartOptions = useMemo(() => {
    return {
      title: selectedBiometrics.title,
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
          title: selectedBiometrics.title,
          scaleType: ScaleTypes.LINEAR,
          includeZero: false,
        },
      },
      legend: {
        enabled: false,
      },
      color: {
        scale: chartColors,
      },
      tooltip: {
        customHTML: ([{ value, date }]) =>
          `<div class="cds--tooltip cds--tooltip--shown" style="min-width: max-content; font-weight:600">${formatDate(
            parseDate(date),
            { year: true },
          )} -
          <span style="color: #c6c6c6; font-size: 1rem; font-weight:400">${value}</span></div>`,
      },
      fileDownload: {
        fileName: t('biometricsChartFileName', 'biometrics-chart'),
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
  }, [selectedBiometrics, t]);

  return (
    <div className={styles.biometricChartContainer}>
      <Tabs
        selectedIndex={selectedBiometricIndex}
        onChange={({ selectedIndex }) => {
          const selectedBiometric = biometricOptions[selectedIndex];
          if (selectedBiometric) {
            setSelectedBiometricId(selectedBiometric.id);
          }
        }}
      >
        <div className={styles.biometricsArea}>
          <span className={styles.biometricLabel} id={biometricLabelId}>
            {t('biometricDisplayed', 'Biometric displayed')}
          </span>
          <div className={styles.tablistWrapper} data-chart-tablist-wrapper="">
            <TabListVertical
              className={styles.tablist}
              aria-labelledby={biometricLabelId}
              aria-orientation={isMobileChartLayout ? 'horizontal' : 'vertical'}
            >
              {biometricOptions.map(({ id, title }) => (
                <Tab key={id}>{title}</Tab>
              ))}
            </TabListVertical>
          </div>
        </div>
        <TabPanels>
          {biometricOptions.map(({ id }, index) => (
            <TabPanel className={styles.biometricsChartArea} key={id}>
              {selectedBiometricIndex === index ? <LineChart data={chartData} options={chartOptions} /> : null}
            </TabPanel>
          ))}
        </TabPanels>
      </Tabs>
    </div>
  );
};

export default BiometricsChart;
