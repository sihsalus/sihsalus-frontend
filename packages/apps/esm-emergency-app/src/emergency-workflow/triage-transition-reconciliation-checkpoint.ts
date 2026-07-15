import { logError } from '@openmrs/esm-framework';

const checkpointPrefix = 'openmrs:emergency-triage-transition:v1:';

export interface TriageTransitionReconciliationCheckpoint {
  version: 1;
  sourceQueueEntryUuid: string;
  patientUuid: string;
  visitUuid: string;
  sourceQueueUuid: string;
  sourceStatusUuid: string;
  targetQueueUuid: string;
  targetStatusUuid: string;
  targetPriorityUuid: string;
}

function checkpointKey(sourceQueueEntryUuid: string) {
  return `${checkpointPrefix}${sourceQueueEntryUuid}`;
}

function isCheckpoint(value: unknown): value is TriageTransitionReconciliationCheckpoint {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const checkpoint = value as Partial<TriageTransitionReconciliationCheckpoint>;
  return (
    checkpoint.version === 1 &&
    [
      checkpoint.sourceQueueEntryUuid,
      checkpoint.patientUuid,
      checkpoint.visitUuid,
      checkpoint.sourceQueueUuid,
      checkpoint.sourceStatusUuid,
      checkpoint.targetQueueUuid,
      checkpoint.targetStatusUuid,
      checkpoint.targetPriorityUuid,
    ].every((item) => typeof item === 'string' && item.trim().length > 0)
  );
}

function removeCheckpoint(sourceQueueEntryUuid: string): boolean {
  try {
    const storage = globalThis.sessionStorage;
    if (!storage) {
      return false;
    }
    storage.removeItem(checkpointKey(sourceQueueEntryUuid));
    return true;
  } catch (error) {
    logError(error, 'Remove emergency triage transition reconciliation checkpoint');
    return false;
  }
}

export function loadTriageTransitionCheckpoint(
  sourceQueueEntryUuid: string,
): TriageTransitionReconciliationCheckpoint | null {
  try {
    const serialized = globalThis.sessionStorage?.getItem(checkpointKey(sourceQueueEntryUuid));
    if (!serialized) {
      return null;
    }

    const checkpoint: unknown = JSON.parse(serialized);
    if (!isCheckpoint(checkpoint) || checkpoint.sourceQueueEntryUuid !== sourceQueueEntryUuid) {
      removeCheckpoint(sourceQueueEntryUuid);
      return null;
    }
    return checkpoint;
  } catch (error) {
    logError(error, 'Load emergency triage transition reconciliation checkpoint');
    removeCheckpoint(sourceQueueEntryUuid);
    return null;
  }
}

export function saveTriageTransitionCheckpoint(checkpoint: TriageTransitionReconciliationCheckpoint): boolean {
  try {
    const storage = globalThis.sessionStorage;
    if (!storage) {
      return false;
    }
    storage.setItem(checkpointKey(checkpoint.sourceQueueEntryUuid), JSON.stringify(checkpoint));
    return true;
  } catch (error) {
    logError(error, 'Save emergency triage transition reconciliation checkpoint');
    return false;
  }
}

export function clearTriageTransitionCheckpoint(sourceQueueEntryUuid: string): boolean {
  return removeCheckpoint(sourceQueueEntryUuid);
}
