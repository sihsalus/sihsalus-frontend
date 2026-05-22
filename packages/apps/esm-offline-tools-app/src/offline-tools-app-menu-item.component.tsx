import { ClickableTile } from '@carbon/react';
import { CloudOffline } from '@carbon/react/icons';
import { useTranslation } from 'react-i18next';

import styles from './app-menu-item.scss';

export default function OfflineToolsAppMenuItem() {
  const { t } = useTranslation();
  const openmrsSpaBase = globalThis.getOpenmrsSpaBase();

  return (
    <ClickableTile className={styles.tile} href={`${openmrsSpaBase}offline-tools`}>
      <CloudOffline size={32} className={styles.icon} />
      <span className={styles.label}>{t('offlineToolsAppMenuLink', 'Herramientas sin internet')}</span>
    </ClickableTile>
  );
}
