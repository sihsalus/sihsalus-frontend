import { ClickableTile } from '@carbon/react';
import { Analytics } from '@carbon/react/icons';
import { useTranslation } from 'react-i18next';

import styles from './app-menu-item.scss';

export default function ReportsAppMenuItem() {
  const { t } = useTranslation();
  const openmrsSpaBase = window['getOpenmrsSpaBase']();

  return (
    <ClickableTile className={styles.tile} href={`${openmrsSpaBase}reports`}>
      <Analytics size={32} className={styles.icon} />
      <span className={styles.label}>{t('reportsAppMenuLink', 'Informes y Estadísticas')}</span>
    </ClickableTile>
  );
}
