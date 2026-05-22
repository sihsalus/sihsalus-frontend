import { ClickableTile } from '@carbon/react';
import { ConnectionSend } from '@carbon/react/icons';
import { useTranslation } from 'react-i18next';

import styles from './app-menu-item.scss';

export default function ReferralsAppMenuItem() {
  const { t } = useTranslation();
  const openmrsSpaBase = globalThis.getOpenmrsSpaBase();

  return (
    <ClickableTile className={styles.tile} href={`${openmrsSpaBase}referrals`}>
      <ConnectionSend size={32} className={styles.icon} />
      <span className={styles.label}>{t('referrals', 'Referencias')}</span>
    </ClickableTile>
  );
}
