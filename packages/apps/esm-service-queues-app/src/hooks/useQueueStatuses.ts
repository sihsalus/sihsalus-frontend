import { getLocale } from '@openmrs/esm-framework';
import { useMemo } from 'react';

import type { Concept } from '../types';

import { useQueues } from './useQueues';

function useQueueStatuses() {
  const { queues, isLoading } = useQueues();

  const results = useMemo(() => {
    const allStatuses = ([] as Array<Concept>).concat(...(queues ?? []).map((queue) => queue.allowedStatuses));

    const uuidSet = new Set<string>();

    const statuses: Array<Concept> = [];

    allStatuses.forEach((status) => {
      if (!uuidSet.has(status?.uuid)) {
        uuidSet.add(status?.uuid);
        statuses.push(status);
      }
    });

    return {
      statuses: statuses.slice().sort((a, b) => a.display.localeCompare(b.display, getLocale())),
      isLoadingQueueStatuses: isLoading,
    };
  }, [isLoading, queues]);

  return results;
}
export default useQueueStatuses;
