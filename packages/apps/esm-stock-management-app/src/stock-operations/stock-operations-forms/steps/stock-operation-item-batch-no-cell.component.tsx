import { InlineLoading } from '@carbon/react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { type StockOperationType } from '../../../core/api/types/stock-operation/stock-operation-type';
import useOperationTypePermisions from '../hooks/use-operation-type-permisions';
import { useStockItemBatchNumbers } from '../hooks/use-stock-item-batch-numbers';

type StockOperationitemBatchNoCellProps = {
  operation: StockOperationType;
  stockBatchUuid?: string;
  batchNo?: string;
  stockItemUuid: string;
};

const StockOperationItemBatchNoCell: React.FC<StockOperationitemBatchNoCellProps> = ({
  operation,
  batchNo,
  stockBatchUuid,
  stockItemUuid,
}) => {
  const operationTypePermision = useOperationTypePermisions(operation);
  const { isLoading, stockItemBatchNos } = useStockItemBatchNumbers(stockItemUuid);
  const { t } = useTranslation();
  const _batchno = useMemo(
    () => stockItemBatchNos?.find((item) => item.uuid === stockBatchUuid)?.batchNo,
    [stockItemBatchNos, stockBatchUuid],
  );

  if (isLoading)
    return <InlineLoading description={t('loading', 'Loading')} iconDescription={t('loading', 'Loading')} />;

  if (operationTypePermision.requiresBatchUuid && !operationTypePermision.requiresActualBatchInfo)
    return <p>{_batchno ?? '--'}</p>;

  if (operationTypePermision.requiresActualBatchInfo || operationTypePermision.requiresBatchUuid)
    return <p>{batchNo ?? '--'}</p>;

  return <p>--</p>;
};

export default StockOperationItemBatchNoCell;
