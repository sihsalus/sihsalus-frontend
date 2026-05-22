import { ClickableTile } from '@carbon/react';
import { DocumentTasks } from '@carbon/react/icons';
import { useTranslation } from 'react-i18next';

import styles from './app-menu-item.scss';

export default function FormsAppMenuItem() {
  const { t } = useTranslation();
  const openmrsSpaBase = globalThis.getOpenmrsSpaBase();

  return (
    <ClickableTile className={styles.tile} href={`${openmrsSpaBase}forms`}>
      <DocumentTasks size={32} className={styles.icon} />
      <span className={styles.label}>{t('formsAppMenuLink', 'Entrada rápida de datos')}</span>
    </ClickableTile>
  );
}
