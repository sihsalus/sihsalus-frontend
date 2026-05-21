import { ClickableTile } from '@carbon/react';
import { HospitalBed } from '@carbon/react/icons';
import React from 'react';
import { useTranslation } from 'react-i18next';

import styles from './app-menu-item.scss';

function getSpaBase(): string {
  const value = (globalThis as { getOpenmrsSpaBase?: () => string }).getOpenmrsSpaBase?.();
  return typeof value === 'string' ? value : '';
}

const BedManagementAppMenuItem: React.FC = () => {
  const { t } = useTranslation();

  return (
    <ClickableTile className={styles.customTile} id="bed-management-menu-item" href={`${getSpaBase()}bed-management`}>
      <HospitalBed size={32} className={styles.customTileTitle} />
      <div className={styles.customTileLabel}>{t('bedManagement', 'Bed management')}</div>
    </ClickableTile>
  );
};

export default BedManagementAppMenuItem;
