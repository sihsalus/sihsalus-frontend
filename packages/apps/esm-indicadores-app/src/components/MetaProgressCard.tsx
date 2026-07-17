import { Tile } from '@carbon/react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import styles from '../indicators-dashboard.module.scss';

interface MetaProgressCardProps {
  meta: number | null | undefined;
  currentValue: number;
}

function calculateProgress(meta: number, currentValue: number): number {
  if (meta <= 0) {
    return 0;
  }
  const percentage = Math.round((currentValue / meta) * 100);
  return Math.min(100, percentage);
}

const MetaProgressCard: React.FC<MetaProgressCardProps> = ({ meta, currentValue }) => {
  const { t } = useTranslation();

  if (meta == null) {
    return null;
  }

  const percentage = calculateProgress(meta, currentValue);

  return (
    <Tile className={styles.metaProgressCard}>
      <div className={styles.metaProgressHeader}>
        <div>
          <span className={styles.metaProgressLabel}>{t('target', 'Meta')}</span>
          <strong className={styles.metaProgressValue}>{meta}</strong>
        </div>
        <div>
          <span className={styles.metaProgressLabel}>{t('currentValue', 'Valor actual')}</span>
          <strong className={styles.metaProgressValue}>{currentValue}</strong>
        </div>
        <div>
          <span className={styles.metaProgressLabel}>{t('progress', 'Progreso')}</span>
          <strong className={styles.metaProgressValue}>{percentage}%</strong>
        </div>
      </div>
      <div className={styles.metaProgressBarTrack}>
        <div
          className={styles.metaProgressBar}
          role="progressbar"
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </Tile>
  );
};

export default MetaProgressCard;
