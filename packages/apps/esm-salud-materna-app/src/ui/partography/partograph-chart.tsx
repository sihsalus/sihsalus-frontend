import { LineChart } from '@carbon/charts-react';
import { Tab, TabList, Tabs } from '@carbon/react';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { PartograpyComponents } from '../../config-schema';

import styles from './partograph-chart.scss';

enum ScaleTypes {
  TIME = 'time',
  LINEAR = 'linear',
  LOG = 'log',
  LABELS = 'labels',
  LABELS_RATIO = 'labels-ratio',
}
interface PartographChartProps {
  partograpyComponents: Array<PartograpyComponents>;
}
interface PartographyChartData {
  title: string;
  value: string;
}
const PartographChart: React.FC<PartographChartProps> = ({ partograpyComponents = [] }) => {
  const { t } = useTranslation();
  const convertedData = partograpyComponents.map((item) => {
    const [numerator, denominator] = item.descentOfHead.split('/').map(Number);
    const result = denominator !== 0 ? (numerator / denominator) * 10 : 10;
    return { ...item, descentOfHead: result };
  });
  const [selectedPartographSign, setSelectedPartographSign] = React.useState<PartographyChartData>({
    title: `Fetal Heart Rate (${convertedData[0]?.fetalHeartRate ?? '-'})`,
    value: 'fetalHeartRate',
  });
  const partographSigns = [
    {
      id: 'fetalHeartRate',
      title: `Heart Rate ${convertedData[0]?.fetalHeartRate?.toString() ?? '-'})`,
      value: 'fetalHeartRate',
    },
    {
      id: 'cervicalDilation',
      title: `Cervical Dilation' ${convertedData[0]?.cervicalDilation?.toString() ?? '-'})`,
      value: 'cervicalDilation',
    },
    {
      id: 'descentOfHead',
      title: `Descent of Head  ${convertedData[0]?.descentOfHead?.toString() ?? '-'})`,
      value: 'descentOfHead',
    },
    {
      id: 'contractionFrequency',
      title: `Contractions /10min ${convertedData[0]?.contractionFrequency?.toString() ?? '-'})`,
      value: 'contractionFrequency',
    },
    {
      id: 'contractionDuration',
      title: `Duration (s) ${convertedData[0]?.contractionDuration?.toString() ?? '-'})`,
      value: 'contractionDuration',
    },
  ];
  const parseTodayTime = useCallback((dateString: string): string | null => {
    const dateTimeRegex = /(\d{2}:\d{2} [APMapm]{2})/;
    const match = dateString.match(dateTimeRegex);
    if (match) {
      return match[0];
    } else {
      return null;
    }
  }, []);
  const chartData = useMemo(() => {
    if (!partograpyComponents || partograpyComponents.length === 0) {
      return [];
    }
    return partograpyComponents
      .filter((partography) => partography[selectedPartographSign.value])
      .splice(0, 10)
      .sort((partoDateA, partoDateB) => new Date(partoDateA.date).getTime() - new Date(partoDateB.date).getTime())
      .map((partoData) => {
        if (partoData[selectedPartographSign.value]) {
          if ('fetalHeartRate'.includes(selectedPartographSign.value)) {
            return [
              {
                group: 'Fetal Heart Rate',
                key: parseTodayTime(partoData.date.toString()),
                value: partoData.fetalHeartRate,
                date: partoData.date,
              },
            ];
          } else {
            return {
              group: selectedPartographSign.title,
              key: parseTodayTime(partoData.date.toString()),
              value: partoData[selectedPartographSign.value],
              date: partoData.date,
            };
          }
        }

        return null;
      });
  }, [partograpyComponents, selectedPartographSign, parseTodayTime]);
  const chartOptions = {
    axes: {
      bottom: {
        title: 'Time',
        mapsTo: 'key',
        scaleType: ScaleTypes.LABELS,
      },
      left: {
        mapsTo: 'value',
        title: selectedPartographSign.title,
        scaleType: ScaleTypes.LINEAR,
        includeZero: false,
      },
    },
    legend: {
      enabled: false,
    },
    color: {
      scale: {
        [selectedPartographSign.title]: '#6929c4',
      },
    },
    tooltip: {
      customHTML: ([{ value, group, key }]) =>
        `<div class="cds--tooltip cds--tooltip--shown" style="min-width: max-content; font-weight:600">${value} - ${String(
          group,
        ).toUpperCase()}
        <span style="color: #c6c6c6; font-size: 1rem; font-weight:600">${key}</span></div>`,
    },
    height: '400px',
  };

  return (
    <div className={styles.vitalsChartContainer}>
      <div className={styles.partographSignsArea}>
        <label className={styles.vitalsSignLabel} htmlFor="partography-chart-tab-group">
          {t('partographyDisplay', 'Partography Displayed')}
        </label>
        <div className={styles.verticalTabs}>
          <Tabs>
            <TabList className={styles.tablist} aria-label="Partography  Data">
              {partographSigns.map(({ id, title, value }) => {
                return (
                  <Tab
                    key={id}
                    className={`${styles.tab} ${styles.bodyLong01} ${
                      selectedPartographSign.title === title && styles.selectedTab
                    }`}
                    onClick={() =>
                      setSelectedPartographSign({
                        title: title,
                        value: value,
                      })
                    }
                  >
                    {title}-
                  </Tab>
                );
              })}
            </TabList>
          </Tabs>
        </div>
      </div>
      <div className={styles.vitalsChartArea}>
        <LineChart data={chartData.flat()} options={chartOptions} />
      </div>
    </div>
  );
};

export default PartographChart;
