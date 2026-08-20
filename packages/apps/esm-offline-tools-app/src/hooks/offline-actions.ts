import { fetchCurrentPatient, getFullSynchronizationItems, type SyncItem } from '@openmrs/esm-framework/src/internal';
import uniq from 'lodash-es/uniq';
import useSWR from 'swr';
import { useOfflineOwnerId } from './use-offline-owner';

export function usePendingSyncItems() {
  const ownerId = useOfflineOwnerId();
  return useSWR(ownerId ? ['offlineActions/pending', ownerId] : null, () => getFullSynchronizationItems());
}

export function useSyncItemPatients(syncItems?: Array<SyncItem>) {
  const ownerId = useOfflineOwnerId();
  const patientUuids = syncItems ? uniq(syncItems.map((item) => item?.descriptor?.patientUuid).filter(Boolean)) : null;

  return useSWR(ownerId && patientUuids ? ['offlineActions/patients', ownerId, ...patientUuids] : null, () =>
    Promise.all(patientUuids.map((id) => fetchCurrentPatient(id))),
  );
}
