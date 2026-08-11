import dayjs from 'dayjs';
import { type Appointment } from '../types';
import { resolveAppointmentFormDefaults } from './appointments-form.workspace';

describe('resolveAppointmentFormDefaults', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function atSystemTime(isoLocal: string) {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(isoLocal));
  }

  it('suggests the next full hour instead of the current time for a new appointment', () => {
    atSystemTime('2026-08-11T10:20:00');

    const defaults = resolveAppointmentFormDefaults(undefined, undefined, undefined);

    expect(defaults.defaultAppointmentStartTime).toBe('11:00');
    expect(defaults.defaultTimeFormat).toBe('AM');
    expect(dayjs(defaults.defaultStartDate).format('YYYY-MM-DD')).toBe('2026-08-11');
  });

  it('suggests noon as PM when the next full hour is 12:00', () => {
    atSystemTime('2026-08-11T11:35:00');

    const defaults = resolveAppointmentFormDefaults(undefined, undefined, undefined);

    expect(defaults.defaultAppointmentStartTime).toBe('12:00');
    expect(defaults.defaultTimeFormat).toBe('PM');
  });

  it('moves the suggested date to tomorrow when the next full hour crosses midnight', () => {
    atSystemTime('2026-08-11T23:30:00');

    const defaults = resolveAppointmentFormDefaults(undefined, undefined, undefined);

    expect(defaults.defaultAppointmentStartTime).toBe('12:00');
    expect(defaults.defaultTimeFormat).toBe('AM');
    expect(dayjs(defaults.defaultStartDate).format('YYYY-MM-DD')).toBe('2026-08-12');
    expect(defaults.defaultStartDateText).toBe(dayjs('2026-08-12').format('DD/MM/YYYY'));
  });

  it('keeps the calendar-selected date while still suggesting the next full hour', () => {
    atSystemTime('2026-08-11T10:20:00');

    const defaults = resolveAppointmentFormDefaults(undefined, undefined, '2026-08-20T00:00:00');

    expect(dayjs(defaults.defaultStartDate).format('YYYY-MM-DD')).toBe('2026-08-20');
    expect(defaults.defaultAppointmentStartTime).toBe('11:00');
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
