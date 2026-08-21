import type { OfflineSynchronizationStore } from '@openmrs/esm-framework/src/internal';
import { translateFrom } from '@openmrs/esm-framework';
import { getOfflineSynchronizationStore, showNotification } from '@openmrs/esm-framework/src/internal';

const moduleName = '@sihsalus/esm-offline-tools-app';

let showNewModalOnNextSynchronization = true;
let currentSynchronizationIndex = 0;

export function setupSynchronizingOfflineActionsNotifications() {
  const store = getOfflineSynchronizationStore();
  const onChange = (state: OfflineSynchronizationStore) => {
    if (!state.synchronization) {
      showNewModalOnNextSynchronization = true;
    }

    if (showNewModalOnNextSynchronization && state.synchronization) {
      showNewModalOnNextSynchronization = false;
      currentSynchronizationIndex++;

      const activeSynchronizationIndex = currentSynchronizationIndex;
      showNotification({
        title: translateFrom(moduleName, 'offlineActionsSynchronizationNotificationTitle', 'Upload'),
        description: translateFrom(
          moduleName,
          'offlineActionsSynchronizationNotificationStarted',
          'Offline action upload started. Review pending actions for current status.',
        ),
        action: translateFrom(
          moduleName,
          'offlineActionsSynchronizationNotificationCancelUpload',
          'Cancel upload',
        ),
        onAction: () => {
          const state = getOfflineSynchronizationStore().getState();
          if (activeSynchronizationIndex === currentSynchronizationIndex) {
            state.synchronization?.abortController.abort();
          }
        },
      });
    }
  };

  return store.subscribe(onChange);
}
