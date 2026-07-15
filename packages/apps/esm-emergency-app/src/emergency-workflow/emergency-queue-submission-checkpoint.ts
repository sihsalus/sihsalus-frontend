import { logError } from '@openmrs/esm-framework';

const checkpointKey = 'openmrs:emergency-queue-submission:v1';

export interface EmergencyQueueSubmissionCheckpoint {
  version: 1;
  patientUuid: string;
  visitUuid: string;
  priorityUuid: string;
  statusUuid: string;
  queueUuid: string;
}

function isCheckpoint(value: unknown): value is EmergencyQueueSubmissionCheckpoint {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const checkpoint = value as Partial<EmergencyQueueSubmissionCheckpoint>;
  return (
    checkpoint.version === 1 &&
    typeof checkpoint.patientUuid === 'string' &&
    typeof checkpoint.visitUuid === 'string' &&
    typeof checkpoint.priorityUuid === 'string' &&
    typeof checkpoint.statusUuid === 'string' &&
    typeof checkpoint.queueUuid === 'string'
  );
}

export function loadEmergencyQueueSubmissionCheckpoint(): EmergencyQueueSubmissionCheckpoint | null {
  try {
    const serialized = globalThis.sessionStorage?.getItem(checkpointKey);
    if (!serialized) {
      return null;
    }
    const checkpoint: unknown = JSON.parse(serialized);
    if (!isCheckpoint(checkpoint)) {
      clearEmergencyQueueSubmissionCheckpoint();
      return null;
    }
    return checkpoint;
  } catch (error) {
    logError(error, 'Load emergency queue submission checkpoint');
    clearEmergencyQueueSubmissionCheckpoint();
    return null;
  }
}

export function saveEmergencyQueueSubmissionCheckpoint(checkpoint: EmergencyQueueSubmissionCheckpoint): boolean {
  try {
    const storage = globalThis.sessionStorage;
    if (!storage) {
      return false;
    }
    storage.setItem(checkpointKey, JSON.stringify(checkpoint));
    return true;
  } catch (error) {
    logError(error, 'Save emergency queue submission checkpoint');
    return false;
  }
}

export function clearEmergencyQueueSubmissionCheckpoint(): boolean {
  try {
    const storage = globalThis.sessionStorage;
    if (!storage) {
      return false;
    }
    storage.removeItem(checkpointKey);
    return true;
  } catch (error) {
    logError(error, 'Clear emergency queue submission checkpoint');
    return false;
  }
}
