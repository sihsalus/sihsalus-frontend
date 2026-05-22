import { ClickableTile } from '@carbon/react';
import { Report } from '@carbon/react/icons';
import { useTranslation } from 'react-i18next';
import styles from './item.scss';

const Item = () => {
  const { t } = useTranslation();
  const openmrsSpaBase = window['getOpenmrsSpaBase']();

  return (
    <ClickableTile className={styles.customTile} id="menu-item" href={`${openmrsSpaBase}stock-management`}>
      <Report size={32} className={styles.customTileTitle} />
      <div className={styles.customTileLabel}>{t('stockManagement', 'Stock Management')}</div>
    </ClickableTile>
  );
};
export default Item;
