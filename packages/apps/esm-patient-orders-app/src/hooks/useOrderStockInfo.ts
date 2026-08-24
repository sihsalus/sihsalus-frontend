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
    const inventory = Array.isArray(data?.data?.results) ? data.data.results : [];
    const quantities = inventory.map((item) => item.quantity);
    const availableQuantity = quantities.every(isFiniteNumber)
      ? quantities.reduce((total, quantity) => total + quantity, 0)
      : null;
    const status =
      inventory.length === 0 || availableQuantity === null
        ? 'untracked'
        : availableQuantity > 0
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
  results?: Array<{ quantity: unknown }>;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
