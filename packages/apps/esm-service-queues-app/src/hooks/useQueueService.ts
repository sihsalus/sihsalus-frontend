import { getLocale } from '@openmrs/esm-framework';
import uniqBy from 'lodash-es/uniqBy';
import { useMemo } from 'react';

import { useServiceQueuesStore } from '../store/store';

import { useQueues } from './useQueues';

function useQueueServices() {
  const { selectedQueueLocationUuid } = useServiceQueuesStore();
  const { queues, isLoading } = useQueues(selectedQueueLocationUuid);

  const results = useMemo(() => {
    const uniqueServices = uniqBy(
      queues.flatMap((queue) => queue.service),
      (service) => service?.uuid,
    );
    const sortedServices = uniqueServices.slice().sort((a, b) => a.display.localeCompare(b.display, getLocale()));

    return {
      services: sortedServices,
      isLoadingQueueServices: isLoading,
    };
  }, [queues, isLoading]);

  return results;
}

export default useQueueServices;
