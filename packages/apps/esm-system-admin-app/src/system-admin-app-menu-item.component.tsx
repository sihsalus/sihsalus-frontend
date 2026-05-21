import { ClickableTile } from '@carbon/react';
import { Settings } from '@carbon/react/icons';
import { useTranslation } from 'react-i18next';

import styles from './app-menu-item.scss';

export default function SystemAdminAppMenuItem() {
  const { t } = useTranslation();
  const openmrsSpaBase = window['getOpenmrsSpaBase']();

  return (
    <ClickableTile className={styles.tile} href={`${openmrsSpaBase}system-administration`}>
      <Settings size={32} className={styles.icon} />
      <span className={styles.label}>{t('systemAdmin', 'Administración')}</span>
    </ClickableTile>
  );
}
