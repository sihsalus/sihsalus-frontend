// altura-cuello-overview.component.tsx
import { Button, DataTableSkeleton, InlineLoading } from '@carbon/react';
import { Add } from '@carbon/react/icons';
import { CardHeader, EmptyState, ErrorState } from '@openmrs/esm-patient-common-lib';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { RequirePrivilege } from '@sihsalus/esm-rbac';
import { prenatalCareEditPrivilege } from '../../constants';
import { usePrenatalMeasurements } from '../../hooks/usePrenatalMeasurements';
import { useMaternalFormLauncher } from '../../hooks/useMaternalFormLauncher';
import { getSafePatientName } from '../../utils/utils';

import AlturaCuelloChart from './altura-cuello-chart.component';
import styles from './altura-cuello-overview.scss';

interface AlturaCuelloOverviewProps {
  patient: fhir.Patient;
  patientUuid: string;
}

const AlturaCuelloOverview: React.FC<AlturaCuelloOverviewProps> = ({ patient, patientUuid }) => {
  const { t } = useTranslation('@sihsalus/esm-salud-materna-app');

  const headerTitle = t('obstetricalCharts', 'Obstetrical Charts');
  const displayText = t('noMeasurementDataAvailable', 'No hay datos de mediciones disponibles');
  const patientName = getSafePatientName(patient);

  // Hook para obtener datos de mediciones prenatales
  const { data, isLoading, error, mutate } = usePrenatalMeasurements(patientUuid);
  const { launchForm: launchPrenatalForm } = useMaternalFormLauncher(
    'atencionPrenatal',
    t('prenatalAttention'),
    patientUuid,
  );
  const launchForm = useCallback(() => launchPrenatalForm('', () => void mutate()), [launchPrenatalForm, mutate]);

  // Transformar datos para el componente de gráfico
  const measurementData = useMemo(() => {
    if (!data?.length) return [];

    return data
      .map((measurement) => ({
        uuid: measurement.uuid,
        semana: measurement.gestationalWeek || 0,
        altura: measurement.uterineHeight || 0,
        fecha: measurement.date,
      }))
      .filter((item) => item.semana > 0 && item.altura > 0);
  }, [data]);

  if (isLoading) {
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
            <RequirePrivilege privilege={prenatalCareEditPrivilege} hideUnauthorized>
              <Button
                kind="ghost"
                renderIcon={(props) => <Add size={16} {...props} />}
                onClick={launchForm}
                aria-label={t('addMeasurement', 'Agregar medición')}
              >
                {t('add', 'Add')}
              </Button>
            </RequirePrivilege>
          )}
        </CardHeader>

        <AlturaCuelloChart measurementData={measurementData} patientName={patientName} />
      </div>
    );
  }

  return (
    <RequirePrivilege
      privilege={prenatalCareEditPrivilege}
      fallback={<EmptyState displayText={displayText} headerTitle={headerTitle} />}
    >
      <EmptyState displayText={displayText} headerTitle={headerTitle} launchForm={launchForm} />
    </RequirePrivilege>
  );
};

export default AlturaCuelloOverview;
