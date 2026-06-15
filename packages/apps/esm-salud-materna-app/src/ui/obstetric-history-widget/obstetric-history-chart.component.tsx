// obstetric-history-chart.component.tsx
import { LineChart, ScaleTypes } from '@carbon/charts-react';
import { Tab, TabListVertical, TabPanel, TabPanels, TabsVertical, Tile } from '@carbon/react';
import { formatDate, parseDate } from '@openmrs/esm-framework';
import classNames from 'classnames';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { ConfigObject } from '../../config-schema';
import type { PatientPrenatalAntecedents } from '../../types';
import type { ObstetricDisplayDataType } from './obstetric-history.schema';
import styles from './obstetric-history-chart.scss';

interface ObstetricHistoryChartProps {
  obstetricData: ObstetricDisplayDataType;
  historicalData: PatientPrenatalAntecedents[];
  conceptUnits: Map<string, string>;
  config: ConfigObject;
}

type ObstetricMetric = 'pregnancies' | 'births' | 'abortions' | 'liveBirths';

interface ObstetricChartData {
  groupName: ObstetricMetric;
  title: string;
  value: ObstetricMetric;
}

const ObstetricHistoryChart: React.FC<ObstetricHistoryChartProps> = ({
  obstetricData,
  historicalData,
  conceptUnits: _conceptUnits,
  config: _config,
}) => {
  const { t } = useTranslation();

  const [selectedMetric, setSelectedMetric] = useState<ObstetricChartData>({
    title: t('pregnancies', 'Embarazos'),
    value: 'pregnancies',
    groupName: 'pregnancies',
  });

  // Calcular totales
  const totalBirths = obstetricData.termBirths + obstetricData.prematureBirths;

  // Configuración de métricas disponibles
  const obstetricMetrics: { id: ObstetricMetric; title: string; value: ObstetricMetric }[] = [
    {
      id: 'pregnancies',
      title: t('pregnancies', 'Embarazos'),
      value: 'pregnancies',
    },
    {
      id: 'births',
      title: t('births', 'Partos'),
      value: 'births',
    },
    {
      id: 'abortions',
      title: t('abortions', 'Abortos'),
      value: 'abortions',
    },
    {
      id: 'liveBirths',
      title: t('liveBirths', 'Live births'),
      value: 'liveBirths',
    },
  ];

  // Datos para el gráfico de tendencias
  const chartData = useMemo(() => {
    if (!historicalData?.length) return [];

    return historicalData
      .filter((data) => data[selectedMetric.value])
      .slice(0, 10)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((data) => ({
        group: selectedMetric.title,
        key: formatDate(parseDate(data.date), { year: true }),
        value: parseInt(data[selectedMetric.value], 10) || 0,
        date: data.date,
      }));
  }, [historicalData, selectedMetric]);

  // Configuración del gráfico
  const chartOptions = useMemo(
    () => ({
      title: `${t('evolutionOf', 'Evolución de')} ${selectedMetric.title}`,
      axes: {
        bottom: {
          title: t('date', 'Date'),
          mapsTo: 'date',
          scaleType: ScaleTypes.TIME,
        },
        left: {
          mapsTo: 'value',
          title: selectedMetric.title,
          scaleType: ScaleTypes.LINEAR,
          includeZero: true,
        },
      },
      legend: {
        enabled: false,
      },
      color: {
        scale: {
          [selectedMetric.title]: '#0f62fe',
        },
      },
      tooltip: {
        customHTML: ([{ value, date }]) =>
          `<div class="cds--tooltip cds--tooltip--shown" style="min-width: max-content; font-weight:600">
          ${formatDate(parseDate(date), { year: true })} -
          <span style="color: #c6c6c6; font-size: 1rem; font-weight:400">${value}</span>
        </div>`,
      },
      height: '300px',
    }),
    [selectedMetric, t],
  );

  return (
    <div className={styles.obstetricChartContainer}>
      {/* Tarjetas de resumen */}
      <div className={styles.summaryCards}>
        <div className={styles.formulaObstetrica}>
          <h4 className={styles.formulaTitle}>{t('obstetricFormula', 'Fórmula Obstétrica')}</h4>
          <div className={styles.formulaDisplay}>
            <span className={styles.formulaItem}>
              <span className={styles.formulaLetter}>G</span>
              <span className={styles.formulaValue}>{obstetricData.pregnancies}</span>
            </span>
            <span className={styles.formulaSeparator}>-</span>
            <span className={styles.formulaItem}>
              <span className={styles.formulaLetter}>P</span>
              <span className={styles.formulaValue}>{totalBirths}</span>
            </span>
            <span className={styles.formulaSeparator}>-</span>
            <span className={styles.formulaItem}>
              <span className={styles.formulaLetter}>A</span>
              <span className={styles.formulaValue}>{obstetricData.abortions}</span>
            </span>
            <span className={styles.formulaSeparator}>-</span>
            <span className={styles.formulaItem}>
              <span className={styles.formulaLetter}>V</span>
              <span className={styles.formulaValue}>{obstetricData.liveBirths}</span>
            </span>
          </div>
        </div>

        <div className={styles.cardsGrid}>
          <Tile className={styles.summaryCard}>
            <div className={styles.cardContent}>
              <div className={styles.cardValue}>{obstetricData.pregnancies}</div>
              <div className={styles.cardLabel}>{t('pregnancies', 'Embarazos')}</div>
            </div>
          </Tile>

          <Tile className={styles.summaryCard}>
            <div className={styles.cardContent}>
              <div className={styles.cardValue}>{totalBirths}</div>
              <div className={styles.cardLabel}>{t('births', 'Partos')}</div>
            </div>
          </Tile>

          <Tile className={styles.summaryCard}>
            <div className={styles.cardContent}>
              <div className={styles.cardValue}>{obstetricData.abortions}</div>
              <div className={styles.cardLabel}>{t('abortions', 'Abortos')}</div>
            </div>
          </Tile>

          <Tile className={styles.summaryCard}>
            <div className={styles.cardContent}>
              <div className={styles.cardValue}>{obstetricData.liveBirths}</div>
              <div className={styles.cardLabel}>{t('liveBirths', 'Live births')}</div>
            </div>
          </Tile>
        </div>
      </div>

      {/* Área de gráficos con tabs */}
      <div className={styles.chartArea}>
        <div className={styles.chartSection}>
          <label className={styles.metricLabel} htmlFor="obstetric-chart-tabs">
            {t('metricDisplayed', 'Métrica mostrada')}
          </label>

          <TabsVertical>
            <TabListVertical aria-label="Obstetric metrics tabs">
              {obstetricMetrics.map(({ id, title, value }) => (
                <Tab
                  className={classNames(styles.tab, styles.bodyLong01, {
                    [styles.selectedTab]: selectedMetric.title === title,
                  })}
                  id={`${id}-tab`}
                  key={id}
                  onClick={() =>
                    setSelectedMetric({
                      title: title,
                      value: value,
                      groupName: id,
                    })
                  }
                >
                  {title}
                </Tab>
              ))}
            </TabListVertical>

            <TabPanels>
              {obstetricMetrics.map(({ id }) => (
                <TabPanel key={id}>
                  {chartData.length > 0 ? (
                    <LineChart data={chartData} options={chartOptions} />
                  ) : (
                    <div className={styles.noDataMessage}>
                      <p>{t('noHistoricalData', 'No hay datos históricos disponibles para esta métrica')}</p>
                    </div>
                  )}
                </TabPanel>
              ))}
            </TabPanels>
          </TabsVertical>
        </div>
      </div>

      {/* Breakdown detallado */}
      <div className={styles.breakdownSection}>
        <h5 className={styles.sectionTitle}>{t('detailedBreakdown', 'Desglose Detallado')}</h5>

        <div className={styles.breakdownGrid}>
          <div className={styles.breakdownCategory}>
            <h6>{t('birthTypes', 'Tipos de Parto')}</h6>
            <div className={styles.breakdownItems}>
              <div className={styles.breakdownItem}>
                <span className={styles.itemLabel}>{t('termBirths', 'A término')}</span>
                <span className={styles.itemValue}>{obstetricData.termBirths}</span>
              </div>
              <div className={styles.breakdownItem}>
                <span className={styles.itemLabel}>{t('prematureBirths', 'Prematuros')}</span>
                <span className={styles.itemValue}>{obstetricData.prematureBirths}</span>
              </div>
            </div>
          </div>

          <div className={styles.breakdownCategory}>
            <h6>{t('outcomes', 'Resultados')}</h6>
            <div className={styles.breakdownItems}>
              <div className={styles.breakdownItem}>
                <span className={styles.itemLabel}>{t('liveBirths', 'Live births')}</span>
                <span className={styles.itemValue}>{obstetricData.liveBirths}</span>
              </div>
              <div className={styles.breakdownItem}>
                <span className={styles.itemLabel}>{t('stillBirths', 'Nacidos muertos')}</span>
                <span className={styles.itemValue}>{obstetricData.stillBirths}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ObstetricHistoryChart;
