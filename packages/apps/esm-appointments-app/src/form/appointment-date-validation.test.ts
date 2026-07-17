import type { AppointmentPayload, RecurringPattern } from '../types';
import {
  assertAppointmentPayloadDates,
  assertRecurringPatternDates,
  isAppointmentIssuedDateAllowed,
  isAppointmentStartDateAllowed,
  isRecurringAppointmentRangeAllowed,
} from './appointment-date-validation';

const today = new Date(2026, 6, 17, 12);
const validAppointment: AppointmentPayload = {
  appointmentKind: 'Scheduled',
  comments: '',
  dateAppointmentScheduled: '2026-07-17T09:00:00-05:00',
  endDateTime: '2026-07-18T09:30:00-05:00',
  locationUuid: 'location-uuid',
  patientUuid: 'patient-uuid',
  providers: [],
  serviceUuid: 'service-uuid',
  startDateTime: '2026-07-18T09:00:00-05:00',
};

describe('appointment date validation', () => {
  it('rejects historical dates when creating an appointment', () => {
    expect(isAppointmentStartDateAllowed(new Date(1742, 0, 1), 'creating', undefined, today)).toBe(false);
    expect(isAppointmentStartDateAllowed(new Date(2026, 6, 16), 'creating', undefined, today)).toBe(false);
  });

  it('accepts today and future dates when creating an appointment', () => {
    expect(isAppointmentStartDateAllowed(new Date(2026, 6, 17), 'creating', undefined, today)).toBe(true);
    expect(isAppointmentStartDateAllowed(new Date(2027, 0, 1), 'creating', undefined, today)).toBe(true);
  });

  it('preserves an existing historical appointment without permitting another historical date', () => {
    const originalStartDate = new Date(2025, 5, 10);

    expect(isAppointmentStartDateAllowed(new Date(2025, 5, 10), 'editing', originalStartDate, today)).toBe(true);
    expect(isAppointmentStartDateAllowed(new Date(2025, 5, 11), 'editing', originalStartDate, today)).toBe(false);
  });

  it('rejects future appointment issue dates', () => {
    expect(isAppointmentIssuedDateAllowed(new Date(2026, 6, 17), today)).toBe(true);
    expect(isAppointmentIssuedDateAllowed(new Date(2026, 6, 18), today)).toBe(false);
  });

  it('requires a recurring appointment to end on or after its start date', () => {
    expect(isRecurringAppointmentRangeAllowed(new Date(2026, 6, 17), new Date(2026, 6, 17))).toBe(true);
    expect(isRecurringAppointmentRangeAllowed(new Date(2026, 6, 17), new Date(2026, 6, 16))).toBe(false);
  });

  it('rejects invalid dates again at the API payload boundary', () => {
    expect(() =>
      assertAppointmentPayloadDates({ ...validAppointment, startDateTime: '1742-01-01T09:00:00-05:00' }, today),
    ).toThrow('Appointment start date cannot be in the past');
    expect(() =>
      assertAppointmentPayloadDates(
        { ...validAppointment, dateAppointmentScheduled: '2100-01-01T09:00:00-05:00' },
        today,
      ),
    ).toThrow('Appointment issue date cannot be in the future');
    expect(() =>
      assertAppointmentPayloadDates({ ...validAppointment, endDateTime: '2026-07-18T08:59:00-05:00' }, today),
    ).toThrow('Appointment end date must be after its start date');
  });

  it('rejects an inverted recurring range at the API payload boundary', () => {
    const recurringPattern: RecurringPattern = {
      type: 'DAY',
      period: 1,
      endDate: '2026-07-17T23:59:00-05:00',
    };

    expect(() => assertRecurringPatternDates(validAppointment, recurringPattern)).toThrow(
      'Recurring appointment end date cannot be before its start date',
    );
  });
});
