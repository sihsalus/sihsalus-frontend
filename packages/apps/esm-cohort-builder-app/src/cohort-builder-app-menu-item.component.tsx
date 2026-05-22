import { ClickableTile } from '@carbon/react';
import { Group } from '@carbon/react/icons';
import { useTranslation } from 'react-i18next';

import styles from './app-menu-item.scss';

export default function CohortBuilderAppMenuItem() {
  const { t } = useTranslation();
  const openmrsSpaBase = globalThis.getOpenmrsSpaBase();

  return (
    <ClickableTile className={styles.tile} href={`${openmrsSpaBase}cohort-builder`}>
      <Group size={32} className={styles.icon} />
      <span className={styles.label}>{t('cohortBuilder', 'Constructor de cohortes')}</span>
    </ClickableTile>
  );
}
