import { Dropdown } from '@carbon/react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { translateStockOperationStatus } from '../../core/utils/translationUtils';
import styles from './stock-operation-statuses-filter.scss';

const StockOperationStatusesFilter: React.FC = () => {
  const { t } = useTranslation();
  // get stock sources
  const items = ['SUBMITTED', 'NEW', 'RETURNED', 'CANCELLED', 'DISPATCHED', 'COMPLETED', 'REJECTED'];

  return (
    <div className={styles.filterContainer}>
      <Dropdown
        id="stockOperationStatusesFiter"
        items={items}
        itemToString={(item) => (item ? translateStockOperationStatus(t, item) : t('notSet', 'Not Set'))}
        type="inline"
        size="sm"
        label={t('filterByStatus', 'Filter by status')}
        titleText={t('status', 'Status')}
      />
    </div>
  );
};

export default StockOperationStatusesFilter;
