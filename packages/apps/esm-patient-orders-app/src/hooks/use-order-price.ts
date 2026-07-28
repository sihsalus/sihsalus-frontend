import { type FetchResponse, fhirBaseUrl, openmrsFetch } from '@openmrs/esm-framework';
import { useMemo } from 'react';
import useSWR from 'swr';

import { type OrderPriceData } from '../types/order';

import { useAreBackendModuleInstalled } from './use-are-backend-module-installed';

export const useOrderPrice = (orderItemUuid: string) => {
  const { areModulesInstalled, isCheckingModules } = useAreBackendModuleInstalled(['fhirproxy', 'billing']);

  const { data, isLoading, error } = useSWR<FetchResponse<OrderPriceData>>(
    orderItemUuid && areModulesInstalled && !isCheckingModules
      ? `${fhirBaseUrl}/ChargeItemDefinition?code=${orderItemUuid}`
      : null,
    openmrsFetch,
  );

  return useMemo(
    () => ({
      data: data?.data ?? null,
      isLoading,
      error,
    }),
    [data, isLoading, error],
  );
};
