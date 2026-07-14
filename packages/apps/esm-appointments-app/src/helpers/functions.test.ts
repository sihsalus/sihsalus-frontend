import { AppointmentStatus } from '../types';
import { canTransition } from './functions';

describe('canTransition', () => {
  it.each([
    [AppointmentStatus.REQUESTED, AppointmentStatus.SCHEDULED],
    [AppointmentStatus.SCHEDULED, AppointmentStatus.ARRIVED],
    [AppointmentStatus.SCHEDULED, AppointmentStatus.CHECKEDIN],
    [AppointmentStatus.ARRIVED, AppointmentStatus.CHECKEDIN],
    [AppointmentStatus.CHECKEDIN, AppointmentStatus.COMPLETED],
    [AppointmentStatus.SCHEDULED, AppointmentStatus.CANCELLED],
    [AppointmentStatus.SCHEDULED, AppointmentStatus.MISSED],
  ])('allows %s -> %s', (fromStatus, toStatus) => {
    expect(canTransition(fromStatus, toStatus)).toBe(true);
  });

  it.each([
    [AppointmentStatus.REQUESTED, AppointmentStatus.COMPLETED],
    [AppointmentStatus.SCHEDULED, AppointmentStatus.COMPLETED],
    [AppointmentStatus.WAITLIST, AppointmentStatus.SCHEDULED],
    [AppointmentStatus.CHECKEDIN, AppointmentStatus.SCHEDULED],
    [AppointmentStatus.COMPLETED, AppointmentStatus.SCHEDULED],
    [AppointmentStatus.CANCELLED, AppointmentStatus.SCHEDULED],
    [AppointmentStatus.MISSED, AppointmentStatus.SCHEDULED],
  ])('rejects %s -> %s', (fromStatus, toStatus) => {
    expect(canTransition(fromStatus, toStatus)).toBe(false);
  });
});
