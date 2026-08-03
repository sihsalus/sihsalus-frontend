import classNames from 'classnames';
import isEmpty from 'lodash-es/isEmpty';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { type Appointment } from '../types';

import styles from './metrics-card.scss';

interface MetricsCardProps {
  label: string;
  value: number | string;
  headerLabel: string;
  count?: { pendingAppointments: Array<Appointment>; arrivedAppointments: Array<Appointment>; missedCount?: number };
}

const MetricsCard: React.FC<MetricsCardProps> = ({ label, value, headerLabel, count }) => {
  const { t } = useTranslation();
  const showMissedCount = count?.missedCount != null;

  return (
    <article className={styles.container}>
      <div className={styles.tileContainer}>
        <div className={styles.tileHeader}>
          <div className={styles.headerLabelContainer}>
            <label className={styles.headerLabel}>{headerLabel}</label>
          </div>
        </div>
        <div className={styles.metricsGrid}>
          <div>
            <label className={styles.totalsLabel}>{label}</label>
            <p className={styles.totalsValue}>{value}</p>
          </div>
          {!isEmpty(count) && (
            <div className={classNames(styles.countGrid, { [styles.countGridThreeColumns]: showMissedCount })}>
              <span>{t('checkedIn', 'Checked in')}</span>
              <span>{t('notArrived', 'Not arrived')}</span>
              {showMissedCount && <span>{t('missed', 'Missed')}</span>}
              <p style={{ color: '#319227' }}>{count.arrivedAppointments?.length}</p>
              <p style={{ color: '#da1e28' }}>{count.pendingAppointments?.length}</p>
              {showMissedCount && <p style={{ color: '#525252' }}>{count.missedCount}</p>}
            </div>
          )}
        </div>
      </div>
    </article>
  );
};

export default MetricsCard;
