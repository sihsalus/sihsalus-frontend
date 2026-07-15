import { logError } from '@openmrs/esm-framework';

import {
  areSameAppointmentServicePayloads,
  type AppointmentServiceCreatePayload,
} from './appointment-services-hook';

export const APPOINTMENT_SERVICE_CREATION_CHECKPOINT_KEY = 'openmrs:appointments:service-create:v1';
export const APPOINTMENT_SERVICE_CREATION_CHECKPOINT_MAX_AGE_MS = 2 * 60 * 60 * 1000;

export class AppointmentServiceCreationCheckpointInvalidError extends Error {
  constructor() {
    super('The stored appointment service creation checkpoint is invalid.');
    this.name = 'AppointmentServiceCreationCheckpointInvalidError';
  }
}

export interface AppointmentServiceCreationScope {
  sessionId: string;
  userUuid: string;
}

export interface AppointmentServiceCreationCheckpoint {
  version: 1;
  attemptId: string;
  createdAt: number;
  state: 'create-pending';
  payload: AppointmentServiceCreatePayload;
  baselineUuids: Array<string>;
  scope: AppointmentServiceCreationScope;
}

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const checkpointTimePattern = /^(?:[01]\d|2[0-3]):[0-5]\d:00$/u;

const checkpointTimeToMinutes = (value: string) => {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
};

function isPayload(value: unknown): value is AppointmentServiceCreatePayload {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const payload = value as Partial<AppointmentServiceCreatePayload>;
  const startTime = typeof payload.startTime === 'string' ? payload.startTime : '';
  const endTime = typeof payload.endTime === 'string' ? payload.endTime : '';
  const startMinutes = checkpointTimePattern.test(startTime) ? checkpointTimeToMinutes(startTime) : null;
  const endMinutes = checkpointTimePattern.test(endTime) ? checkpointTimeToMinutes(endTime) : null;
  return (
    isNonEmptyString(payload.name) &&
    payload.name.trim().length <= 50 &&
    startMinutes !== null &&
    endMinutes !== null &&
    endMinutes > startMinutes &&
    Number.isInteger(payload.durationMins) &&
    (payload.durationMins as number) >= 1 &&
    (payload.durationMins as number) <= 1440 &&
    (payload.durationMins as number) <= endMinutes - startMinutes &&
    /^#[0-9a-f]{6}$/iu.test(payload.color ?? '') &&
    isNonEmptyString(payload.locationUuid)
  );
}

function isCheckpoint(value: unknown): value is AppointmentServiceCreationCheckpoint {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const checkpoint = value as Partial<AppointmentServiceCreationCheckpoint>;
  return (
    checkpoint.version === 1 &&
    isNonEmptyString(checkpoint.attemptId) &&
    checkpoint.state === 'create-pending' &&
    typeof checkpoint.createdAt === 'number' &&
    Number.isFinite(checkpoint.createdAt) &&
    checkpoint.createdAt <= Date.now() + 60_000 &&
    Date.now() - checkpoint.createdAt <= APPOINTMENT_SERVICE_CREATION_CHECKPOINT_MAX_AGE_MS &&
    isPayload(checkpoint.payload) &&
    Array.isArray(checkpoint.baselineUuids) &&
    checkpoint.baselineUuids.every(isNonEmptyString) &&
    new Set(checkpoint.baselineUuids).size === checkpoint.baselineUuids.length &&
    !!checkpoint.scope &&
    isNonEmptyString(checkpoint.scope.sessionId) &&
    isNonEmptyString(checkpoint.scope.userUuid)
  );
}

export function appointmentServiceCreationScopesMatch(
  left: AppointmentServiceCreationScope,
  right: AppointmentServiceCreationScope,
) {
  return left.sessionId === right.sessionId && left.userUuid === right.userUuid;
}

export function appointmentServiceCreationCheckpointsMatch(
  checkpoint: AppointmentServiceCreationCheckpoint,
  payload: AppointmentServiceCreatePayload,
  scope: AppointmentServiceCreationScope,
) {
  return (
    areSameAppointmentServicePayloads(checkpoint.payload, payload) &&
    appointmentServiceCreationScopesMatch(checkpoint.scope, scope)
  );
}

export function loadAppointmentServiceCreationCheckpoint(): AppointmentServiceCreationCheckpoint | null {
  try {
    const serialized = globalThis.sessionStorage?.getItem(APPOINTMENT_SERVICE_CREATION_CHECKPOINT_KEY);
    if (!serialized) {
      return null;
    }
    const checkpoint: unknown = JSON.parse(serialized);
    if (!isCheckpoint(checkpoint)) {
      throw new AppointmentServiceCreationCheckpointInvalidError();
    }
    return checkpoint;
  } catch (error) {
    logError(error, 'Load appointment service creation checkpoint');
    if (error instanceof AppointmentServiceCreationCheckpointInvalidError) {
      throw error;
    }
    throw new AppointmentServiceCreationCheckpointInvalidError();
  }
}

export function saveAppointmentServiceCreationCheckpoint(
  checkpoint: AppointmentServiceCreationCheckpoint,
): boolean {
  if (!isCheckpoint(checkpoint)) {
    return false;
  }
  try {
    const storage = globalThis.sessionStorage;
    if (!storage) {
      return false;
    }
    if (storage.getItem(APPOINTMENT_SERVICE_CREATION_CHECKPOINT_KEY) !== null) {
      return false;
    }
    const serialized = JSON.stringify(checkpoint);
    storage.setItem(APPOINTMENT_SERVICE_CREATION_CHECKPOINT_KEY, serialized);
    return storage.getItem(APPOINTMENT_SERVICE_CREATION_CHECKPOINT_KEY) === serialized;
  } catch (error) {
    logError(error, 'Save appointment service creation checkpoint');
    return false;
  }
}

export function clearAppointmentServiceCreationCheckpoint(expectedAttemptId: string): boolean {
  if (!isNonEmptyString(expectedAttemptId)) {
    return false;
  }
  try {
    const storage = globalThis.sessionStorage;
    if (!storage) {
      return false;
    }
    const serialized = storage.getItem(APPOINTMENT_SERVICE_CREATION_CHECKPOINT_KEY);
    if (!serialized) {
      return false;
    }
    const checkpoint: unknown = JSON.parse(serialized);
    if (!isCheckpoint(checkpoint) || checkpoint.attemptId !== expectedAttemptId) {
      return false;
    }
    storage.removeItem(APPOINTMENT_SERVICE_CREATION_CHECKPOINT_KEY);
    return storage.getItem(APPOINTMENT_SERVICE_CREATION_CHECKPOINT_KEY) === null;
  } catch (error) {
    logError(error, 'Clear appointment service creation checkpoint');
    return false;
  }
}
