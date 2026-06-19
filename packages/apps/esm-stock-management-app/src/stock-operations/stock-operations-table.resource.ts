import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type StockOperationFilter, useStockOperations } from './stock-operations.resource';

export function useStockOperationPages(filter: StockOperationFilter) {
  const pageSizes = [10, 20, 30, 40, 50];
  const [currentPage, setCurrentPage] = useState(1);
  const [currentPageSize, setPageSize] = useState(10);
  const filterKey = JSON.stringify(filter);

  const paginatedFilter = useMemo(
    () => ({
      ...filter,
      startIndex: (currentPage - 1) * currentPageSize,
      limit: currentPageSize,
    }),
    [currentPage, currentPageSize, filter],
  );
  const { items, isLoading, error } = useStockOperations(paginatedFilter);
  const stockOperations = items?.results ?? [];

  const { t } = useTranslation();

  const tableHeaders = useMemo(
    () => [
      {
        id: 0,
        header: t('type', 'Type'),
        key: 'operationTypeName',
      },
      {
        id: 1,
        header: t('number', 'Number'),
        key: 'operationNumber',
      },
      {
        id: 2,
        header: t('stockOperationItems', 'Items'),
        key: 'stockOperationItems',
      },
      {
        id: 3,
        header: t('status', 'Status'),
        key: 'status',
      },
      {
        id: 4,
        header: t('location', 'Location'),
        key: 'location',
      },
      {
        id: 5,
        header: t('responsiblePerson', 'Responsible Person'),
        key: 'responsiblePerson',
      },
      {
        id: 6,
        header: t('date', 'Fecha'),
        key: 'operationDate',
      },
      {
        id: 7,
        key: 'details',
        header: '',
      },
      { key: 'actions', header: '' },
    ],
    [t],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: filterKey is a JSON.stringify trigger — it is not used in the callback body but its change must reset pagination
  useEffect(() => {
    setCurrentPage(1);
  }, [filterKey]);

  useEffect(() => {
    if (!isLoading && currentPage > 1 && stockOperations.length === 0 && (items.totalCount ?? 0) > 0) {
      setCurrentPage(1);
    }
  }, [currentPage, isLoading, items.totalCount, stockOperations.length]);

  return {
    items: stockOperations,
    totalItems: items?.totalCount ?? stockOperations.length,
    currentPage,
    currentPageSize,
    paginatedItems: stockOperations,
    goTo: setCurrentPage,
    pageSizes,
    isLoading,
    error,
    setPageSize,
    tableHeaders,
  };
}
