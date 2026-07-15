import { logError } from '@openmrs/esm-framework';

const checkpointKey = 'openmrs:emergency-patient-registration:v1';

export interface EmergencyPatientRegistrationCheckpoint {
  version: 1;
  identifier: string;
  identifierSourceUuid: string;
  identifierTypeUuid: string;
  locationUuid: string;
}

function isCheckpoint(value: unknown): value is EmergencyPatientRegistrationCheckpoint {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const checkpoint = value as Partial<EmergencyPatientRegistrationCheckpoint>;
  return (
    checkpoint.version === 1 &&
    [
      checkpoint.identifier,
      checkpoint.identifierSourceUuid,
      checkpoint.identifierTypeUuid,
      checkpoint.locationUuid,
    ].every((item) => typeof item === 'string' && item.trim().length > 0)
  );
}

export function loadEmergencyPatientRegistrationCheckpoint(): EmergencyPatientRegistrationCheckpoint | null {
  try {
    const serialized = globalThis.sessionStorage?.getItem(checkpointKey);
    if (!serialized) {
      return null;
    }

    const checkpoint: unknown = JSON.parse(serialized);
    if (!isCheckpoint(checkpoint)) {
      clearEmergencyPatientRegistrationCheckpoint();
      return null;
    }
    return checkpoint;
  } catch (error) {
    logError(error, 'Load emergency patient registration checkpoint');
    clearEmergencyPatientRegistrationCheckpoint();
    return null;
  }
}

export function saveEmergencyPatientRegistrationCheckpoint(
  checkpoint: EmergencyPatientRegistrationCheckpoint,
): boolean {
  try {
    const storage = globalThis.sessionStorage;
    if (!storage) {
      return false;
    }
    storage.setItem(checkpointKey, JSON.stringify(checkpoint));
    return true;
  } catch (error) {
    logError(error, 'Save emergency patient registration checkpoint');
    return false;
  }
}

export function clearEmergencyPatientRegistrationCheckpoint(): boolean {
  try {
    const storage = globalThis.sessionStorage;
    if (!storage) {
      return false;
    }
    storage.removeItem(checkpointKey);
    return true;
  } catch (error) {
    logError(error, 'Clear emergency patient registration checkpoint');
    return false;
  }
}
