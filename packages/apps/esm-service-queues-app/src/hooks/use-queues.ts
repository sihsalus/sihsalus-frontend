import { getLocale, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { useMemo } from 'react';
import useSWRImmutable from 'swr/immutable';

import { type Queue } from '../types';

export function useQueues(locationUuid?: string | null) {
  const customRepresentation =
    'custom:(uuid,display,name,description,service:(uuid,display),priorityConceptSet:(uuid,display),statusConceptSet:(uuid,display),allowedPriorities:(uuid,display),allowedStatuses:(uuid,display),location:(uuid,display))';
  const apiUrl = `${restBaseUrl}/queue?v=${customRepresentation}` + (locationUuid ? `&location=${locationUuid}` : '');

  const { data, ...rest } = useSWRImmutable<{ data: { results: Array<Queue> } }, Error>(apiUrl, openmrsFetch);

  const queues = useMemo(
    () => data?.data?.results.slice().sort((a, b) => a.display.localeCompare(b.display, getLocale())) ?? [],
    [data?.data?.results],
  );

  return {
    queues,
    ...rest,
  };
}
