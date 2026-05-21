import { Tag, Tile } from '@carbon/react';
import { useConfig } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { ConfigObject } from '../../../../config-schema';
import ConfiguredFormButton from '../../configured-form-button.component';
import styles from './breast-screening.scss';

interface BreastScreeningProps {
  patientUuid: string;
}

/**
 * Widget de detección de cáncer de mama según guía MINSA.
 * Muestra último examen clínico, autoexamen y mamografía.
 */
const BreastScreening: React.FC<BreastScreeningProps> = ({ patientUuid: _patientUuid }) => {
  const { t } = useTranslation();
  const config = useConfig<ConfigObject>();

  // TODO: Connect to SWR hook when concept UUIDs are configured
  const lastClinicalExamDate = null;
  const selfExamEducation = null;
  const lastMammogramDate = null;
  const nextScreeningDate = null;

  return (
    <Tile className={styles.card}>
      <div className={styles.header}>
        <h5>{t('breastScreeningTitle', 'Detección de Mama')}</h5>
        <Tag type={lastClinicalExamDate ? 'green' : 'gray'} size="sm">
          {lastClinicalExamDate ? t('completed', 'Completed') : t('pending', 'Pending')}
        </Tag>
      </div>
      <div className={styles.content}>
        <div className={styles.row}>
          <span className={styles.label}>{t('cpLastClinicalExam', 'Último examen clínico')}:</span>
          <span className={styles.value}>{lastClinicalExamDate ?? t('neverPerformed', 'Nunca se ha hecho')}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>{t('cpSelfExamEducation', 'Educación autoexamen')}:</span>
          <span className={styles.value}>{selfExamEducation ?? t('noData', 'Sin datos')}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>{t('cpLastMammogram', 'Última mamografía')}:</span>
          <span className={styles.value}>{lastMammogramDate ?? t('notApplicable', 'Not applicable')}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>{t('cpNextScreening', 'Próximo tamizaje')}:</span>
          <span className={styles.value}>{nextScreeningDate ?? t('pending', 'Pending')}</span>
        </div>
      </div>
      <ConfiguredFormButton
        formUuid={config.formsList.breastCancerScreeningForm}
        label={t('registerBreastScreening', 'Registrar tamizaje')}
      />
    </Tile>
  );
};

export default BreastScreening;
