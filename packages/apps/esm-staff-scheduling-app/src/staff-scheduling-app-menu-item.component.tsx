import { ClickableTile } from '@carbon/react';
import { Calendar } from '@carbon/react/icons';
import { useTranslation } from 'react-i18next';

import styles from './staff-scheduling-app-menu-item.scss';

export default function StaffSchedulingAppMenuItem() {
  const { t } = useTranslation();

  return (
    <ClickableTile className={styles.tile} href={`${globalThis.spaBase}/staff-scheduling`}>
      <Calendar size={32} className={styles.icon} />
      <span className={styles.label}>{t('staffScheduling', 'Programación de turnos y recursos')}</span>
    </ClickableTile>
  );
}
