import type { SavePatientTransactionManager } from './form-manager';

export type PersistRegistrationTransaction = () => Promise<void>;

const registrationSynchronizationError = 'The queued patient registration requires reconciliation.';

export function assertRegistrationTransactionCanResume(
  transaction: SavePatientTransactionManager,
  persist?: PersistRegistrationTransaction,
): void {
  if ((transaction.offlineSyncStarted && !persist) || Object.keys(transaction.pendingWrites ?? {}).length > 0) {
    throw new Error(registrationSynchronizationError);
  }
}

/**
 * Persist the attempted write before dispatch and the confirmed state before
 * continuing. An interrupted or ambiguous write must not be blindly repeated.
 * Online form submissions retain their existing in-memory transaction behavior.
 */
export async function runRegistrationWrite<T>(
  transaction: SavePatientTransactionManager,
  key: string,
  write: () => Promise<T>,
  persist?: PersistRegistrationTransaction,
): Promise<T> {
  if (!persist) {
    return write();
  }
  transaction.pendingWrites ??= {};
  if (transaction.pendingWrites[key]) {
    throw new Error(registrationSynchronizationError);
  }

  transaction.offlineSyncStarted = true;
  transaction.pendingWrites[key] = true;
  await persist();

  let result: T;
  try {
    result = await write();
  } catch (error) {
    // These responses explicitly reject the operation. A transport error, 5xx,
    // or cancellation may have happened after commit and needs reconciliation.
    const status = (error as { response?: { status?: number } })?.response?.status;
    if (status === 400 || status === 401 || status === 403 || status === 404 || status === 409 || status === 422) {
      delete transaction.pendingWrites[key];
      await persist();
    }
    throw error;
  }

  delete transaction.pendingWrites[key];
  await persist();
  return result;
}

export function hasRegistrationProgress(transaction?: SavePatientTransactionManager): boolean {
  return Boolean(
    transaction &&
      (transaction.patientSaved ||
        transaction.observationsSaved ||
        transaction.photoSaved ||
        transaction.promotionCompleted ||
        [
          transaction.pendingWrites,
          transaction.generatedIdentifiers,
          transaction.identifierRows,
          transaction.relationshipRows,
          transaction.deletedAttributeUuids,
          transaction.deletedIdentifierUuids,
          transaction.deletedNameUuids,
        ].some((state) => Object.keys(state ?? {}).length > 0)),
  );
}
