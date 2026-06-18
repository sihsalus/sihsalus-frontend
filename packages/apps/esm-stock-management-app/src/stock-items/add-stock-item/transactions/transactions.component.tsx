import { DataTableSkeleton } from '@carbon/react';
import { ArrowLeft } from '@carbon/react/icons';
import React, { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import DataList from '../../../core/components/table/table.component';
import { formatDisplayDate } from '../../../core/utils/datetimeUtils';
import {
  translateStockLocation,
  translateStockOperationStatus,
  translateStockOperationType,
} from '../../../core/utils/translationUtils';
import StockOperationReference from '../../../stock-operations/stock-operation-reference.component';
import { type StockItemInventoryFilter } from '../../stock-items.resource';
import TransactionsPrintAction from './printout/transactions-print-action.component';
import TransactionsLocationsFilter from './transaction-filters/transaction-locations-filter.component';
import { useStockItemsTransactions } from './transactions.resource';

interface TransactionsProps {
  onSubmit?: () => void;
  stockItemUuid?: string;
}

const Transactions: React.FC<TransactionsProps> = ({ stockItemUuid }) => {
  const { t } = useTranslation();

  const [stockItemFilter, setStockItemFilter] = useState<StockItemInventoryFilter>({
    stockItemUuid,
  });
  const { isLoading, items, tableHeaders, totalCount, setCurrentPage, setLocationUuid, binCardHeaders, inventory } =
    useStockItemsTransactions(stockItemFilter);

  const { control } = useForm({});

  const tableRows = useMemo(() => {
    return items?.map((stockItemTransaction) => {
      const balance = inventory?.total ?? '';
      const transactionType = stockItemTransaction?.isPatientTransaction
        ? t('patientDispense', 'Dispensación a paciente')
        : translateStockOperationType(t, stockItemTransaction.stockOperationTypeName);
      const sourceLocation = translateStockLocation(t, stockItemTransaction.operationSourcePartyName);
      const destinationLocation = translateStockLocation(t, stockItemTransaction.operationDestinationPartyName);
      const partyLocation = translateStockLocation(t, stockItemTransaction?.partyName);

      return {
        ...stockItemTransaction,
        id: stockItemTransaction?.uuid,
        key: `key-${stockItemTransaction?.uuid}`,
        uuid: `${stockItemTransaction?.uuid}`,
        date: formatDisplayDate(stockItemTransaction?.dateCreated),
        location:
          stockItemTransaction.operationSourcePartyName && stockItemTransaction.operationDestinationPartyName ? (
            stockItemTransaction.operationSourcePartyName === stockItemTransaction?.partyName ? (
              stockItemTransaction.quantity > 0 ? (
                <>
                  <span className="transaction-location">{sourceLocation}</span>
                  <ArrowLeft size={16} /> {destinationLocation}
                </>
              ) : (
                <>
                  <span className="transaction-location">{sourceLocation}</span>
                  <ArrowLeft size={16} /> {destinationLocation}
                </>
              )
            ) : stockItemTransaction.operationDestinationPartyName === stockItemTransaction?.partyName ? (
              stockItemTransaction.quantity > 0 ? (
                <>
                  <span className="transaction-location">{destinationLocation}</span>
                  <ArrowLeft size={16} /> {sourceLocation}
                </>
              ) : (
                <>
                  <span className="transaction-location">{destinationLocation}</span>
                  <ArrowLeft size={16} /> {sourceLocation}
                </>
              )
            ) : (
              partyLocation
            )
          ) : (
            partyLocation
          ),
        transaction: transactionType,
        quantity: `${stockItemTransaction?.quantity?.toLocaleString()} ${stockItemTransaction?.packagingUomName ?? ''}`,
        batch: stockItemTransaction.stockBatchNo
          ? `${stockItemTransaction.stockBatchNo}${
              stockItemTransaction.expiration ? ` (${formatDisplayDate(stockItemTransaction.expiration)})` : ''
            }`
          : '',
        reference: (
          <StockOperationReference
            operationUuid={stockItemTransaction?.stockOperationUuid}
            operationNumber={stockItemTransaction?.stockOperationNumber}
          />
        ),
        status: translateStockOperationStatus(t, stockItemTransaction?.stockOperationStatus),
        in:
          stockItemTransaction?.quantity >= 0
            ? `${stockItemTransaction?.quantity?.toLocaleString()} ${stockItemTransaction?.packagingUomName ?? ''} ${t(
                'of',
                'de',
              )} ${stockItemTransaction.packagingUomFactor}`
            : '',
        out:
          stockItemTransaction?.quantity < 0
            ? `${(-1 * stockItemTransaction?.quantity)?.toLocaleString()} ${
                stockItemTransaction?.packagingUomName ?? ''
              } ${t('of', 'de')} ${stockItemTransaction.packagingUomFactor}`
            : '',
        totalin:
          stockItemTransaction?.quantity >= 0
            ? `${stockItemTransaction?.quantity * Number(stockItemTransaction.packagingUomFactor)}`
            : '',
        totalout:
          stockItemTransaction?.quantity < 0
            ? `${-1 * stockItemTransaction?.quantity * Number(stockItemTransaction.packagingUomFactor)}`
            : '',
        balance: `${balance} ${stockItemTransaction?.packagingUomName ?? ''}`,
      };
    });
  }, [items, inventory, t]);

  if (isLoading) {
    return <DataTableSkeleton role="progressbar" />;
  }

  return (
    <DataList
      children={() => (
        <>
          <TransactionsPrintAction
            columns={binCardHeaders}
            data={tableRows}
            itemUuid={stockItemUuid}
            filter={stockItemFilter}
          />
          <TransactionsLocationsFilter
            onLocationIdChange={(q) => {
              setLocationUuid(q);
              setStockItemFilter({ ...stockItemFilter, locationUuid: q });
            }}
            name={'TransactionLocationUuid'}
            placeholder={t('filterByLocation', 'Filter by Location')}
            control={control}
            controllerName="TransactionLocationUuid"
          />
        </>
      )}
      columns={tableHeaders}
      data={tableRows}
      totalItems={totalCount}
      goToPage={setCurrentPage}
      hasToolbar={true}
    />
  );
};

export default Transactions;
