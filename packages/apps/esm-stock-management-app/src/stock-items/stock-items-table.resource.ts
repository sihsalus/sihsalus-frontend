import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ResourceRepresentation } from '../core/api/api';
import { type StockItemFilter, useStockItems } from './stock-items.resource';

export function useStockItemsPages(v?: ResourceRepresentation) {
  const { t } = useTranslation();

  const pageSizes = [10, 20, 30, 40, 50];
  const [currentPage, setCurrentPage] = useState(1);
  const [currentPageSize, setPageSize] = useState(10);
  const [searchString, setSearchString] = useState(null);

  // Drug filter type
  const [isDrug, setDrug] = useState('');

  const [stockItemFilter, setStockItemFilter] = useState<StockItemFilter>({
    startIndex: (currentPage - 1) * currentPageSize,
    v: v || ResourceRepresentation.Default,
    limit: currentPageSize,
    q: null,
    totalCount: true,
  });

  const { items, isLoading, error } = useStockItems(stockItemFilter);

  useEffect(() => {
    setStockItemFilter({
      startIndex: (currentPage - 1) * currentPageSize,
      v: v || ResourceRepresentation.Default,
      limit: currentPageSize,
      q: searchString,
      totalCount: true,
      isDrug: isDrug,
    });
  }, [searchString, currentPage, currentPageSize, isDrug, v]);

  useEffect(() => {
    if (!isLoading && currentPage > 1 && (items.results?.length ?? 0) === 0 && (items.totalCount ?? 0) > 0) {
      setCurrentPage(1);
    }
  }, [currentPage, isLoading, items.results?.length, items.totalCount]);

  return {
    items: items.results ?? [],
    totalCount: items.totalCount ?? 0,
    currentPageSize,
    currentPage,
    setCurrentPage,
    setPageSize,
    pageSizes,
    isLoading,
    error,
    isDrug,
    setDrug: (drug: string) => {
      setCurrentPage(1);
      setDrug(drug);
    },
    setSearchString: (query: string | null) => {
      setCurrentPage(1);
      setSearchString(query);
    },
  };
}
