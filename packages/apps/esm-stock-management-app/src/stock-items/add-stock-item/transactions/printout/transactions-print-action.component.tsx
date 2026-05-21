import { ComboButton, MenuItem } from '@carbon/react';
import { Printer } from '@carbon/react/icons';
import { showModal, useConfig } from '@openmrs/esm-framework';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type ConfigObject } from '../../../../config-schema';
import { ResourceRepresentation } from '../../../../core/api/api';
import {
  type StockItemInventoryFilter,
  useStockItem,
  useStockItemInventory,
  useStockItemTransactions,
} from '../../../stock-items.resource';

type Props = {
  itemUuid: string;
  columns: any;
  data: any;
  filter?: StockItemInventoryFilter;
};

const TransactionsPrintAction: React.FC<Props> = ({ columns, data, itemUuid, filter }) => {
  const { t } = useTranslation();

  const { enablePrintButton } = useConfig<ConfigObject>();

  const [stockCardItemFilter] = useState<StockItemInventoryFilter>({
    startIndex: 0,
    totalCount: true,
    v: ResourceRepresentation.Full,
    isPatientTransaction: 'true',
  });

  const [stockItemFilter, setStockItemFilter] = useState<StockItemInventoryFilter>({
    startIndex: 0,
    v: filter?.v || ResourceRepresentation.Default,
    limit: 10,
    q: filter?.q,
    totalCount: true,
  });

  const { item: stockItem, isLoading: isStockItemLoading } = useStockItem(itemUuid);
  const { items: stockCardData, isLoading: isStockCardLoading } = useStockItemTransactions(stockCardItemFilter);
  const { items: inventoryBalance } = useStockItemInventory(stockItemFilter);

  const [balances, setBalances] = useState<Record<string, { quantity: number; itemName: string }>>({});
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (stockCardData?.results?.length) {
      setCurrentIndex(0);
      setBalances({});
    }
  }, [stockCardData?.results]);

  useEffect(() => {
    const currentItem = stockCardData?.results?.[currentIndex];
    if (currentItem?.stockItemUuid) {
      setStockItemFilter((prev) => ({
        ...prev,
        stockItemUuid: currentItem.stockItemUuid,
      }));
    }
  }, [currentIndex, stockCardData]);

  useEffect(() => {
    const currentItem = stockCardData?.results?.[currentIndex];
    const stockItemUuid = currentItem?.stockItemUuid;

    if (inventoryBalance?.total && stockItemUuid) {
      setBalances((prev) => ({
        ...prev,
        [stockItemUuid]: {
          quantity: Number(inventoryBalance.total),
          itemName: currentItem.packagingUomName ?? '',
        },
      }));

      setCurrentIndex((prev) => prev + 1);
    }
  }, [inventoryBalance, currentIndex, stockCardData]);

  const stockCardWithBalance = useMemo(() => {
    return (
      stockCardData?.results?.map((transaction) => {
        const balance = balances[transaction.stockItemUuid];
        return {
          ...transaction,
          balance: `${balance?.quantity ?? ''} ${balance?.itemName ?? ''}`,
        };
      }) ?? []
    );
  }, [stockCardData?.results, balances]);

  const stockCardHeaders = useMemo(
    () => [
      { key: 'patientId', header: t('patientId', 'Patient ID') },
      { key: 'patientName', header: t('patientName', 'Patient Name') },
      { key: 'patientIdentifier', header: t('patientIdentifier', 'Patient Identifier') },
      { key: 'date', header: t('date', 'Date') },
      { key: 'location', header: t('location', 'Location') },
      { key: 'transaction', header: t('transaction', 'Transaction') },
      { key: 'balance', header: t('balance', 'Balance') },
      { key: 'totalout', header: t('out', 'OUT') },
      { key: 'batch', header: t('batch', 'Batch') },
    ],
    [t],
  );

  const handleBincardClick = () => {
    const dispose = showModal('transactions-print-bincard-preview-modal', {
      onClose: () => dispose(),
      title: stockItem.drugName || stockItem.conceptName || '',
      columns,
      data,
    });
  };

  const handleStockcardClick = () => {
    const dispose = showModal('transactions-print-stockcard-preview-modal', {
      onClose: () => dispose(),
      title: stockItem.drugName || stockItem.conceptName || '',
      columns: stockCardHeaders,
      data: stockCardWithBalance,
    });
  };

  return (
    <>
      {enablePrintButton && (
        <ComboButton label={t('print', 'Print')}>
          <MenuItem
            label={t('printStockCard', 'Print Stock Card')}
            renderIcon={(props) => <Printer size={24} {...props} />}
            onClick={handleStockcardClick}
            disabled={isStockItemLoading || isStockCardLoading}
          />
          <MenuItem
            label={t('printBinCard', 'Print Bin Card')}
            renderIcon={(props) => <Printer size={24} {...props} />}
            onClick={handleBincardClick}
            disabled={isStockItemLoading}
          />
        </ComboButton>
      )}
    </>
  );
};

export default TransactionsPrintAction;
