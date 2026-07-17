import { getGlobalStore, useStore } from '@openmrs/esm-framework';
import { useEffect } from 'react';
import type { StoreApi } from 'zustand/vanilla';

/**
 * Service Queues Integration Utilities
 *
 * Utilities to integrate emergency-app with service-queues-app.
 * These functions help emergency components work within the service-queues context
 * by accessing the service-queues store when available.
 *
 * The store is accessed using getGlobalStore('serviceQueues') which is registered
 * in @openmrs/esm-service-queues-app.
 */

interface ServiceQueuesStore {
  selectedQueueLocationUuid?: string;
  selectedQueueLocationName?: string;
  selectedServiceUuid?: string;
  selectedServiceDisplay?: string;
  selectedQueueStatusUuid?: string;
  selectedQueueStatusDisplay?: string;
  /** When true, service-queues hides its standard metrics/table so the emergency UI replaces them */
  emergencyUiActive?: boolean;
}

/**
 * Attempts to get the service-queues store
 *
 * @returns The store instance, or null if not available
 */
function getServiceQueuesStore(): StoreApi<ServiceQueuesStore> | null {
  try {
    return getGlobalStore<ServiceQueuesStore>('serviceQueues', {
      selectedQueueLocationUuid: undefined,
      selectedQueueLocationName: undefined,
      selectedServiceUuid: undefined,
      selectedServiceDisplay: undefined,
      selectedQueueStatusUuid: undefined,
      selectedQueueStatusDisplay: '',
    }) as StoreApi<ServiceQueuesStore>;
  } catch {
    // Store not available, return null
    // This is expected when emergency-app is used standalone
    return null;
  }
}

/**
 * Hook to get the selected location UUID from service-queues store
 *
 * This hook subscribes to the service-queues store and returns the current location UUID.
 * Returns undefined if the store is not available (e.g., when emergency-app is used standalone).
 *
 * @returns The selected location UUID, or undefined
 */
export function useServiceQueuesLocation(): string | undefined {
  const store: StoreApi<Pick<ServiceQueuesStore, 'selectedQueueLocationUuid'>> = getServiceQueuesStore() ?? {
    getState: () => ({ selectedQueueLocationUuid: undefined }),
    setState: () => undefined,
    getInitialState: () => ({ selectedQueueLocationUuid: undefined }),
    subscribe: () => () => undefined,
    destroy: () => undefined,
  };

  const { selectedQueueLocationUuid } = useStore(store);
  return selectedQueueLocationUuid || undefined;
}

/**
 * Hook to get location and name from service-queues store
 *
 * This hook subscribes to the service-queues store and returns both location UUID and name.
 * Returns undefined values if the store is not available.
 *
 * @returns Object with locationUuid and locationName, or undefined values
 */
export function useServiceQueuesLocationAndName(): {
  locationUuid?: string;
  locationName?: string;
} {
  const store: StoreApi<Pick<ServiceQueuesStore, 'selectedQueueLocationUuid' | 'selectedQueueLocationName'>> =
    getServiceQueuesStore() ?? {
      getState: () => ({
        selectedQueueLocationUuid: undefined,
        selectedQueueLocationName: undefined,
      }),
      setState: () => undefined,
      getInitialState: () => ({
        selectedQueueLocationUuid: undefined,
        selectedQueueLocationName: undefined,
      }),
      subscribe: () => () => undefined,
      destroy: () => undefined,
    };

  const { selectedQueueLocationUuid, selectedQueueLocationName } = useStore(store);
  return {
    locationUuid: selectedQueueLocationUuid || undefined,
    locationName: selectedQueueLocationName || undefined,
  };
}

// Ref-counted claims so the queue-table and metrics extensions can independently
// mark the emergency UI as active without racing each other's unmount cleanup.
const emergencyUiClaims = new Set<symbol>();

/**
 * Declares that this component is rendering emergency UI in place of the
 * standard service-queues UI. service-queues reads `emergencyUiActive` from its
 * store and hides its default metrics/table while at least one claim is active.
 */
export function useEmergencyUiActiveClaim(active: boolean): void {
  useEffect(() => {
    if (!active) {
      return;
    }

    const store = getServiceQueuesStore();
    if (!store) {
      return;
    }

    const claim = Symbol('emergency-ui-claim');
    emergencyUiClaims.add(claim);
    store.setState({ emergencyUiActive: true });

    return () => {
      emergencyUiClaims.delete(claim);
      if (emergencyUiClaims.size === 0) {
        store.setState({ emergencyUiActive: false });
      }
    };
  }, [active]);
}

/**
 * Hook to get the active filters selected in service-queues.
 *
 * Emergency components use this when they are rendered inside service-queues so
 * the standard header filters remain authoritative.
 */
export function useServiceQueuesFilters(): {
  locationUuid?: string;
  locationName?: string;
  serviceUuid?: string;
  statusUuid?: string;
} {
  const store: StoreApi<
    Pick<
      ServiceQueuesStore,
      'selectedQueueLocationUuid' | 'selectedQueueLocationName' | 'selectedServiceUuid' | 'selectedQueueStatusUuid'
    >
  > = getServiceQueuesStore() ?? {
    getState: () => ({
      selectedQueueLocationUuid: undefined,
      selectedQueueLocationName: undefined,
      selectedServiceUuid: undefined,
      selectedQueueStatusUuid: undefined,
    }),
    setState: () => undefined,
    getInitialState: () => ({
      selectedQueueLocationUuid: undefined,
      selectedQueueLocationName: undefined,
      selectedServiceUuid: undefined,
      selectedQueueStatusUuid: undefined,
    }),
    subscribe: () => () => undefined,
    destroy: () => undefined,
  };

  const { selectedQueueLocationUuid, selectedQueueLocationName, selectedServiceUuid, selectedQueueStatusUuid } =
    useStore(store);
  return {
    locationUuid: selectedQueueLocationUuid || undefined,
    locationName: selectedQueueLocationName || undefined,
    serviceUuid: selectedServiceUuid || undefined,
    statusUuid: selectedQueueStatusUuid || undefined,
  };
}
