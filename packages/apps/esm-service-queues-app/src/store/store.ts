import { createGlobalStore, useStore } from '@openmrs/esm-framework';

export const ALL_APPOINTMENT_STATUSES = '';

const ALL_QUEUE_LOCATIONS = 'all';
const queueLocationSelectionKey = 'queueLocationSelection';

export function updateValueInSessionStorage(key: string, value: string | null | undefined) {
  if (value === undefined || value === null) {
    sessionStorage.removeItem(key);
  } else {
    sessionStorage.setItem(key, value);
  }
}

export function getValueFromSessionStorage(key: string): string | null {
  return sessionStorage.getItem(key);
}

export interface ServiceQueuesState {
  selectedQueueLocationName?: string | null;
  selectedQueueLocationUuid?: string | null;
  queueLocationSelectionInitialized: boolean;
  selectedServiceUuid?: string | null;
  selectedServiceDisplay?: string | null;
  selectedQueueStatusUuid?: string | null;
  selectedQueueStatusDisplay?: string | null;
  selectedAppointmentStatus: string;
  selectedQueueRoomTimestamp: Date;
  isPermanentProviderQueueRoom: boolean;
  /** Set by the emergency app while its UI replaces the standard metrics/table */
  emergencyUiActive?: boolean;
}

const persistedQueueLocationUuid = getValueFromSessionStorage('queueLocationUuid');
const persistedQueueLocationSelection = getValueFromSessionStorage(queueLocationSelectionKey);

const initialServiceQueuesState: ServiceQueuesState = {
  selectedQueueLocationName: getValueFromSessionStorage('queueLocationName'),
  selectedQueueLocationUuid: persistedQueueLocationUuid,
  queueLocationSelectionInitialized:
    Boolean(persistedQueueLocationUuid) || persistedQueueLocationSelection === ALL_QUEUE_LOCATIONS,
  selectedServiceUuid: getValueFromSessionStorage('queueServiceUuid'),
  selectedServiceDisplay: getValueFromSessionStorage('queueServiceDisplay'),
  selectedQueueStatusUuid: getValueFromSessionStorage('queueStatusUuid'),
  selectedQueueStatusDisplay: getValueFromSessionStorage('queueStatusDisplay'),
  selectedAppointmentStatus: ALL_APPOINTMENT_STATUSES,
  selectedQueueRoomTimestamp: new Date(),
  isPermanentProviderQueueRoom: getValueFromSessionStorage('isPermanentProviderQueueRoom') === 'true',
  emergencyUiActive: false,
};

const serviceQueuesStore = createGlobalStore<ServiceQueuesState>('serviceQueues', initialServiceQueuesState);

export const updateSelectedService = (currentServiceUuid: string | null | undefined, currentServiceDisplay: string) => {
  updateValueInSessionStorage('queueServiceUuid', currentServiceUuid);
  updateValueInSessionStorage('queueServiceDisplay', currentServiceDisplay);
  serviceQueuesStore.setState({
    selectedServiceUuid: currentServiceUuid,
    selectedServiceDisplay: currentServiceDisplay,
  });
};

export const updateSelectedQueueLocationName = (currentLocationName: string | null | undefined) => {
  updateValueInSessionStorage('queueLocationName', currentLocationName);
  serviceQueuesStore.setState({ selectedQueueLocationName: currentLocationName });
};

export const updateSelectedQueueLocationUuid = (currentLocationUuid: string | null | undefined) => {
  updateValueInSessionStorage('queueLocationUuid', currentLocationUuid);
  updateValueInSessionStorage(
    queueLocationSelectionKey,
    currentLocationUuid ? null : ALL_QUEUE_LOCATIONS,
  );
  serviceQueuesStore.setState({
    selectedQueueLocationUuid: currentLocationUuid,
    queueLocationSelectionInitialized: true,
  });
};

export const updateSelectedQueueStatus = (
  currentQueueStatusUuid: string | null | undefined,
  currentQueueStatusDisplay: string | null | undefined,
) => {
  updateValueInSessionStorage('queueStatusUuid', currentQueueStatusUuid);
  updateValueInSessionStorage('queueStatusDisplay', currentQueueStatusDisplay);
  serviceQueuesStore.setState({
    selectedQueueStatusUuid: currentQueueStatusUuid,
    selectedQueueStatusDisplay: currentQueueStatusDisplay,
  });
};

export const updateSelectedAppointmentStatus = (selectedAppointmentStatus: string) => {
  serviceQueuesStore.setState({ selectedAppointmentStatus });
};

export const updateSelectedQueueRoomTimestamp = (selectedQueueRoomTimestamp: Date) => {
  serviceQueuesStore.setState({ selectedQueueRoomTimestamp });
};

export const updateIsPermanentProviderQueueRoom = (isPermanentProviderQueueRoom: boolean) => {
  updateValueInSessionStorage('isPermanentProviderQueueRoom', String(isPermanentProviderQueueRoom));
  serviceQueuesStore.setState({ isPermanentProviderQueueRoom });
};

export function useServiceQueuesStore() {
  return useStore(serviceQueuesStore);
}
