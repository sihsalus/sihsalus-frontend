import { InlineLoading } from '@carbon/react';
import { showSnackbar } from '@openmrs/esm-framework';
import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useStockItemBatchInformationHook } from '../../../stock-items/add-stock-item/batch-information/batch-information.resource';
import styles from './stock-operation-items-form-step.scc.scss';

const StockAvailability: React.FC<{ stockItemUuid: string; partyUuid?: string }> = ({ stockItemUuid, partyUuid }) => {
  const { items, isLoading, error } = useStockItemBatchInformationHook({
    stockItemUuid: stockItemUuid,
    partyUuid: partyUuid,
    includeBatchNo: true,
  });
  const { t } = useTranslation();

  const totalQuantity = useMemo(() => {
    if (!items?.length) return 0;
    return items.reduce((total, batch) => {
      return total + (Number(batch.quantity) || 0);
    }, 0);
  }, [items]);
  const commonUOM = useMemo(() => {
    if (!items?.length) return '';
    return items[0]?.quantityUoM || '';
  }, [items]);

  useEffect(() => {
    if (error) {
      showSnackbar({
        kind: 'error',
        title: t('stockAvailabilityError', 'Error loading stock availability'),
        subtitle: error?.message,
      });
    }
  }, [error, t]);

  if (isLoading) return <InlineLoading status="active" iconDescription={t('loading', 'Loading')} />;
  if (error) return <>--</>;

  return (
    <div className={styles.availability}>
      {totalQuantity > 0 ? (
        <span>
          {t('available', 'Available')}: {totalQuantity.toLocaleString()} {commonUOM}
        </span>
      ) : (
        <span className={styles.outOfStock}>{t('outOfStock', 'Out of stock')}</span>
      )}
    </div>
  );
};

export default StockAvailability;
