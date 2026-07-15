import { getLocale } from '@openmrs/esm-framework';
import uniqBy from 'lodash-es/uniqBy';
import { useMemo } from 'react';

import { useServiceQueuesStore } from '../store/store';
import { type Concept } from '../types';

import { useQueues } from './useQueues';

function useQueueServices() {
  const { selectedQueueLocationUuid } = useServiceQueuesStore();
  const { queues, isLoading } = useQueues(selectedQueueLocationUuid);

  const results = useMemo(() => {
    const services = queues
      .map((queue): Concept | undefined => queue?.service)
      .filter((service): service is Concept => Boolean(service?.uuid && service.display));
    const uniqueServices = uniqBy(services, (service) => service.uuid);
    const sortedServices = uniqueServices.slice().sort((a, b) => a.display.localeCompare(b.display, getLocale()));

    return {
      services: sortedServices,
      isLoadingQueueServices: isLoading,
    };
  }, [queues, isLoading]);

  return results;
}

export default useQueueServices;
