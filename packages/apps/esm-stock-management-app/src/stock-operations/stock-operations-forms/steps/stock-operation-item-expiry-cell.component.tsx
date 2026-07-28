import { InlineLoading } from '@carbon/react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { formatForDatePicker } from '../../../constants';
import { type StockOperationType } from '../../../core/api/types/stock-operation/stock-operation-type';
import useOperationTypePermisions from '../hooks/use-operation-type-permisions';
import { useStockItemBatchNumbers } from '../hooks/use-stock-item-batch-numbers';

type StockoperationItemExpiryCellProps = {
  operation: StockOperationType;
  stockBatchUuid?: string;
  expiration?: Date;
  stockItemUuid: string;
};

const StockoperationItemExpiryCell: React.FC<StockoperationItemExpiryCellProps> = ({
  operation,
  stockItemUuid,
  expiration,
  stockBatchUuid,
}) => {
  const operationTypePermision = useOperationTypePermisions(operation);
  const { isLoading, stockItemBatchNos } = useStockItemBatchNumbers(stockItemUuid);
  const { t } = useTranslation();
  const _expiration = useMemo(
    () => stockItemBatchNos?.find((item) => item.uuid === stockBatchUuid)?.expiration,
    [stockItemBatchNos, stockBatchUuid],
  );

  if (isLoading)
    return <InlineLoading description={t('loading', 'Loading')} iconDescription={t('loading', 'Loading')} />;

  if (operationTypePermision.requiresBatchUuid && !operationTypePermision.requiresActualBatchInfo)
    return <p>{_expiration ? formatForDatePicker(_expiration) : '--'}</p>;

  if (operationTypePermision.requiresActualBatchInfo || operationTypePermision.requiresBatchUuid)
    return <p>{expiration ? formatForDatePicker(expiration) : '--'}</p>;

  return <p>--</p>;
};

export default StockoperationItemExpiryCell;
