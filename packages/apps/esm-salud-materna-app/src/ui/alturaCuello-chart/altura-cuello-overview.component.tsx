// altura-cuello-overview.component.tsx
import { Button, DataTableSkeleton, InlineLoading } from '@carbon/react';
import { Add } from '@carbon/react/icons';
import { launchWorkspace2, useConfig } from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import { CardHeader, EmptyState, ErrorState } from '@openmrs/esm-patient-common-lib';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ConfigObject } from '../../config-schema';
import { usePrenatalMeasurements } from '../../hooks/usePrenatalMeasurements';
import { formEntryWorkspace } from '../../types';
import { getSafePatientName } from '../../utils/utils';

import AlturaCuelloChart from './altura-cuello-chart.component';
import styles from './altura-cuello-overview.scss';

interface AlturaCuelloOverviewProps {
  patient: fhir.Patient;
  patientUuid: string;
}

const AlturaCuelloOverview: React.FC<AlturaCuelloOverviewProps> = ({ patient, patientUuid }) => {
  const { t } = useTranslation();
  const config = useConfig<ConfigObject>();

  const headerTitle = t('obstetricalCharts', 'Obstetrical Charts');
  const displayText = t('noMeasurementDataAvailable', 'No hay datos de mediciones disponibles');
  //const formWorkspace = config.formsList?.prenatalCare || 'prenatal-measurements-form';

  const patientName = getSafePatientName(patient);

  // Hook para obtener datos de mediciones prenatales
  const { data, pregnancyStartDate, isLoading, error, mutate } = usePrenatalMeasurements(patientUuid);
  const launchForm = useCallback(() => {
    launchWorkspace2(formEntryWorkspace, {
      form: { uuid: config.formsList.atencionPrenatal },
      handlePostResponse: () => void mutate(),
    });
  }, [config.formsList.atencionPrenatal, mutate]);
  const gestationalWeeks = useMemo(
    () => (pregnancyStartDate ? dayjs().diff(dayjs(pregnancyStartDate), 'week') : undefined),
    [pregnancyStartDate],
  );

  // Transformar datos para el componente de gráfico
  const measurementData = useMemo(() => {
    if (!data?.length) return [];

    return data
      .map((measurement) => ({
        semana: measurement.gestationalWeek || 0,
        altura: measurement.uterineHeight || 0,
        fecha: measurement.date,
      }))
      .filter((item) => item.semana > 0 && item.altura > 0);
  }, [data]);

  if (isLoading && !data) {
    return <DataTableSkeleton role="progressbar" aria-label={t('loadingData', 'Loading data...')} />;
  }

  if (error) {
    return <ErrorState error={error} headerTitle={headerTitle} />;
  }

  if (measurementData?.length) {
    return (
      <div className={styles.widgetCard}>
        <CardHeader title={headerTitle}>
          {isLoading && <InlineLoading description={t('refreshing', 'Refreshing...')} status="active" />}
          {launchForm && (
            <Button
              kind="ghost"
              renderIcon={(props) => <Add size={16} {...props} />}
              onClick={launchForm}
              aria-label={t('addMeasurement', 'Agregar medición')}
            >
              {t('add', 'Add')}
            </Button>
          )}
        </CardHeader>

        <AlturaCuelloChart
          measurementData={measurementData}
          patientName={patientName}
          gestationalWeeks={gestationalWeeks}
        />
      </div>
    );
  }

  return <EmptyState displayText={displayText} headerTitle={headerTitle} launchForm={launchForm} />;
};

export default AlturaCuelloOverview;
