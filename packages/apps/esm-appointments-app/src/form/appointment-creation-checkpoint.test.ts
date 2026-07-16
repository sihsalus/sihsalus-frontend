import {
  AppointmentCreationCheckpointInvalidError,
  clearAppointmentCreationCheckpoint,
  fingerprintAppointmentCreationPayload,
  getAppointmentCreationCheckpointStorageKey,
  loadAppointmentCreationCheckpoint,
  saveAppointmentCreationCheckpoint,
  type AppointmentCreationCheckpoint,
} from './appointment-creation-checkpoint';

const patientUuid = 'patient-uuid';

const checkpoint: AppointmentCreationCheckpoint = {
  version: 1,
  state: 'create-pending',
  attemptId: 'attempt-uuid',
  createdAt: Date.now(),
  payloadFingerprint: 'a'.repeat(64),
  recurring: false,
};
const storageKey = getAppointmentCreationCheckpointStorageKey(patientUuid);

describe('appointment creation checkpoint', () => {
  beforeEach(() => {
    globalThis.sessionStorage.clear();
  });

  it('stores, validates and loads an appointment attempt without its clinical payload', () => {
    expect(saveAppointmentCreationCheckpoint(checkpoint, patientUuid)).toBe(true);
    expect(loadAppointmentCreationCheckpoint(patientUuid)).toEqual(checkpoint);
    expect(globalThis.sessionStorage.getItem(storageKey)).not.toContain('comments');
    expect(globalThis.sessionStorage.getItem(storageKey)).not.toContain('session-uuid');
    expect(globalThis.sessionStorage.getItem(storageKey)).not.toContain('user-uuid');
  });

  it('does not overwrite an unresolved appointment attempt', () => {
    expect(saveAppointmentCreationCheckpoint(checkpoint, patientUuid)).toBe(true);
    expect(
      saveAppointmentCreationCheckpoint(
        {
          ...checkpoint,
          attemptId: 'other-attempt',
          payloadFingerprint: 'b'.repeat(64),
        },
        patientUuid,
      ),
    ).toBe(false);
    expect(loadAppointmentCreationCheckpoint(patientUuid)).toEqual(checkpoint);
  });

  it('rejects malformed and future checkpoints', () => {
    for (const value of [
      '{"version":1}',
      JSON.stringify({ ...checkpoint, payloadFingerprint: 'not-a-sha256' }),
      JSON.stringify({ ...checkpoint, createdAt: Date.now() + 61_000 }),
    ]) {
      globalThis.sessionStorage.setItem(storageKey, value);
      expect(() => loadAppointmentCreationCheckpoint(patientUuid)).toThrow(AppointmentCreationCheckpointInvalidError);
    }
  });

  it('keeps an old unresolved checkpoint pending for the lifetime of the tab', () => {
    const oldCheckpoint = { ...checkpoint, createdAt: Date.now() - 24 * 60 * 60 * 1000 };
    globalThis.sessionStorage.setItem(storageKey, JSON.stringify(oldCheckpoint));
    expect(loadAppointmentCreationCheckpoint(patientUuid)).toEqual(oldCheckpoint);
  });

  it('clears only the expected appointment attempt', () => {
    expect(saveAppointmentCreationCheckpoint(checkpoint, patientUuid)).toBe(true);
    expect(clearAppointmentCreationCheckpoint('other-attempt', patientUuid)).toBe(false);
    expect(loadAppointmentCreationCheckpoint(patientUuid)).toEqual(checkpoint);
    expect(clearAppointmentCreationCheckpoint(checkpoint.attemptId, patientUuid)).toBe(true);
    expect(loadAppointmentCreationCheckpoint(patientUuid)).toBeNull();
  });

  it('isolates unresolved attempts by patient', () => {
    expect(saveAppointmentCreationCheckpoint(checkpoint, patientUuid)).toBe(true);
    expect(loadAppointmentCreationCheckpoint('another-patient')).toBeNull();
    expect(
      saveAppointmentCreationCheckpoint(
        {
          ...checkpoint,
          attemptId: 'another-attempt',
        },
        'another-patient',
      ),
    ).toBe(true);
    expect(loadAppointmentCreationCheckpoint(patientUuid)).toEqual(checkpoint);
    expect(loadAppointmentCreationCheckpoint('another-patient')?.attemptId).toBe('another-attempt');
  });

  it('creates a deterministic SHA-256 fingerprint independent of object key order', async () => {
    const first = await fingerprintAppointmentCreationPayload({
      patientUuid: 'patient-uuid',
      comments: 'confidential note',
      providers: [{ uuid: 'provider-uuid' }],
    });
    const reordered = await fingerprintAppointmentCreationPayload({
      providers: [{ uuid: 'provider-uuid' }],
      comments: 'confidential note',
      patientUuid: 'patient-uuid',
    });
    const changed = await fingerprintAppointmentCreationPayload({
      patientUuid: 'patient-uuid',
      comments: 'different note',
      providers: [{ uuid: 'provider-uuid' }],
    });

    expect(first).toMatch(/^[0-9a-f]{64}$/u);
    expect(reordered).toBe(first);
    expect(changed).not.toBe(first);
  });
});
