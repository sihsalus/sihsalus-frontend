// AlturaCuelloChart.tsx
import { LineChart, ScaleTypes } from '@carbon/charts-react';
import { Button, Tab, TabListVertical, TabPanel, TabPanels, TabsVertical, Tag } from '@carbon/react';
import classNames from 'classnames';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import '@carbon/charts-react/styles.css';
import styles from './altura-cuello-chart.scss';

interface PacienteDataPoint {
  semana: number;
  altura: number;
  fecha: string;
}

interface AlturaCuelloChartProps {
  measurementData: PacienteDataPoint[];
  patientName: string;
  gestationalWeeks?: number;
}

interface ChartCategoryItem {
  id: string;
  title: string;
  value: 'altura_uterina' | 'longitud_cervical';
}

// Datos de percentiles para altura uterina
const alturaUterinaPercentiles = [
  { semana: 13, p10: 8.0, p50: 10.0, p90: 12.0 },
  { semana: 14, p10: 9.0, p50: 11.5, p90: 14.0 },
  { semana: 15, p10: 10.0, p50: 12.5, p90: 15.0 },
  { semana: 16, p10: 12.0, p50: 14.5, p90: 17.0 },
  { semana: 17, p10: 13.0, p50: 15.5, p90: 18.0 },
  { semana: 18, p10: 14.0, p50: 16.5, p90: 19.0 },
  { semana: 19, p10: 14.0, p50: 17.0, p90: 20.0 },
  { semana: 20, p10: 15.0, p50: 18.0, p90: 21.0 },
  { semana: 21, p10: 16.0, p50: 19.0, p90: 22.0 },
  { semana: 22, p10: 17.0, p50: 20.0, p90: 23.0 },
  { semana: 23, p10: 18.0, p50: 20.5, p90: 23.0 },
  { semana: 24, p10: 19.0, p50: 21.5, p90: 24.0 },
  { semana: 25, p10: 20.0, p50: 22.5, p90: 25.0 },
  { semana: 26, p10: 21.0, p50: 23.5, p90: 26.0 },
  { semana: 27, p10: 21.0, p50: 24.0, p90: 27.0 },
  { semana: 28, p10: 22.0, p50: 24.5, p90: 27.0 },
  { semana: 29, p10: 23.0, p50: 25.5, p90: 28.0 },
  { semana: 30, p10: 24.0, p50: 26.5, p90: 29.0 },
  { semana: 31, p10: 25.0, p50: 27.5, p90: 30.0 },
  { semana: 32, p10: 25.0, p50: 27.5, p90: 30.0 },
  { semana: 33, p10: 26.0, p50: 28.5, p90: 31.0 },
  { semana: 34, p10: 26.0, p50: 29.0, p90: 32.0 },
  { semana: 35, p10: 27.0, p50: 30.0, p90: 33.0 },
  { semana: 36, p10: 28.0, p50: 30.5, p90: 33.0 },
  { semana: 37, p10: 29.0, p50: 31.5, p90: 34.0 },
  { semana: 38, p10: 30.0, p50: 32.0, p90: 34.0 },
  { semana: 39, p10: 31.0, p50: 33.0, p90: 35.0 },
  { semana: 40, p10: 31.0, p50: 33.0, p90: 35.0 },
];

const AlturaCuelloChart: React.FC<AlturaCuelloChartProps> = ({ measurementData, patientName, gestationalWeeks }) => {
  const { t } = useTranslation();

  // Categorías disponibles
  const categories: ChartCategoryItem[] = useMemo(
    () => [
      {
        id: 'altura_uterina',
        title: t('uterineHeight', 'Uterine height'),
        value: 'altura_uterina',
      },
    ],
    [t],
  );

  const [selectedCategory, setSelectedCategory] = useState<ChartCategoryItem>(categories[0]);
  const [isPercentiles, setIsPercentiles] = useState(true);

  // Seleccionar dataset según la categoría
  const referenceData = useMemo(() => {
    return alturaUterinaPercentiles;
  }, []);

  // Preparar datos de líneas de referencia
  const chartLineData = useMemo(() => {
    const lineData: Array<{ group: string; date: number; value: number }> = [];

    referenceData.forEach((row) => {
      if (isPercentiles) {
        lineData.push({ group: 'P10', date: row.semana, value: row.p10 });
        lineData.push({ group: 'P50', date: row.semana, value: row.p50 });
        lineData.push({ group: 'P90', date: row.semana, value: row.p90 });
      } else {
        // Z-scores (simulados para el ejemplo)
        const mean = row.p50;
        const sd = (row.p90 - row.p10) / 3.28; // Aproximación
        lineData.push({
          group: '-2 SD',
          date: row.semana,
          value: mean - 2 * sd,
        });
        lineData.push({ group: 'Media', date: row.semana, value: mean });
        lineData.push({
          group: '+2 SD',
          date: row.semana,
          value: mean + 2 * sd,
        });
      }
    });

    return lineData;
  }, [referenceData, isPercentiles]);

  // Preparar datos del paciente
  const measurementPlotData = useMemo(() => {
    if (!measurementData?.length) return [];

    return measurementData
      .filter((point) => point.altura && point.semana)
      .map((point) => ({
        group: patientName,
        date: point.semana,
        value: point.altura,
      }));
  }, [measurementData, patientName]);

  const hasPatientMeasurements = measurementPlotData.length > 0;

  // Combinar todos los datos
  const chartData = useMemo(() => [...chartLineData, ...measurementPlotData], [chartLineData, measurementPlotData]);

  // Calcular dominio del eje Y
  const { min, max } = useMemo(() => {
    const allValues = chartData.map((d) => d.value).filter((v) => typeof v === 'number');
    if (allValues.length === 0) return { min: 0, max: 100 };

    const minVal = Math.min(...allValues);
    const maxVal = Math.max(...allValues);
    const padding = (maxVal - minVal) * 0.1;

    return {
      min: Math.max(0, Math.floor(minVal - padding)),
      max: Math.ceil(maxVal + padding),
    };
  }, [chartData]);

  // Configuración del gráfico
  const chartOptions = useMemo(() => {
    const title =
      selectedCategory.value === 'altura_uterina'
        ? t('uterineHeightChart', 'Altura Uterina por Semana Gestacional')
        : t('cervicalLengthChart', 'Longitud Cervical por Semana Gestacional');

    const yAxisTitle =
      selectedCategory.value === 'altura_uterina'
        ? t('uterineHeightCm', 'Uterine height (cm)')
        : t('cervicalLengthMm', 'Longitud Cervical (mm)');

    const colorScale = isPercentiles
      ? {
          P10: '#e67300',
          P50: '#009933',
          P90: '#cc0000',
          ...(hasPatientMeasurements ? { [patientName]: '#2b6693' } : {}),
        }
      : {
          '-2 SD': '#cc0000',
          Media: '#009933',
          '+2 SD': '#cc0000',
          ...(hasPatientMeasurements ? { [patientName]: '#2b6693' } : {}),
        };

    return {
      title,
      axes: {
        bottom: {
          title: t('gestationalWeeks', 'Semanas Gestacionales'),
          mapsTo: 'date',
          scaleType: ScaleTypes.LINEAR,
        },
        left: {
          title: yAxisTitle,
          mapsTo: 'value',
          scaleType: ScaleTypes.LINEAR,
          domain: [min, max],
        },
      },
      legend: { enabled: true },
      tooltip: {
        enabled: true,
        customHTML: ([{ group, date, value }]) =>
          `<div class="cds--tooltip cds--tooltip--shown" style="min-width: max-content; font-weight:600">
            ${group} - Semana ${date}<br/>
            <span style="color: #c6c6c6; font-size: 1rem; font-weight:400">${value} ${selectedCategory.value === 'altura_uterina' ? 'cm' : 'mm'}</span>
          </div>`,
      },
      height: '400px',
      points: { enabled: false },
      color: { scale: colorScale },
    };
  }, [selectedCategory, t, min, max, patientName, isPercentiles, hasPatientMeasurements]);

  return (
    <div className={styles.chartContainer}>
      <div className={styles.chartArea}>
        <div className={styles.chartControls}>
          <Button
            size="sm"
            kind="ghost"
            onClick={() => setIsPercentiles(!isPercentiles)}
            className={styles.toggleButton}
          >
            {isPercentiles ? t('percentiles', 'Percentiles') : t('zScores', 'Z-Scores')}
          </Button>

          {gestationalWeeks && (
            <Tag type="gray" className={styles.gestationalTag}>
              {t('currentWeek', 'Semana actual')}: {gestationalWeeks}
            </Tag>
          )}

          <Tag type="blue" className={styles.patientTag}>
            {patientName}
          </Tag>
        </div>

        <TabsVertical>
          <TabListVertical aria-label="Measurement chart tabs">
            {categories.map(({ id, title, value }) => (
              <Tab
                className={classNames(styles.tab, styles.bodyLong01, {
                  [styles.selectedTab]: selectedCategory.value === value,
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
                {chartData.length > 0 ? (
                  <LineChart data={chartData} options={chartOptions} />
                ) : (
                  <div className={styles.noDataMessage}>
                    <p>{t('noDataAvailable', 'No hay datos disponibles para mostrar')}</p>
                  </div>
                )}
              </TabPanel>
            ))}
          </TabPanels>
        </TabsVertical>
      </div>
    </div>
  );
};

export default AlturaCuelloChart;
