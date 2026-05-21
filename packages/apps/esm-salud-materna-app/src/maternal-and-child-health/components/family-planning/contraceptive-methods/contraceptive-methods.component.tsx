import { Tag, Tile } from '@carbon/react';
import { useConfig } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { ConfigObject } from '../../../../config-schema';
import ConfiguredFormButton from '../../configured-form-button.component';
import styles from './contraceptive-methods.scss';

interface ContraceptiveMethodsProps {
  patientUuid: string;
}

/**
 * Widget de métodos anticonceptivos según NTS 124-MINSA.
 * Muestra método actual, fecha de inicio, categoría y próximo control.
 */
const ContraceptiveMethods: React.FC<ContraceptiveMethodsProps> = ({ patientUuid: _patientUuid }) => {
  const { t } = useTranslation();
  const config = useConfig<ConfigObject>();

  // TODO: Connect to SWR hook when concept UUIDs are configured
  const currentMethod = null;
  const startDate = null;
  const methodCategory = null;
  const nextFollowUp = null;

  return (
    <Tile className={styles.card}>
      <div className={styles.header}>
        <h5>{t('fpCurrentMethod', 'Método Actual')}</h5>
        <Tag type={currentMethod ? 'green' : 'gray'} size="sm">
          {currentMethod ? t('active', 'Active') : t('fpNoMethod', 'Sin método')}
        </Tag>
      </div>
      <div className={styles.content}>
        <div className={styles.row}>
          <span className={styles.label}>{t('fpMethod', 'Método')}:</span>
          <span className={styles.value}>{currentMethod ?? t('noData', 'Sin datos')}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>{t('fpMethodCategory', 'Categoría')}:</span>
          <span className={styles.value}>{methodCategory ?? t('noData', 'Sin datos')}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>{t('startDate', 'Start date')}:</span>
          <span className={styles.value}>{startDate ?? t('noData', 'Sin datos')}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>{t('fpNextFollowUp', 'Próximo control')}:</span>
          <span className={styles.value}>{nextFollowUp ?? t('pending', 'Pending')}</span>
        </div>
      </div>
      <ConfiguredFormButton
        formUuid={config.formsList.familyPlanningCounselingForm}
        label={t('registerContraceptiveMethod', 'Registrar método')}
      />
    </Tile>
  );
};

export default ContraceptiveMethods;
