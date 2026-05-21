import { ClickableTile } from '@carbon/react';
import { Receipt } from '@carbon/react/icons';
import { useTranslation } from 'react-i18next';
import styles from './item.scss';

const Item = () => {
  const { t } = useTranslation();
  const openmrsSpaBase = window['getOpenmrsSpaBase']();

  return (
    <ClickableTile className={styles.customTile} id="menu-item" href={`${openmrsSpaBase}billable-services`}>
      <Receipt size={32} className={styles.customTileTitle} />
      <div className={styles.customTileLabel}>{t('billableServices', 'Billable services')}</div>
    </ClickableTile>
  );
};
export default Item;
