import { Tile } from '@carbon/react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { calculateProgress } from '../features/resultados/progress';
import MetaProgressBar from './MetaProgressBar';
import styles from '../indicators-dashboard.module.scss';

interface MetaProgressCardProps {
  meta: number | null | undefined;
  currentValue: number;
}

const MetaProgressCard: React.FC<MetaProgressCardProps> = ({ meta, currentValue }) => {
  const { t } = useTranslation();

  if (meta == null) {
    return null;
  }

  // A target of zero is not a meaningful progress goal. Show the values but
  // label progress as "no target" instead of fabricating a 0% that is
  // indistinguishable from a target never reached.
  const hasTarget = Number.isFinite(meta) && meta > 0;
  const percentage = hasTarget ? calculateProgress(meta, currentValue) : 0;

  return (
    <Tile className={styles.metaProgressCard}>
      <div className={styles.metaProgressHeader}>
        <div>
          <span className={styles.metaProgressLabel}>{t('annualTarget', 'Meta anual')}</span>
          <strong className={styles.metaProgressValue}>{meta}</strong>
        </div>
        <div>
          <span className={styles.metaProgressLabel}>{t('annualProgressValue', 'Avance anual acumulado')}</span>
          <strong className={styles.metaProgressValue}>{currentValue}</strong>
        </div>
        <div>
          <span className={styles.metaProgressLabel}>{t('annualProgressPercent', 'Progreso anual')}</span>
          <strong className={styles.metaProgressValue}>
            {hasTarget ? `${percentage}%` : t('noTarget', 'Sin meta')}
          </strong>
        </div>
      </div>
      {hasTarget ? (
        <MetaProgressBar
          percentage={percentage}
          ariaLabel={t('annualProgressBarAria', 'Progreso anual: {{percentage}}% de la meta anual', {
            percentage,
          })}
        />
      ) : null}
    </Tile>
  );
};

export default MetaProgressCard;
