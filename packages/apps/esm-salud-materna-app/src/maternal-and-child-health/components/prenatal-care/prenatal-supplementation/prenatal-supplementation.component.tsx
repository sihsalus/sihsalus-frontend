import { DataTableSkeleton, Tile } from '@carbon/react';
import { EmptyState, ErrorState } from '@openmrs/esm-patient-common-lib';
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
  const { supplements, isLoading, error } = usePrenatalSupplementation(patientUuid);
  const headerTitle = t('prenatalSupplementation');

  if (error) return <ErrorState error={error} headerTitle={headerTitle} />;

  if (isLoading) return <DataTableSkeleton role="progressbar" aria-label={t('loadingData')} />;
  if (!supplements.some(({ indicatedTablets }) => indicatedTablets !== null)) {
    return <EmptyState headerTitle={headerTitle} displayText={t('prenatalSupplementIndications')} />;
  }

  return (
    <Tile className={styles.card}>
      <div className={styles.header}>
        <h5>{headerTitle}</h5>
      </div>
      <div className={styles.content}>
        {supplements.map(({ nameKey, indicatedTablets }) => (
          <div key={nameKey} className={styles.supplementRow}>
            <span>{t(nameKey)}</span>
            <span>
              {indicatedTablets === null
                ? t('maternalNoRecordedForms')
                : t('prenatalIndicatedTablets', { count: indicatedTablets })}
            </span>
          </div>
        ))}
        <p>{t('prenatalIndicationsHelp')}</p>
      </div>
    </Tile>
  );
};

export default PrenatalSupplementation;
