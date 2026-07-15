import { logError } from '@openmrs/esm-framework';

import { type EmergencyQueueEntry } from '../resources/emergency.resource';

const checkpointPrefix = 'openmrs:emergency-serve-patient:v1:';

export interface ServePatientReconciliationCheckpoint {
  version: 1;
  queueEntryUuid: string;
  patientUuid: string;
  visitUuid: string;
  queueUuid: string;
  targetStatusUuid: string;
}

function checkpointKey(queueEntryUuid: string) {
  return `${checkpointPrefix}${queueEntryUuid}`;
}

function isCheckpoint(value: unknown): value is ServePatientReconciliationCheckpoint {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const checkpoint = value as Partial<ServePatientReconciliationCheckpoint>;
  return (
    checkpoint.version === 1 &&
    [
      checkpoint.queueEntryUuid,
      checkpoint.patientUuid,
      checkpoint.visitUuid,
      checkpoint.queueUuid,
      checkpoint.targetStatusUuid,
    ].every((item) => typeof item === 'string' && item.trim().length > 0)
  );
}

function removeCheckpoint(queueEntryUuid: string) {
  try {
    const storage = globalThis.sessionStorage;
    if (!storage) {
      return false;
    }
    storage.removeItem(checkpointKey(queueEntryUuid));
    return true;
  } catch (error) {
    logError(error, 'Remove emergency serve-patient reconciliation checkpoint');
    return false;
  }
}

export function loadServePatientCheckpoint(
  queueEntry: Pick<EmergencyQueueEntry, 'uuid' | 'patient' | 'visit' | 'queue'>,
  targetStatusUuid: string,
): ServePatientReconciliationCheckpoint | null {
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
      checkpoint.visitUuid !== visitUuid ||
      checkpoint.queueUuid !== queueEntry.queue.uuid ||
      checkpoint.targetStatusUuid !== targetStatusUuid
    ) {
      removeCheckpoint(queueEntry.uuid);
      return null;
    }
    return checkpoint;
  } catch (error) {
    logError(error, 'Load emergency serve-patient reconciliation checkpoint');
    removeCheckpoint(queueEntry.uuid);
    return null;
  }
}

export function saveServePatientCheckpoint(checkpoint: ServePatientReconciliationCheckpoint) {
  try {
    const storage = globalThis.sessionStorage;
    if (!storage) {
      return false;
    }
    storage.setItem(checkpointKey(checkpoint.queueEntryUuid), JSON.stringify(checkpoint));
    return true;
  } catch (error) {
    logError(error, 'Save emergency serve-patient reconciliation checkpoint');
    return false;
  }
}

export function clearServePatientCheckpoint(queueEntryUuid: string) {
  return removeCheckpoint(queueEntryUuid);
}
