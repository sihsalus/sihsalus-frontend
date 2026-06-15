import { useConfig } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ConfigObject } from '../../../config-schema';
import { usePrenatalCare } from '../../../hooks/usePrenatalCare';
import CareSummaryTable from '../../../ui/care-summary-table/care-summary-table.component';

const PrenatalCareChart: React.FC<{ patientUuid: string }> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const config = useConfig() as ConfigObject;

  const rowDefinitions = [
    { id: 'fecha', rowHeader: t('fechaYHoraAtencion', 'Fecha y hora atención'), prefix: 'encounterDatetime' },
    {
      id: 'edadGestacional',
      rowHeader: t('edadGestacional', 'Edad Gestacional (semanas)'),
      prefix: 'Duración de la gestación',
    },
    { id: 'pesoMadre', rowHeader: t('pesoMadre', 'Peso Madre(kg)'), prefix: 'Peso Corporal' },
    { id: 'alturaUterina', rowHeader: t('alturaUterina', 'Altura Uterina (cm)'), prefix: 'Altura del fondo uterino' },
    { id: 'situacion', rowHeader: t('situación', 'Situación (L,T,NA)'), prefix: 'Situación fetal' },
    { id: 'presentacion', rowHeader: t('presentación', 'Presentación (C/P/NA)'), prefix: 'Presentación Fetal' },
    { id: 'posicion', rowHeader: t('posición', 'Posición (O/I/NA)'), prefix: 'Posición fetal' },
    {
      id: 'frecuenciaCardiacaFetal',
      rowHeader: t('frecuenciaCardiacaFetal', 'Frecuencia cardiaca fetal (por min.)'),
      prefix: 'Frecuencia Cardíaca fetal',
    },
    { id: 'movimientoFetal', rowHeader: t('movimientoFetal', 'Movimiento fetal'), prefix: 'Movimiento fetal' },
    { id: 'imc', rowHeader: t('imc', 'IMC - índice de masa corporal'), prefix: 'IMC - índice de masa corporal' },
  ];

  return (
    <CareSummaryTable
      patientUuid={patientUuid}
      title={t('CuidadoPrenatal', 'Cuidado Prenatal')}
      emptyStateText={t('noDataAvailableDescription', 'No data available')}
      formUuid={config.formsList.atencionPrenatal}
      useEncountersHook={usePrenatalCare}
      rowDefinitions={rowDefinitions}
    />
  );
};

export default PrenatalCareChart;
