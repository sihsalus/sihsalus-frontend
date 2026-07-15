import {
  APPOINTMENT_SERVICE_CREATION_CHECKPOINT_KEY,
  APPOINTMENT_SERVICE_CREATION_CHECKPOINT_MAX_AGE_MS,
  type AppointmentServiceCreationCheckpoint,
  AppointmentServiceCreationCheckpointInvalidError,
  appointmentServiceCreationCheckpointsMatch,
  clearAppointmentServiceCreationCheckpoint,
  loadAppointmentServiceCreationCheckpoint,
  saveAppointmentServiceCreationCheckpoint,
} from './appointment-service-creation-checkpoint';

const checkpoint: AppointmentServiceCreationCheckpoint = {
  version: 1,
  attemptId: 'attempt-one',
  state: 'create-pending',
  createdAt: Date.now(),
  payload: {
    name: 'Medicina general',
    startTime: '08:00:00',
    endTime: '17:00:00',
    durationMins: 30,
    color: '#0f62fe',
    locationUuid: 'location-uuid',
  },
  baselineUuids: ['existing-service-uuid'],
  scope: { sessionId: 'session-id', userUuid: 'user-uuid' },
};

describe('appointment service creation checkpoint', () => {
  beforeEach(() => {
    globalThis.sessionStorage.clear();
  });

  it('persists, validates, and clears a pending create', () => {
    expect(saveAppointmentServiceCreationCheckpoint(checkpoint)).toBe(true);
    expect(loadAppointmentServiceCreationCheckpoint()).toEqual(checkpoint);
    expect(clearAppointmentServiceCreationCheckpoint(checkpoint.attemptId)).toBe(true);
    expect(loadAppointmentServiceCreationCheckpoint()).toBeNull();
  });

  it('never overwrites or clears a checkpoint owned by another attempt', () => {
    expect(saveAppointmentServiceCreationCheckpoint(checkpoint)).toBe(true);
    expect(
      saveAppointmentServiceCreationCheckpoint({
        ...checkpoint,
        attemptId: 'attempt-two',
      }),
    ).toBe(false);
    expect(clearAppointmentServiceCreationCheckpoint('attempt-two')).toBe(false);
    expect(loadAppointmentServiceCreationCheckpoint()).toEqual(checkpoint);
    expect(clearAppointmentServiceCreationCheckpoint(checkpoint.attemptId)).toBe(true);
  });

  it('matches only the same normalized payload and authenticated session', () => {
    expect(
      appointmentServiceCreationCheckpointsMatch(
        checkpoint,
        { ...checkpoint.payload, name: ' MEDICINA   GENERAL ', color: '#0F62FE' },
        { ...checkpoint.scope },
      ),
    ).toBe(true);
    expect(
      appointmentServiceCreationCheckpointsMatch(
        checkpoint,
        { ...checkpoint.payload, durationMins: 45 },
        checkpoint.scope,
      ),
    ).toBe(false);
    expect(
      appointmentServiceCreationCheckpointsMatch(
        checkpoint,
        checkpoint.payload,
        { ...checkpoint.scope, userUuid: 'other-user' },
      ),
    ).toBe(false);
  });

  it('fails closed on malformed or expired stored state', () => {
    globalThis.sessionStorage.setItem(APPOINTMENT_SERVICE_CREATION_CHECKPOINT_KEY, '{"version":1}');
    expect(() => loadAppointmentServiceCreationCheckpoint()).toThrow(
      AppointmentServiceCreationCheckpointInvalidError,
    );

    globalThis.sessionStorage.setItem(
      APPOINTMENT_SERVICE_CREATION_CHECKPOINT_KEY,
      JSON.stringify({
        ...checkpoint,
        createdAt: Date.now() - APPOINTMENT_SERVICE_CREATION_CHECKPOINT_MAX_AGE_MS - 1,
      }),
    );
    expect(() => loadAppointmentServiceCreationCheckpoint()).toThrow(
      AppointmentServiceCreationCheckpointInvalidError,
    );
  });

  it('rejects payloads that bypass the service schedule constraints', () => {
    expect(
      saveAppointmentServiceCreationCheckpoint({
        ...checkpoint,
        payload: { ...checkpoint.payload, endTime: '07:00:00' },
      }),
    ).toBe(false);
    expect(
      saveAppointmentServiceCreationCheckpoint({
        ...checkpoint,
        payload: { ...checkpoint.payload, durationMins: 600 },
      }),
    ).toBe(false);
  });

  it('fails closed when session storage cannot persist the checkpoint', () => {
    const storageSpy = vi.spyOn(globalThis.sessionStorage, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    expect(saveAppointmentServiceCreationCheckpoint(checkpoint)).toBe(false);
    storageSpy.mockRestore();
  });
});
