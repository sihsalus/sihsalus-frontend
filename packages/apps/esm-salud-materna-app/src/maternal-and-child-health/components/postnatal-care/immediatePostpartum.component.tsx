import { useConfig } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ConfigObject } from '../../../config-schema';
import { useInmmediatePostpartumPeriod } from '../../../hooks/useInmmediatePostpartum';
import CareSummaryTable from '../../../ui/care-summary-table/care-summary-table.component';

const ImmediatePostpartumTable: React.FC<{ patientUuid: string }> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const config = useConfig() as ConfigObject;

  const rowDefinitions = [
    { id: 'fecha', rowHeader: t('fechaYHoraAtencion', 'Fecha y hora atención'), prefix: 'encounterDatetime' },
    { id: 'temperature', rowHeader: t('temperatureCelsius', 'Temperature (°C)'), prefix: 'Temperatura (C°)' },
    {
      id: 'frecuenciaCardiaca',
      rowHeader: t('frecuenciaCardiaca', 'Frecuencia Cardíaca'),
      prefix: 'Frecuencia Cardíaca',
    },
    { id: 'presionSistolica', rowHeader: t('presionSistolica', 'Presión sistólica'), prefix: 'Presión sistólica' },
    { id: 'presionDiastolica', rowHeader: t('presionDiastolica', 'Presión diastólica'), prefix: 'Presión diastólica' },
    { id: 'involucionUterina', rowHeader: t('involucionUterina', 'Involución Uterina'), prefix: 'Involución Uterina' },
    {
      id: 'caracteristicaLoquios',
      rowHeader: t('caracteristicaLoquios', 'Característica de Loquios'),
      prefix: 'Característica Loquios',
    },
    { id: 'heridaOperatoria', rowHeader: t('heridaOperatoria', 'Herida Operatoria'), prefix: 'Herida Operatoria' },
    { id: 'observacion', rowHeader: t('observacion', 'Observación'), prefix: 'Observación' },
  ];

  const headerTimes = [15, 30, 45, 60, 75, 90, 105, 120];

  const customHeaderTransform = (index: number) => (
    <>
      <div>{t(`atencion${index}`, `Atención ${index}`)}</div>
      <div style={{ fontSize: '0.8em', color: 'gray', textAlign: 'center' }}>{headerTimes[index - 1]}'</div>
    </>
  );

  return (
    <CareSummaryTable
      patientUuid={patientUuid}
      title={t('puerperioInmediato', 'Puerperio Inmediato')}
      emptyStateText={t('noDataAvailableDescription', 'No data available')}
      formUuid={config.formsList.immediatePostpartumPeriod}
      useEncountersHook={useInmmediatePostpartumPeriod}
      rowDefinitions={rowDefinitions}
      customHeaderTransform={customHeaderTransform}
    />
  );
};

export default ImmediatePostpartumTable;
