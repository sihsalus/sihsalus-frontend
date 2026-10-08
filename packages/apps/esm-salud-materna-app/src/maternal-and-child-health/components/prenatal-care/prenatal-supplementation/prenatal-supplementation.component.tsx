import { ProgressBar, Tag, Tile } from '@carbon/react';
import { ErrorState } from '@openmrs/esm-patient-common-lib';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { usePrenatalSupplementation } from '../../../../hooks/usePrenatalSupplementation';

import styles from './prenatal-supplementation.scss';

interface PrenatalSupplementationProps {
  patientUuid: string;
}

/**
 * Widget de suplementación prenatal según NTS 105-MINSA.
 * Ácido fólico, sulfato ferroso y calcio.
 */
const PrenatalSupplementation: React.FC<PrenatalSupplementationProps> = ({ patientUuid }) => {
  const { t } = useTranslation('@sihsalus/esm-salud-materna-app');
  const { supplements, overallPercentage, isLoading, error } = usePrenatalSupplementation(patientUuid);

  if (error) return <ErrorState error={error} headerTitle={t('prenatalSupplementation')} />;

  if (isLoading) return <Tile className={styles.card}>{t('loading', 'Loading...')}</Tile>;

  return (
    <Tile className={styles.card}>
      <div className={styles.header}>
        <h5>{t('prenatalSupplementation', 'Suplementación Prenatal')}</h5>
        <Tag type={overallPercentage >= 100 ? 'green' : 'blue'} size="sm">
          {Math.round(overallPercentage)}%
        </Tag>
      </div>
      <div className={styles.content}>
        {supplements.map((supplement, idx) => {
          const pct = supplement.total > 0 ? (supplement.delivered / supplement.total) * 100 : 0;
          return (
            <div key={idx} className={styles.supplementRow}>
              <ProgressBar
                label={`${supplement.name}: ${supplement.delivered}/${supplement.total}`}
                value={pct}
                size="small"
                status={supplement.isComplete ? 'finished' : 'active'}
              />
            </div>
          );
        })}
      </div>
      {error && <p className={styles.error}>{t('errorLoading', 'Error al cargar datos')}</p>}
    </Tile>
  );
};

export default PrenatalSupplementation;
