import { ClickableTile } from '@carbon/react';
import { InventoryManagement } from '@carbon/react/icons';
import { useTranslation } from 'react-i18next';

import styles from './stock-app-menu-item/item.scss';

export default function StockManagementAppMenuLink() {
  const { t } = useTranslation();
  const openmrsSpaBase = window['getOpenmrsSpaBase']();

  return (
    <ClickableTile className={styles.customTile} href={`${openmrsSpaBase}stock-management`}>
      <InventoryManagement size={32} className={styles.customTileTitle} />
      <span className={styles.customTileLabel}>{t('stockManagement', 'Gestión de Inventario')}</span>
    </ClickableTile>
  );
}
