import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import useSWR from 'swr';
import { type QueueEntrySearchCriteria, type WaitTime } from '../types';

export { useActiveVisits } from '../active-visits/active-visits.resource';

export function useAverageWaitTime(
  serviceUuid: string | null | undefined,
  statusUuid: string,
  criteria?: Pick<QueueEntrySearchCriteria, 'startedOnOrAfter' | 'startedOnOrBefore'>,
) {
  const searchParams = new URLSearchParams({ status: statusUuid, metric: 'averageWaitTime' });
  if (serviceUuid) searchParams.set('service', serviceUuid);
  for (const [key, value] of Object.entries(criteria ?? {})) {
    if (value != null) searchParams.set(key, value.toString());
  }
  const apiUrl = `${restBaseUrl}/queue-entry-metrics?${searchParams.toString()}`;

  const { data, error, isLoading, isValidating, mutate } = useSWR<{ data: WaitTime }, Error>(
    statusUuid ? apiUrl : null,
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

export function useServiceMetricsCount(service: string, location: string) {
  const status = 'Waiting';
  const apiUrl =
    `${restBaseUrl}/queue-entry-metrics?status=${status}&isEnded=false` +
    (service ? `&service=${service}` : '') +
    (location ? `&location=${location}` : '');

  const { data } = useSWR<
    {
      data: {
        count: number;
      };
    },
    Error
  >(service ? apiUrl : null, openmrsFetch);

  return {
    serviceCount: data ? data?.data?.count : 0,
  };
}
