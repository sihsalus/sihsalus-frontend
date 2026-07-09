import { createGlobalStore, useStore } from '@openmrs/esm-framework';

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
  selectedServiceUuid?: string | null;
  selectedServiceDisplay?: string | null;
  selectedQueueStatusUuid?: string | null;
  selectedQueueStatusDisplay?: string | null;
  selectedAppointmentStatus: string;
  selectedQueueRoomTimestamp: Date;
  isPermanentProviderQueueRoom: boolean;
}

const initialServiceQueuesState: ServiceQueuesState = {
  selectedQueueLocationName: getValueFromSessionStorage('queueLocationName'),
  selectedQueueLocationUuid: getValueFromSessionStorage('queueLocationUuid'),
  selectedServiceUuid: getValueFromSessionStorage('queueServiceUuid'),
  selectedServiceDisplay: getValueFromSessionStorage('queueServiceDisplay'),
  selectedQueueStatusUuid: getValueFromSessionStorage('queueStatusUuid'),
  selectedQueueStatusDisplay: getValueFromSessionStorage('queueStatusDisplay'),
  selectedAppointmentStatus: '',
  selectedQueueRoomTimestamp: new Date(),
  isPermanentProviderQueueRoom: getValueFromSessionStorage('isPermanentProviderQueueRoom') === 'true',
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
  serviceQueuesStore.setState({ selectedQueueLocationUuid: currentLocationUuid });
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
