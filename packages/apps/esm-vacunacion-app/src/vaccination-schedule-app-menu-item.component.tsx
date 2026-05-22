import { ClickableTile } from '@carbon/react';
import { Calendar } from '@carbon/react/icons';
import { useTranslation } from 'react-i18next';

import styles from './app-menu-item.scss';

export default function VaccinationScheduleAppMenuItem() {
  const { t } = useTranslation();
  const schedulingUrl = `${globalThis.spaBase}/vaccine-scheduling-builder`;

  return (
    <ClickableTile className={styles.tile} href={schedulingUrl}>
      <Calendar size={32} className={styles.icon} />
      <span className={styles.label}>{t('vaccinationScheduleBuilder', 'Gestor del calendario de vacunación')}</span>
    </ClickableTile>
  );
}
