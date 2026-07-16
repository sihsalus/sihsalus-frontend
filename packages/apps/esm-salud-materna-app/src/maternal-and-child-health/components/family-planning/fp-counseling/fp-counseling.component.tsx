import { Tag, Tile } from '@carbon/react';
import { useConfig } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { ConfigObject } from '../../../../config-schema';
import { familyPlanningEditPrivilege } from '../../../../constants';
import ConfiguredFormButton from '../../configured-form-button.component';
import styles from './fp-counseling.scss';

interface FpCounselingProps {
  patientUuid: string;
}

/**
 * Widget de consejería en planificación familiar según NTS 124-MINSA.
 * Muestra sesiones de consejería, temas cubiertos y próxima sesión.
 */
const FpCounseling: React.FC<FpCounselingProps> = ({ patientUuid: _patientUuid }) => {
  const { t } = useTranslation();
  const config = useConfig<ConfigObject>();

  // TODO: Connect to SWR hook when concept UUIDs are configured
  const sessionsCompleted = null;
  const lastSessionDate = null;
  const nextSession = null;

  return (
    <Tile className={styles.card}>
      <div className={styles.header}>
        <h5>{t('fpCounselingTitle', 'Consejería PF')}</h5>
        <Tag type={sessionsCompleted ? 'green' : 'gray'} size="sm">
          {sessionsCompleted ? `${sessionsCompleted} ${t('sessions', 'sesiones')}` : t('noData', 'Sin datos')}
        </Tag>
      </div>
      <div className={styles.content}>
        <div className={styles.row}>
          <span className={styles.label}>{t('fpSessionsCompleted', 'Sesiones realizadas')}:</span>
          <span className={styles.value}>{sessionsCompleted ?? t('noData', 'Sin datos')}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>{t('lastSession', 'Última sesión')}:</span>
          <span className={styles.value}>{lastSessionDate ?? t('noData', 'Sin datos')}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>{t('fpNextSession', 'Próxima sesión')}:</span>
          <span className={styles.value}>{nextSession ?? t('pending', 'Pending')}</span>
        </div>
      </div>
      <ConfiguredFormButton
        formUuid={config.formsList.familyPlanningCounselingForm}
        editPrivilege={familyPlanningEditPrivilege}
        label={t('registerFpCounseling', 'Registrar consejería')}
      />
    </Tile>
  );
};

export default FpCounseling;
