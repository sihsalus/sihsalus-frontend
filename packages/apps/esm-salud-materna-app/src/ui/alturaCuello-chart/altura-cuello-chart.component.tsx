import { LineChart, ScaleTypes } from '@carbon/charts-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tag } from '@carbon/react';
import { formatDate } from '@openmrs/esm-framework';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import '@carbon/charts-react/styles.css';
import styles from './altura-cuello-chart.scss';

interface PacienteDataPoint {
  uuid: string;
  semana: number;
  altura: number;
  fecha: string;
}

interface AlturaCuelloChartProps {
  measurementData: PacienteDataPoint[];
  patientName: string;
}

/** Plots recorded measurements; clinical reference curves require a validated source. */
const AlturaCuelloChart: React.FC<AlturaCuelloChartProps> = ({ measurementData, patientName }) => {
  const { t } = useTranslation('@sihsalus/esm-salud-materna-app');
  const measurements = useMemo(
    () =>
      measurementData
        .filter(
          (point) =>
            Number.isFinite(point.semana) &&
            point.semana > 0 &&
            Number.isFinite(point.altura) &&
            point.altura > 0 &&
            Number.isFinite(Date.parse(point.fecha)),
        )
        .sort((a, b) => a.semana - b.semana || Date.parse(a.fecha) - Date.parse(b.fecha)),
    [measurementData],
  );
  const chartData = useMemo(
    () =>
      measurements.map((point) => ({
        group: t('maternalRecordedMeasurements'),
        week: point.semana,
        value: point.altura,
      })),
    [measurements, t],
  );
  const options = useMemo(
    () => ({
      title: t('uterineHeightChart'),
      axes: {
        bottom: { title: t('gestationalWeeks'), mapsTo: 'week', scaleType: ScaleTypes.LINEAR },
        left: { title: t('uterineHeightCm'), mapsTo: 'value', scaleType: ScaleTypes.LINEAR },
      },
      points: { enabled: true },
      legend: { enabled: false },
      height: '320px',
    }),
    [t],
  );

  return (
    <div className={styles.chartContainer}>
      <div className={styles.chartArea}>
        <Tag type="blue">{patientName}</Tag>
        <p>{t('maternalMeasurementsHelp')}</p>
        {chartData.length ? (
          <>
            <LineChart data={chartData} options={options} />
            <Table size="sm" aria-label={t('maternalRecordedMeasurements')}>
              <TableHead>
                <TableRow>
                  <TableHeader>{t('maternalMeasurementDate')}</TableHeader>
                  <TableHeader>{t('gestationalWeeks')}</TableHeader>
                  <TableHeader>{t('uterineHeightCm')}</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {measurements.map((point) => (
                  <TableRow key={point.uuid}>
                    <TableCell>{formatDate(new Date(point.fecha))}</TableCell>
                    <TableCell>{point.semana}</TableCell>
                    <TableCell>{point.altura}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        ) : (
          <p>{t('noMeasurementDataAvailable')}</p>
        )}
      </div>
    </div>
  );
};

export default AlturaCuelloChart;
