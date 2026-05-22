import { InlineLoading } from '@carbon/react';
import { showSnackbar } from '@openmrs/esm-framework';
import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useStockItem } from '../../../stock-items/stock-items.resource';

type QuantityUomCellProps = {
  stockItemPackagingUOMUuid: string;
  stockItemUuid: string;
};

const QuantityUomCell: React.FC<QuantityUomCellProps> = ({ stockItemPackagingUOMUuid, stockItemUuid }) => {
  const { isLoading, error, item } = useStockItem(stockItemUuid);
  const { t } = useTranslation();
  const uomName = useMemo(() => {
    return item?.packagingUnits?.find((unit) => unit.uuid === stockItemPackagingUOMUuid)?.packagingUomName;
  }, [item, stockItemPackagingUOMUuid]);

  useEffect(() => {
    if (error) {
      showSnackbar({
        kind: 'error',
        title: t('packagingUomError', 'Error loading Stock item'),
        subtitle: error?.message,
      });
    }
  }, [error, t]);
  if (isLoading) return <InlineLoading status="active" iconDescription={t('loading', 'Loading')} />;
  if (error) return <>--</>;
  return <>{uomName}</>;
};

export default QuantityUomCell;
