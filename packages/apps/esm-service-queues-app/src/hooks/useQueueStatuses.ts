import { useMemo } from 'react';

import type { Concept } from '../types';

import { useQueues } from './useQueues';

function useQueueStatuses() {
  const { queues, isLoading, error } = useQueues();

  const results = useMemo(() => {
    const allStatuses = (queues ?? [])
      .flatMap((queue) => queue?.allowedStatuses ?? [])
      .filter((status): status is Concept => Boolean(status?.uuid && status.display));

    const uuidSet = new Set<string>();

    const statuses: Array<Concept> = [];

    allStatuses.forEach((status) => {
      if (!uuidSet.has(status.uuid)) {
        uuidSet.add(status.uuid);
        statuses.push(status);
      }
    });

    return {
      statuses,
      isLoadingQueueStatuses: isLoading,
      queueStatusesError: error,
    };
  }, [error, isLoading, queues]);

  return results;
}
export default useQueueStatuses;
