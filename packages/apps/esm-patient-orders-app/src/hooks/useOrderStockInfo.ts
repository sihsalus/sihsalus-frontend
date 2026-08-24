import { type FetchResponse, openmrsFetch, restBaseUrl, useConfig } from '@openmrs/esm-framework';
import { useMemo } from 'react';
import useSWR from 'swr';

import { type ConfigObject } from '../config-schema';

import { useAreBackendModuleInstalled } from './useAreBackendModuleInstalled';

export const useOrderStockInfo = (orderItemUuid: string) => {
  const { stockAvailability } = useConfig<ConfigObject>();
  const { areModulesInstalled, isCheckingModules, moduleCheckError } = useAreBackendModuleInstalled('stockmanagement');
  const isConfigured = Boolean(stockAvailability.enabled && stockAvailability.dispensingLocationUuid && orderItemUuid);
  const query = useMemo(() => {
    if (!isConfigured || !areModulesInstalled || isCheckingModules) {
      return null;
    }

    const params = new URLSearchParams({
      v: 'default',
      totalCount: 'true',
      startIndex: '0',
      limit: '1000',
      drugUuid: orderItemUuid,
      includeBatchNo: 'false',
      groupBy: 'LocationStockItem',
      dispenseLocationUuid: stockAvailability.dispensingLocationUuid,
      dispenseAtLocation: '1',
      emptyBatch: '1',
      emptyBatchLocationUuid: stockAvailability.dispensingLocationUuid,
      excludeExpired: 'true',
    });
    return `${restBaseUrl}/stockmanagement/stockiteminventory?${params}`;
  }, [areModulesInstalled, isCheckingModules, isConfigured, orderItemUuid, stockAvailability.dispensingLocationUuid]);

  const { data, isLoading, error } = useSWR<FetchResponse<StockInventoryResponse>>(query, openmrsFetch);

  return useMemo(() => {
    const inventory = data?.data?.results;
    const availableQuantity = inventory?.reduce(
      (total, item) => total + (Number.isFinite(item.quantity) ? item.quantity : 0),
      0,
    );
    const status = !inventory?.length
      ? 'untracked'
      : typeof availableQuantity === 'number' && availableQuantity > 0
        ? 'in-stock'
        : 'out-of-stock';

    return {
      status: data ? status : null,
      isLoading: isConfigured && (isCheckingModules || isLoading),
      error: moduleCheckError ?? error,
    } as const;
  }, [data, error, isCheckingModules, isConfigured, isLoading, moduleCheckError]);
};

interface StockInventoryResponse {
  results: Array<{ quantity: number }>;
}
