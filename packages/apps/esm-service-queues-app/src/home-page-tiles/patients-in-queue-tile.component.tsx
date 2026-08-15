import { ClickableTile } from '@carbon/react';
import { useTranslation } from 'react-i18next';

import { useQueueEntriesMetrics } from '../hooks/useQueueEntries';
import styles from './patients-in-queue-tile.scss';

const PatientsInQueueTile = () => {
  const { t } = useTranslation();
  const { count, error, isLoading } = useQueueEntriesMetrics({ isEnded: false });
  const spaBase = (globalThis.spaBase ?? globalThis.getOpenmrsSpaBase()).replace(/\/$/, '');

  return (
    <ClickableTile className={styles.tileContainer} href={`${spaBase}/home/service-queues`}>
      <header className={styles.tileHeader}>{t('patientsInQueue', 'Pacientes en cola')}</header>
      <div className={styles.displayDetails}>
        <div className={styles.countLabel}>{t('patients', 'Pacientes')}</div>
        <div className={styles.displayData}>{isLoading || error ? '--' : count}</div>
      </div>
    </ClickableTile>
  );
};

export default PatientsInQueueTile;
