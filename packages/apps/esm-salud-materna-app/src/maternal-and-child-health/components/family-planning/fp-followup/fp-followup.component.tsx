import { Tag, Tile } from '@carbon/react';
import { useConfig } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { ConfigObject } from '../../../../config-schema';
import ConfiguredFormButton from '../../configured-form-button.component';
import styles from './fp-followup.scss';

interface FpFollowupProps {
  patientUuid: string;
}

/**
 * Widget de seguimiento de planificación familiar según NTS 124-MINSA.
 * Muestra adherencia, efectos secundarios y próxima cita.
 */
const FpFollowup: React.FC<FpFollowupProps> = ({ patientUuid: _patientUuid }) => {
  const { t } = useTranslation();
  const config = useConfig<ConfigObject>();

  // TODO: Connect to SWR hook when concept UUIDs are configured
  const adherenceStatus = null;
  const sideEffects = null;
  const nextAppointment = null;
  const lastVisitDate = null;

  return (
    <Tile className={styles.card}>
      <div className={styles.header}>
        <h5>{t('fpFollowUpTitle', 'Seguimiento PF')}</h5>
        <Tag type="gray" size="sm">
          {adherenceStatus ?? t('pending', 'Pending')}
        </Tag>
      </div>
      <div className={styles.content}>
        <div className={styles.row}>
          <span className={styles.label}>{t('fpAdherence', 'Adherencia')}:</span>
          <span className={styles.value}>{adherenceStatus ?? t('noData', 'Sin datos')}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>{t('fpSideEffects', 'Efectos secundarios')}:</span>
          <span className={styles.value}>{sideEffects ?? t('fpNone', 'Ninguno reportado')}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>{t('fpLastVisit', 'Última visita')}:</span>
          <span className={styles.value}>{lastVisitDate ?? t('noData', 'Sin datos')}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>{t('fpNextAppointment', 'Próxima cita')}:</span>
          <span className={styles.value}>{nextAppointment ?? t('pending', 'Pending')}</span>
        </div>
      </div>
      <ConfiguredFormButton
        formUuid={config.formsList.familyPlanningFollowupForm}
        label={t('registerFpFollowup', 'Registrar seguimiento')}
      />
    </Tile>
  );
};

export default FpFollowup;
