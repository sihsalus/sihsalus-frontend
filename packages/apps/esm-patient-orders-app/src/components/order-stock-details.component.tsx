import { SkeletonText } from '@carbon/react';
import { CheckmarkFilledIcon, CloseFilledIcon } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { useOrderStockInfo } from '../hooks/useOrderStockInfo';

import styles from './order-stock-details.scss';

interface OrderStockDetailsComponentProps {
  orderItemUuid: string;
}

const OrderStockDetailsComponent: React.FC<OrderStockDetailsComponentProps> = ({ orderItemUuid }) => {
  const { t } = useTranslation();
  const { status, isLoading, error } = useOrderStockInfo(orderItemUuid);

  if (isLoading) {
    return <SkeletonText width="100px" />;
  }

  if (!status || status === 'untracked' || error) {
    return null;
  }

  return (
    <div>
      {status === 'in-stock' ? (
        <div className={styles.itemInStock}>
          <CheckmarkFilledIcon size={16} className={styles.itemInStockIcon} /> {t('inStock', 'In stock')}
        </div>
      ) : (
        <div className={styles.itemOutOfStock}>
          <CloseFilledIcon size={16} className={styles.itemOutOfStockIcon} /> {t('outOfStock', 'Out of stock')}
        </div>
      )}
    </div>
  );
};

export default OrderStockDetailsComponent;
