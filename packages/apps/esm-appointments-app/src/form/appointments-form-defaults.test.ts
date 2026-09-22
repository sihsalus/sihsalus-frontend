import dayjs from 'dayjs';
import { type Appointment, type RecurringPattern } from '../types';
import { resolveAppointmentFormDefaults } from './appointments-form.workspace';

describe.each(['UTC', 'America/Lima'])('resolveAppointmentFormDefaults in %s', (timeZone) => {
  beforeEach(() => {
    vi.stubEnv('TZ', timeZone);
    expect(new Date('2026-09-01T00:00:00Z').getTimezoneOffset()).toBe(timeZone === 'America/Lima' ? 300 : 0);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  function atSystemTime(isoLocal: string) {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(isoLocal));
  }

  it('suggests the next half-hour mark instead of the current time for a new appointment', () => {
    atSystemTime('2026-08-11T10:20:00');

    const defaults = resolveAppointmentFormDefaults(undefined, undefined, undefined);

    expect(defaults.defaultAppointmentStartTime).toBe('10:30');
    expect(defaults.defaultTimeFormat).toBe('AM');
    expect(dayjs(defaults.defaultStartDate).format('YYYY-MM-DD')).toBe('2026-08-11');
  });

  it('rolls to the next hour when past the half-hour mark', () => {
    atSystemTime('2026-08-11T10:35:00');

    const defaults = resolveAppointmentFormDefaults(undefined, undefined, undefined);

    expect(defaults.defaultAppointmentStartTime).toBe('11:00');
    expect(defaults.defaultTimeFormat).toBe('AM');
  });

  it('always suggests a strictly later time, even on an exact boundary', () => {
    atSystemTime('2026-08-11T10:00:00');

    const defaults = resolveAppointmentFormDefaults(undefined, undefined, undefined);

    expect(defaults.defaultAppointmentStartTime).toBe('10:30');
  });

  it('suggests noon as PM when the next half-hour mark is 12:00', () => {
    atSystemTime('2026-08-11T11:35:00');

    const defaults = resolveAppointmentFormDefaults(undefined, undefined, undefined);

    expect(defaults.defaultAppointmentStartTime).toBe('12:00');
    expect(defaults.defaultTimeFormat).toBe('PM');
  });

  it('moves the suggested date to tomorrow when the next half-hour mark crosses midnight', () => {
    atSystemTime('2026-08-11T23:45:00');

    const defaults = resolveAppointmentFormDefaults(undefined, undefined, undefined);

    expect(defaults.defaultAppointmentStartTime).toBe('12:00');
    expect(defaults.defaultTimeFormat).toBe('AM');
    expect(dayjs(defaults.defaultStartDate).format('YYYY-MM-DD')).toBe('2026-08-12');
    expect(defaults.defaultStartDateText).toBe(dayjs('2026-08-12').format('DD/MM/YYYY'));
  });

  it('keeps the calendar-selected date while still suggesting the next half-hour mark', () => {
    atSystemTime('2026-08-11T10:20:00');

    const defaults = resolveAppointmentFormDefaults(undefined, undefined, '2026-08-20T00:00:00');

    expect(dayjs(defaults.defaultStartDate).format('YYYY-MM-DD')).toBe('2026-08-20');
    expect(defaults.defaultAppointmentStartTime).toBe('10:30');
  });

  it.each([
    '2026-09-01',
    '2026-12-31',
    '2027-01-01',
    '2028-02-29',
  ])('keeps a calendar date without an offset on the same local day: %s', (selectedDate) => {
    atSystemTime('2026-08-11T10:20:00');
    const defaults = resolveAppointmentFormDefaults(undefined, undefined, selectedDate);
    expect(dayjs(defaults.defaultStartDate).format('YYYY-MM-DD')).toBe(selectedDate);
    expect(defaults.defaultStartDateText).toBe(dayjs(defaults.defaultStartDate).format('DD/MM/YYYY'));
  });

  it('preserves an explicit instant while using the local day for a recurring end date', () => {
    atSystemTime('2026-08-11T10:20:00');
    const appointment = {
      startDateTime: '2027-01-01T04:30:00Z',
      endDateTime: '2027-01-01T04:50:00Z',
    } as Appointment;
    const defaults = resolveAppointmentFormDefaults(
      appointment,
      { endDate: '2027-01-15' } as RecurringPattern,
      undefined,
    );
    expect(defaults.defaultStartDate.toISOString()).toBe('2027-01-01T04:30:00.000Z');
    expect(defaults.defaultStartDateText).toBe(dayjs(appointment.startDateTime).format('DD/MM/YYYY'));
    expect(dayjs(defaults.defaultEndDate).format('YYYY-MM-DD')).toBe('2027-01-15');
    expect(defaults.defaultEndDateText).toBe('15/01/2027');
  });

  it('preserves the stored time when editing an existing appointment', () => {
    atSystemTime('2026-08-11T10:20:00');

    const appointment = { startDateTime: '2026-08-15T16:45:00', endDateTime: '2026-08-15T17:05:00' } as Appointment;
    const defaults = resolveAppointmentFormDefaults(appointment, undefined, undefined);

    expect(defaults.defaultAppointmentStartTime).toBe('04:45');
    expect(defaults.defaultTimeFormat).toBe('PM');
    expect(dayjs(defaults.defaultStartDate).format('YYYY-MM-DD')).toBe('2026-08-15');
    expect(defaults.defaultDuration).toBe(20);
  });
});
