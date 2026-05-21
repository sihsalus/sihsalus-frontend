import { Tag, Tile } from '@carbon/react';
import { useConfig } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { ConfigObject } from '../../../../config-schema';
import ConfiguredFormButton from '../../configured-form-button.component';
import styles from './cervical-screening.scss';

interface CervicalScreeningProps {
  patientUuid: string;
}

/**
 * Widget de tamizaje de cáncer cervical según NTS 164-MINSA.
 * Muestra último PAP/VIA, resultado, y próximo tamizaje.
 */
const CervicalScreening: React.FC<CervicalScreeningProps> = ({ patientUuid: _patientUuid }) => {
  const { t } = useTranslation();
  const config = useConfig<ConfigObject>();

  // TODO: Connect to SWR hook when concept UUIDs are configured
  const lastPapDate = null;
  const papResult = null;
  const lastViaDate = null;
  const viaResult = null;
  const nextScreeningDate = null;

  return (
    <Tile className={styles.card}>
      <div className={styles.header}>
        <h5>{t('cervicalScreeningTitle', 'Tamizaje Cervical')}</h5>
        <Tag type="gray" size="sm">
          {t('pending', 'Pending')}
        </Tag>
      </div>
      <div className={styles.content}>
        <div className={styles.row}>
          <span className={styles.label}>{t('cpLastPap', 'Último PAP')}:</span>
          <span className={styles.value}>{lastPapDate ?? t('neverPerformed', 'Nunca se ha hecho')}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>{t('cpPapResult', 'Resultado PAP')}:</span>
          <span className={styles.value}>{papResult ?? t('noData', 'Sin datos')}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>{t('cpLastVia', 'Último VIA/IVAA')}:</span>
          <span className={styles.value}>{lastViaDate ?? t('neverPerformed', 'Nunca se ha hecho')}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>{t('cpViaResult', 'Resultado VIA')}:</span>
          <span className={styles.value}>{viaResult ?? t('noData', 'Sin datos')}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>{t('cpNextScreening', 'Próximo tamizaje')}:</span>
          <span className={styles.value}>{nextScreeningDate ?? t('pending', 'Pending')}</span>
        </div>
      </div>
      <ConfiguredFormButton
        formUuid={config.formsList.cervicalCancerScreeningForm}
        label={t('registerCervicalScreening', 'Registrar tamizaje')}
      />
    </Tile>
  );
};

export default CervicalScreening;
