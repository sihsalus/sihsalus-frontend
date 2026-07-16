import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import useSWR from 'swr';

import { type WaitTime } from '../types';

export { useActiveVisits } from '../active-visits/active-visits.resource';

export function useAverageWaitTime(serviceUuid: string, statusUuid: string) {
  const apiUrl = `${restBaseUrl}/queue-metrics?queue=${serviceUuid}&status=${statusUuid}`;

  const { data, error, isLoading, isValidating, mutate } = useSWR<{ data: WaitTime }, Error>(
    serviceUuid && statusUuid ? apiUrl : null,
    openmrsFetch,
  );

  return {
    waitTime: data ? data?.data : null,
    isLoading,
    error,
    isValidating,
    mutate,
  };
}
