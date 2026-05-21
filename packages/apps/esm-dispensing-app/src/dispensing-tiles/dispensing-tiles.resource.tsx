import { type FetchResponse, openmrsFetch, useConfig } from '@openmrs/esm-framework';
import useSWR from 'swr';
import useSWRImmutable from 'swr/immutable';
import type { PharmacyConfig } from '../config-schema';

// NOT CURRENTLY USED

export function useMetrics() {
  const metrics = {
    orders: 43,
    orders_for_home_delivery: 4,
    missed_collections: 12,
  };
  const { data, error } = useSWR<{ data: { results: {} } }, Error>(`/ws/rest/v1/queue?`, openmrsFetch);

  return {
    metrics: metrics,
    error,
    isLoading: !data && !error,
  };
}

export function useServices() {
  const { serviceConceptSetUuid } = useConfig<PharmacyConfig>();
  const apiUrl = `/ws/rest/v1/concept/${serviceConceptSetUuid}`;
  const { data } = useSWRImmutable<FetchResponse>(apiUrl, openmrsFetch);

  return {
    services: data ? data?.data?.setMembers?.map((setMember) => setMember?.display) : [],
  };
}
