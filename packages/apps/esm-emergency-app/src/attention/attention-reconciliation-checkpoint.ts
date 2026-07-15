import { logError } from '@openmrs/esm-framework';

import { type EmergencyQueueEntry } from '../resources/emergency.resource';

const checkpointPrefix = 'openmrs:emergency-attention-reconciliation:v1:';

export type AttentionReconciliationCheckpoint =
  | {
      version: 1;
      state: 'encounter-returned';
      queueEntryUuid: string;
      patientUuid: string;
      visitUuid: string;
      encounterUuid: string;
    }
  | {
      version: 1;
      state: 'create-unverified';
      queueEntryUuid: string;
      patientUuid: string;
      visitUuid: string;
    };

function checkpointKey(queueEntryUuid: string) {
  return `${checkpointPrefix}${queueEntryUuid}`;
}

function isCheckpoint(value: unknown): value is AttentionReconciliationCheckpoint {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const checkpoint = value as Partial<AttentionReconciliationCheckpoint>;
  return (
    checkpoint.version === 1 &&
    (checkpoint.state === 'encounter-returned' || checkpoint.state === 'create-unverified') &&
    typeof checkpoint.queueEntryUuid === 'string' &&
    typeof checkpoint.patientUuid === 'string' &&
    typeof checkpoint.visitUuid === 'string' &&
    (checkpoint.state !== 'encounter-returned' || typeof checkpoint.encounterUuid === 'string')
  );
}

function removeStoredCheckpoint(queueEntryUuid: string): boolean {
  try {
    const storage = globalThis.sessionStorage;
    if (!storage) {
      return false;
    }
    storage.removeItem(checkpointKey(queueEntryUuid));
    return true;
  } catch (error) {
    logError(error, 'Remove emergency attention reconciliation checkpoint');
    return false;
  }
}

/**
 * Loads only a checkpoint that still matches the current queue, patient and visit.
 * Clinical form values are deliberately never stored in browser storage.
 */
export function loadAttentionCheckpoint(
  queueEntry: Pick<EmergencyQueueEntry, 'uuid' | 'patient' | 'visit'>,
): AttentionReconciliationCheckpoint | null {
  const visitUuid = queueEntry.visit?.uuid;
  if (!visitUuid) {
    return null;
  }

  try {
    const serialized = globalThis.sessionStorage?.getItem(checkpointKey(queueEntry.uuid));
    if (!serialized) {
      return null;
    }

    const checkpoint: unknown = JSON.parse(serialized);
    if (
      !isCheckpoint(checkpoint) ||
      checkpoint.queueEntryUuid !== queueEntry.uuid ||
      checkpoint.patientUuid !== queueEntry.patient.uuid ||
      checkpoint.visitUuid !== visitUuid
    ) {
      removeStoredCheckpoint(queueEntry.uuid);
      return null;
    }

    return checkpoint;
  } catch (error) {
    logError(error, 'Load emergency attention reconciliation checkpoint');
    removeStoredCheckpoint(queueEntry.uuid);
    return null;
  }
}

export function saveAttentionCheckpoint(checkpoint: AttentionReconciliationCheckpoint): boolean {
  try {
    const storage = globalThis.sessionStorage;
    if (!storage) {
      return false;
    }
    storage.setItem(checkpointKey(checkpoint.queueEntryUuid), JSON.stringify(checkpoint));
    return true;
  } catch (error) {
    logError(error, 'Save emergency attention reconciliation checkpoint');
    return false;
  }
}

export function clearAttentionCheckpoint(queueEntryUuid: string): boolean {
  return removeStoredCheckpoint(queueEntryUuid);
}
