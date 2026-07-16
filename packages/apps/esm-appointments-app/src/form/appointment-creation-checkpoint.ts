import { logError } from '@openmrs/esm-framework';

export const APPOINTMENT_CREATION_CHECKPOINT_STORAGE_KEY = 'openmrs:appointments:create:v1';
export const APPOINTMENT_CREATION_CHECKPOINT_INVALID = 'APPOINTMENT_CREATION_CHECKPOINT_INVALID';

export class AppointmentCreationCheckpointInvalidError extends Error {
  readonly code = APPOINTMENT_CREATION_CHECKPOINT_INVALID;

  constructor() {
    super('The stored appointment creation checkpoint is invalid or cannot be read.');
    this.name = 'AppointmentCreationCheckpointInvalidError';
  }
}

export interface AppointmentCreationCheckpoint {
  version: 1;
  state: 'create-pending';
  attemptId: string;
  createdAt: number;
  payloadFingerprint: string;
  recurring: boolean;
}

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

export function getAppointmentCreationCheckpointStorageKey(patientUuid: string) {
  if (!isNonEmptyString(patientUuid)) {
    throw new AppointmentCreationCheckpointInvalidError();
  }
  return `${APPOINTMENT_CREATION_CHECKPOINT_STORAGE_KEY}:${patientUuid.trim()}`;
}

function isCheckpoint(value: unknown): value is AppointmentCreationCheckpoint {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const checkpoint = value as Partial<AppointmentCreationCheckpoint>;
  return (
    checkpoint.version === 1 &&
    checkpoint.state === 'create-pending' &&
    isNonEmptyString(checkpoint.attemptId) &&
    typeof checkpoint.createdAt === 'number' &&
    Number.isFinite(checkpoint.createdAt) &&
    checkpoint.createdAt <= Date.now() + 60_000 &&
    typeof checkpoint.payloadFingerprint === 'string' &&
    /^[0-9a-f]{64}$/u.test(checkpoint.payloadFingerprint) &&
    typeof checkpoint.recurring === 'boolean'
  );
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalize(entry)]),
  );
}

export async function fingerprintAppointmentCreationPayload(payload: unknown): Promise<string | null> {
  try {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) {
      return null;
    }
    const serialized = JSON.stringify(canonicalize(payload));
    const digest = await subtle.digest('SHA-256', new TextEncoder().encode(serialized));
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  } catch (error) {
    logError(error, 'Fingerprint appointment creation payload');
    return null;
  }
}

export function loadAppointmentCreationCheckpoint(patientUuid: string): AppointmentCreationCheckpoint | null {
  try {
    const serialized = globalThis.sessionStorage?.getItem(getAppointmentCreationCheckpointStorageKey(patientUuid));
    if (!serialized) {
      return null;
    }
    const checkpoint: unknown = JSON.parse(serialized);
    if (!isCheckpoint(checkpoint)) {
      throw new AppointmentCreationCheckpointInvalidError();
    }
    return checkpoint;
  } catch (error) {
    logError(error, 'Load appointment creation checkpoint');
    if (error instanceof AppointmentCreationCheckpointInvalidError) {
      throw error;
    }
    throw new AppointmentCreationCheckpointInvalidError();
  }
}

export function saveAppointmentCreationCheckpoint(
  checkpoint: AppointmentCreationCheckpoint,
  patientUuid: string,
): boolean {
  if (!isCheckpoint(checkpoint)) {
    return false;
  }

  try {
    const storage = globalThis.sessionStorage;
    const storageKey = getAppointmentCreationCheckpointStorageKey(patientUuid);
    if (!storage || storage.getItem(storageKey) !== null) {
      return false;
    }
    const serialized = JSON.stringify(checkpoint);
    storage.setItem(storageKey, serialized);
    return storage.getItem(storageKey) === serialized;
  } catch (error) {
    logError(error, 'Save appointment creation checkpoint');
    return false;
  }
}

export function clearAppointmentCreationCheckpoint(expectedAttemptId: string, patientUuid: string): boolean {
  if (!isNonEmptyString(expectedAttemptId) || !isNonEmptyString(patientUuid)) {
    return false;
  }

  try {
    const storage = globalThis.sessionStorage;
    const storageKey = getAppointmentCreationCheckpointStorageKey(patientUuid);
    const serialized = storage?.getItem(storageKey);
    if (!storage || !serialized) {
      return false;
    }
    const checkpoint: unknown = JSON.parse(serialized);
    if (!isCheckpoint(checkpoint) || checkpoint.attemptId !== expectedAttemptId) {
      return false;
    }
    storage.removeItem(storageKey);
    return storage.getItem(storageKey) === null;
  } catch (error) {
    logError(error, 'Clear appointment creation checkpoint');
    return false;
  }
}
