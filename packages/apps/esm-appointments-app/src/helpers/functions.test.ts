import esTranslations from '../../translations/es.json';
import { AppointmentKind, AppointmentStatus } from '../types';
import {
  canTransition,
  getAppointmentKindLabel,
  getAppointmentStatusLabel,
  isAppointmentEditable,
  isAppointmentServiceAvailableForGender,
} from './functions';

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

describe('isAppointmentEditable', () => {
  it.each([
    AppointmentStatus.REQUESTED,
    AppointmentStatus.WAITLIST,
    AppointmentStatus.SCHEDULED,
    AppointmentStatus.ARRIVED,
  ])('allows editing before admission: %s', (status) => {
    expect(isAppointmentEditable(status)).toBe(true);
  });

  it.each([
    AppointmentStatus.CHECKEDIN,
    AppointmentStatus.COMPLETED,
    AppointmentStatus.CANCELLED,
    AppointmentStatus.MISSED,
  ])('blocks editing after admission or a terminal state: %s', (status) => {
    expect(isAppointmentEditable(status)).toBe(false);
  });
});

describe('appointment labels', () => {
  const t = (_key: string, defaultValue: string) => defaultValue;

  it('uses localized labels for known backend values', () => {
    expect(getAppointmentStatusLabel(AppointmentStatus.CHECKEDIN, t)).toBe('Cita en progreso');
    expect(getAppointmentKindLabel(AppointmentKind.WALKIN, t)).toBe('Sin cita');
  });

  it('uses grammatical Spanish labels for appointment tabs and collections', () => {
    expect(esTranslations.checkedIn).toBe('Cita en progreso');
    expect(esTranslations.expectedAppointmentsTab).toBe('Esperadas');
    expect(esTranslations.inProgressAppointmentsTab).toBe('En progreso');
    expect(esTranslations.completedAppointmentsTab).toBe('Completadas');
    expect(esTranslations.cancelledAppointmentsTab).toBe('Canceladas');
    expect(esTranslations.expectedAppointments).toBe('Citas esperadas');
    expect(esTranslations.appointmentsInProgress).toBe('Citas en progreso');
    expect(esTranslations.completedAppointments).toBe('Citas completadas');
    expect(esTranslations.cancelledAppointments).toBe('Citas canceladas');
  });

  it('does not expose unknown backend values directly', () => {
    expect(getAppointmentStatusLabel('UnexpectedStatus', t)).toBe('Estado no reconocido');
    expect(getAppointmentKindLabel('UnexpectedKind', t)).toBe('Tipo no reconocido');
  });
});

describe('appointment service gender filtering', () => {
  it('hides obstetric services for male patients', () => {
    expect(isAppointmentServiceAvailableForGender({ name: 'Atención ambulatoria por obstetra' }, 'M')).toBe(false);
  });

  it('shows obstetric services for female patients', () => {
    expect(isAppointmentServiceAvailableForGender({ name: 'Atención ambulatoria por obstetra' }, 'F')).toBe(true);
  });

  it('keeps unrestricted services available for every patient', () => {
    expect(isAppointmentServiceAvailableForGender({ name: 'Consulta ambulatoria por médico general' }, 'M')).toBe(true);
    expect(isAppointmentServiceAvailableForGender({ name: 'Consulta ambulatoria por médico general' }, 'F')).toBe(true);
  });

  it('honors explicit service restrictions when provided by the backend', () => {
    expect(isAppointmentServiceAvailableForGender({ name: 'Servicio especializado', allowedGenders: ['F'] }, 'M')).toBe(
      false,
    );
  });
});
