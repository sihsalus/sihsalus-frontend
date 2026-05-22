import { usePagination } from '@openmrs/esm-framework';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type StockRuleFilter, useStockRules } from '../../stock-items.resource';

export function useStockItemRules(filter: StockRuleFilter) {
  const { t } = useTranslation();
  const { items, isLoading, error } = useStockRules(filter);

  const pageSizes = [10, 20, 30, 40, 50];
  const [currentPageSize, setPageSize] = useState(10);
  const { goTo, results: paginatedItems, currentPage } = usePagination(items.results, currentPageSize);

  const tableHeaders = useMemo(
    () => [
      { key: 'location', header: t('location', 'Location') },
      { key: 'name', header: t('name', 'Name') },
      { key: 'quantity', header: t('quantityThreshold', 'Quantity threshold') },
      { key: 'evaluationFrequency', header: t('evaluationFrequencyHeader', 'Frequency Check') },
      { key: 'actionFrequency', header: t('notificationFrequency', 'Notification Frequency') },
      { key: 'alertRole', header: t('alertRole', 'Alert Role') },
      { key: 'mailRole', header: t('mailRole', 'Mail Role') },
      { key: 'enabled', header: t('enabled', 'Enabled?') },
      { key: 'actions', header: t('actions', 'Actions') },
    ],
    [t],
  );

  return {
    items: paginatedItems,
    totalItems: items?.totalCount,
    currentPage,
    currentPageSize,
    paginatedItems,
    goTo,
    pageSizes,
    isLoading,
    error,
    setPageSize,
    tableHeaders,
  };
}
