import { getLocale, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { useMemo } from 'react';
import useSWR from 'swr';

import { type Queue } from '../types';

export function useQueues(locationUuid?: string | null) {
  const customRepresentation =
    'custom:(uuid,display,name,description,service:(uuid,display),priorityConceptSet:(uuid,display),statusConceptSet:(uuid,display),allowedPriorities:(uuid,display),allowedStatuses:(uuid,display),location:(uuid,display))';
  const apiUrl = `${restBaseUrl}/queue?v=${customRepresentation}` + (locationUuid ? `&location=${locationUuid}` : '');

  const { data, ...rest } = useSWR<{ data: { results: Array<Queue> } }, Error>(apiUrl, openmrsFetch, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
  });

  const queues = useMemo(
    () => data?.data?.results.slice().sort((a, b) => a.display.localeCompare(b.display, getLocale())) ?? [],
    [data?.data?.results],
  );

  return {
    queues,
    ...rest,
  };
}
