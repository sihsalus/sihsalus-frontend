import { syncDynamicOfflineData } from '@openmrs/esm-framework';

import {
  getDynamicFormDataEntriesFor,
  putDynamicFormDataEntryFor,
  removeDynamicFormDataEntryFor,
} from './offline-form-helpers';

const offlineFormMembershipLockName = 'openmrs-offline-form-membership';
const offlineFormAvailabilityUpdateErrorMessage = 'Offline form availability could not be changed.';
let offlineFormOperationFallback = Promise.resolve();

/**
 * Runs a complete form-membership or background-refresh operation inside the shared boundary.
 * Callers must not nest serialized form operations.
 */
export function serializeOfflineFormOperation<T>(operation: () => Promise<T>): Promise<T> {
  const lockManager = globalThis.navigator?.locks;

  if (lockManager) {
    return lockManager.request(offlineFormMembershipLockName, operation);
  }

  const result = offlineFormOperationFallback.then(operation, operation);
  offlineFormOperationFallback = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

export async function updateOfflineFormAvailability(userId: string, formUuid: string, checked: boolean): Promise<void> {
  const fixedError = new Error(offlineFormAvailabilityUpdateErrorMessage);

  try {
    await serializeOfflineFormOperation(async () => {
      if (!checked) {
        await removeDynamicFormDataEntryFor(userId, formUuid);
        return;
      }

      const currentEntries = await getDynamicFormDataEntriesFor(userId);
      const wasAlreadyRegistered = currentEntries.some((entry) => entry.identifier === formUuid);

      if (!wasAlreadyRegistered) {
        await putDynamicFormDataEntryFor(userId, formUuid);
      }

      try {
        await syncDynamicOfflineData('form', formUuid);
      } catch {
        if (!wasAlreadyRegistered) {
          try {
            await removeDynamicFormDataEntryFor(userId, formUuid);
          } catch {
            console.error('Failed to roll back an incomplete offline form registration.');
          }
        }

        throw fixedError;
      }
    });
  } catch {
    throw fixedError;
  }
}
