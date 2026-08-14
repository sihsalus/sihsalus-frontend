import { ClickableTile } from '@carbon/react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import useAppointmentsData from './appointments.resource';
import styles from './appointments-tile.scss';

const AppointmentsTile: React.FC = () => {
  const { data: appointmentsData } = useAppointmentsData();
  const { t } = useTranslation();
  const spaBase = (globalThis.spaBase ?? globalThis.getOpenmrsSpaBase()).replace(/\/$/, '');

  return (
    <ClickableTile className={styles.tileContainer} href={`${spaBase}/home/appointments`}>
      <header className={styles.tileHeader}>{t('scheduledForToday', 'Scheduled For Today')}</header>
      <div className={styles.displayDetails}>
        <div className={styles.countLabel}>{t('patients', 'Patients')}</div>
        <div className={styles.displayData}>{appointmentsData?.length ?? 0}</div>
      </div>
    </ClickableTile>
  );
};

export default AppointmentsTile;
