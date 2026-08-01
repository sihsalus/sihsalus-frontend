import type { AppointmentPayload, RecurringPattern } from '../types';
import {
  areRecurringPatternWeekdaysAllowed,
  assertAppointmentPayloadDates,
  assertRecurringPatternDates,
  isAppointmentIssuedDateAllowed,
  isAppointmentStartDateAllowed,
  isRecurringAppointmentRangeAllowed,
  isRecurringPatternPeriodAllowed,
  isTimedAppointmentDurationAllowed,
  MAX_RECURRING_APPOINTMENT_HORIZON_DAYS,
  resolveEffectiveAppointmentStartDate,
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

  it('forces today for a new appointment when start-date editing is not authorized', () => {
    const effectiveDate = resolveEffectiveAppointmentStartDate(new Date(2030, 0, 1), {
      canEditStartDate: false,
      context: 'creating',
      today,
    });

    expect(effectiveDate.getFullYear()).toBe(2026);
    expect(effectiveDate.getMonth()).toBe(6);
    expect(effectiveDate.getDate()).toBe(17);
  });

  it('preserves the original day when an edit is not authorized to move the appointment', () => {
    const originalStartDate = new Date(2026, 6, 18, 9);
    const effectiveDate = resolveEffectiveAppointmentStartDate(new Date(2030, 0, 1), {
      canEditStartDate: false,
      context: 'editing',
      originalStartDate,
      today,
    });

    expect(effectiveDate).toEqual(originalStartDate);
    expect(effectiveDate).not.toBe(originalStartDate);
  });

  it('keeps a future day selected by a user with the start-date privilege', () => {
    const requestedDate = new Date(2030, 0, 1);

    expect(
      resolveEffectiveAppointmentStartDate(requestedDate, {
        canEditStartDate: true,
        context: 'creating',
        today,
      }),
    ).toEqual(requestedDate);
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

  it('limits recurring appointment creation to a one-year horizon', () => {
    const startDate = new Date(2026, 6, 17);

    expect(
      isRecurringAppointmentRangeAllowed(startDate, new Date(2027, 6, 17), MAX_RECURRING_APPOINTMENT_HORIZON_DAYS),
    ).toBe(true);
    expect(
      isRecurringAppointmentRangeAllowed(startDate, new Date(2027, 6, 18), MAX_RECURRING_APPOINTMENT_HORIZON_DAYS),
    ).toBe(false);
  });

  it('rejects invalid dates again at the API payload boundary', () => {
    expect(() =>
      assertAppointmentPayloadDates({ ...validAppointment, startDateTime: '1742-01-01T09:00:00-05:00' }, { today }),
    ).toThrow('Appointment start date cannot be in the past');
    expect(() =>
      assertAppointmentPayloadDates(
        { ...validAppointment, dateAppointmentScheduled: '2100-01-01T09:00:00-05:00' },
        { today },
      ),
    ).toThrow('Appointment issue date cannot be in the future');
    expect(() =>
      assertAppointmentPayloadDates({ ...validAppointment, endDateTime: '2026-07-18T08:59:00-05:00' }, { today }),
    ).toThrow('Appointment end date must be after its start date');
  });

  it('accepts only whole-minute timed appointment durations from 1 through 1439 minutes', () => {
    expect(isTimedAppointmentDurationAllowed(1)).toBe(true);
    expect(isTimedAppointmentDurationAllowed(1439)).toBe(true);
    expect(isTimedAppointmentDurationAllowed(0)).toBe(false);
    expect(isTimedAppointmentDurationAllowed(1.5)).toBe(false);
    expect(isTimedAppointmentDurationAllowed(1440)).toBe(false);
  });

  it('rejects fractional and overlong durations again at the API payload boundary', () => {
    expect(() =>
      assertAppointmentPayloadDates(
        { ...validAppointment, endDateTime: '2026-07-18T09:00:30-05:00' },
        { today },
      ),
    ).toThrow('Timed appointment duration must be a whole number between 1 and 1439 minutes');
    expect(() =>
      assertAppointmentPayloadDates(
        { ...validAppointment, endDateTime: '2026-07-19T09:01:00-05:00' },
        { today },
      ),
    ).toThrow('Timed appointment duration must be a whole number between 1 and 1439 minutes');
    expect(() =>
      assertAppointmentPayloadDates(
        { ...validAppointment, endDateTime: '2026-07-19T09:00:00-05:00' },
        { today },
      ),
    ).toThrow('Timed appointment duration must be a whole number between 1 and 1439 minutes');
    expect(() =>
      assertAppointmentPayloadDates(
        { ...validAppointment, endDateTime: '2026-07-19T08:59:00-05:00' },
        { today },
      ),
    ).not.toThrow();
  });

  it('accepts only the canonical start-of-day through end-of-day fractional interval', () => {
    const canonicalAllDayAppointment = {
      ...validAppointment,
      startDateTime: '2026-07-18T00:00:00.000-05:00',
      endDateTime: '2026-07-18T23:59:59.999-05:00',
    };

    expect(() => assertAppointmentPayloadDates(canonicalAllDayAppointment, { today })).not.toThrow();
    expect(() =>
      assertAppointmentPayloadDates(
        {
          ...canonicalAllDayAppointment,
          startDateTime: '2026-07-18T09:00:00.000-05:00',
          endDateTime: '2026-07-19T08:59:59.999-05:00',
        },
        { today },
      ),
    ).toThrow('Timed appointment duration must be a whole number between 1 and 1439 minutes');
    expect(() =>
      assertAppointmentPayloadDates(
        { ...canonicalAllDayAppointment, endDateTime: '2026-07-18T23:59:59-05:00' },
        { today },
      ),
    ).toThrow('Timed appointment duration must be a whole number between 1 and 1439 minutes');
  });

  it('only preserves an edited historical date when the original date is supplied and unchanged', () => {
    const historicalAppointment = {
      ...validAppointment,
      uuid: 'appointment-uuid',
      startDateTime: '2025-06-10T09:00:00-05:00',
      endDateTime: '2025-06-10T09:30:00-05:00',
    };

    expect(() => assertAppointmentPayloadDates(historicalAppointment, { today })).toThrow(
      'Appointment start date cannot be in the past',
    );
    expect(() =>
      assertAppointmentPayloadDates(historicalAppointment, {
        originalStartDate: new Date('2025-06-10T09:00:00-05:00'),
        today,
      }),
    ).not.toThrow();
    expect(() =>
      assertAppointmentPayloadDates(
        { ...historicalAppointment, startDateTime: '2025-06-11T09:00:00-05:00' },
        { originalStartDate: new Date('2025-06-10T09:00:00-05:00'), today },
      ),
    ).toThrow('Appointment start date cannot be in the past');
  });

  it('rejects an inverted recurring range at the API payload boundary', () => {
    const recurringPattern: RecurringPattern = {
      type: 'DAY',
      period: 1,
      endDate: '2026-07-17T23:59:00-05:00',
    };

    expect(() => assertRecurringPatternDates(validAppointment, recurringPattern)).toThrow(
      'Recurring appointment end date must be between its start date and 365 days later',
    );
  });

  it('rejects a recurring range beyond the API horizon', () => {
    const recurringPattern: RecurringPattern = {
      type: 'DAY',
      period: 1,
      endDate: '2027-07-19T23:59:00-05:00',
    };

    expect(() => assertRecurringPatternDates(validAppointment, recurringPattern)).toThrow(
      'Recurring appointment end date must be between its start date and 365 days later',
    );
  });

  it('accepts recurring periods at both integer boundaries', () => {
    expect(isRecurringPatternPeriodAllowed(1)).toBe(true);
    expect(isRecurringPatternPeriodAllowed(356)).toBe(true);
    expect(() =>
      assertRecurringPatternDates(validAppointment, {
        type: 'DAY',
        period: 356,
        endDate: '2026-07-20T23:59:00-05:00',
      }),
    ).not.toThrow();
  });

  it.each([0, 1.5, 357])('rejects manipulated recurring period %s', (period) => {
    expect(() =>
      assertRecurringPatternDates(validAppointment, {
        type: 'DAY',
        period,
        endDate: '2026-07-20T23:59:00-05:00',
      }),
    ).toThrow('Recurring appointment period must be a whole number between 1 and 356');
  });

  it('requires at least one valid, unique weekday for weekly recurrence', () => {
    expect(areRecurringPatternWeekdaysAllowed('WEEK', ['MONDAY'])).toBe(true);
    expect(areRecurringPatternWeekdaysAllowed('WEEK', [])).toBe(false);
    expect(areRecurringPatternWeekdaysAllowed('WEEK', ['FUNDAY'])).toBe(false);
    expect(areRecurringPatternWeekdaysAllowed('WEEK', ['MONDAY', 'MONDAY'])).toBe(false);
    expect(areRecurringPatternWeekdaysAllowed('WEEK', 'MONDAY')).toBe(false);
    expect(areRecurringPatternWeekdaysAllowed('DAY', [])).toBe(true);
    expect(areRecurringPatternWeekdaysAllowed('DAY', ['MONDAY'])).toBe(false);

    expect(() =>
      assertRecurringPatternDates(validAppointment, {
        type: 'WEEK',
        period: 1,
        endDate: '2026-07-20T23:59:00-05:00',
        daysOfWeek: [],
      }),
    ).toThrow('A weekly recurring appointment must include at least one day of the week');
    expect(() =>
      assertRecurringPatternDates(validAppointment, {
        type: 'WEEK',
        period: 1,
        endDate: '2026-07-20T23:59:00-05:00',
        daysOfWeek: ['FUNDAY'],
      }),
    ).toThrow('Recurring appointment weekdays must be unique, valid days of the week');
    expect(() =>
      assertRecurringPatternDates(validAppointment, {
        type: 'DAY',
        period: 1,
        endDate: '2026-07-20T23:59:00-05:00',
        daysOfWeek: ['MONDAY'],
      }),
    ).toThrow('Recurring appointment weekdays must be unique, valid days of the week');
  });
});
