import { ClickableTile } from '@carbon/react';
import { Home } from '@carbon/react/icons';
import { useTranslation } from 'react-i18next';

import styles from './app-menu-item.scss';

export default function HomeAppMenuItem() {
  const { t } = useTranslation();
  const openmrsSpaBase = globalThis.getOpenmrsSpaBase();

  return (
    <ClickableTile className={styles.tile} href={`${openmrsSpaBase}home`}>
      <Home size={32} className={styles.icon} />
      <span className={styles.label}>{t('home', 'Inicio')}</span>
    </ClickableTile>
  );
}
