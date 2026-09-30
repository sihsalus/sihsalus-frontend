import React from 'react';

import type { MetaStatus } from '../features/resultados/progress';
import styles from '../indicators-dashboard.module.scss';

interface MetaProgressBarProps {
  percentage: number;
  ariaLabel: string;
  status?: MetaStatus;
}

const STATUS_CLASS: Record<MetaStatus, string> = {
  low: styles.metaProgressBarLow,
  medium: styles.metaProgressBarMedium,
  high: styles.metaProgressBarHigh,
};

const MetaProgressBar: React.FC<MetaProgressBarProps> = ({ percentage, ariaLabel, status }) => (
  <div className={styles.metaProgressBarTrack}>
    <div
      className={`${styles.metaProgressBar}${status ? ` ${STATUS_CLASS[status]}` : ''}`}
      role="progressbar"
      aria-valuenow={percentage}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel}
      style={{ width: `${percentage}%` }}
    />
  </div>
);

export default MetaProgressBar;
