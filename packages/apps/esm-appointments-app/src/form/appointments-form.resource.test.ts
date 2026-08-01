import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';

import type { AppointmentPayload, RecurringAppointmentsPayload } from '../types';
import {
  checkAppointmentConflict,
  checkRecurringAppointmentConflict,
  saveAppointment,
  saveRecurringAppointments,
} from './appointments-form.resource';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  openmrsFetch: vi.fn(),
  restBaseUrl: '/ws/rest/v1',
}));

const mockOpenmrsFetch = vi.mocked(openmrsFetch);
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
const validRecurringAppointments: RecurringAppointmentsPayload = {
  appointmentRequest: validAppointment,
  recurringPattern: {
    type: 'DAY',
    period: 1,
    endDate: '2026-07-20T23:59:00-05:00',
  },
};

describe('appointment writes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-17T12:00:00-05:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not call the API when a new appointment has a historical date', () => {
    const historicalAppointment = { ...validAppointment, startDateTime: '1742-01-01T09:00:00-05:00' };

    expect(() => saveAppointment(historicalAppointment, new AbortController())).toThrow(
      'Appointment start date cannot be in the past',
    );
    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
  });

  it('posts an appointment after its dates pass validation', () => {
    saveAppointment(validAppointment, new AbortController());

    expect(mockOpenmrsFetch).toHaveBeenCalledWith(
      `${restBaseUrl}/appointment`,
      expect.objectContaining({
        method: 'POST',
        body: validAppointment,
      }),
    );
  });

  it('posts the backend-compatible canonical all-day interval', () => {
    const allDayAppointment = {
      ...validAppointment,
      startDateTime: '2026-07-18T00:00:00.000-05:00',
      endDateTime: '2026-07-18T23:59:59.999-05:00',
    };

    saveAppointment(allDayAppointment, new AbortController());

    expect(mockOpenmrsFetch).toHaveBeenCalledWith(
      `${restBaseUrl}/appointment`,
      expect.objectContaining({
        method: 'POST',
        body: allDayAppointment,
      }),
    );
  });

  it('does not call any appointment API with a fractional-minute duration', async () => {
    const fractionalDuration = { ...validAppointment, endDateTime: '2026-07-18T09:30:30-05:00' };

    expect(() => saveAppointment(fractionalDuration, new AbortController())).toThrow(
      'Timed appointment duration must be a whole number between 1 and 1439 minutes',
    );
    await expect(checkAppointmentConflict(fractionalDuration)).rejects.toThrow(
      'Timed appointment duration must be a whole number between 1 and 1439 minutes',
    );
    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
  });

  it('does not call any API with a timed duration of 1440 minutes', async () => {
    const overlongAppointment = { ...validAppointment, endDateTime: '2026-07-19T09:00:00-05:00' };

    expect(() => saveAppointment(overlongAppointment, new AbortController())).toThrow(
      'Timed appointment duration must be a whole number between 1 and 1439 minutes',
    );
    await expect(checkAppointmentConflict(overlongAppointment)).rejects.toThrow(
      'Timed appointment duration must be a whole number between 1 and 1439 minutes',
    );
    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
  });

  it('only posts a historical edit when its original date is explicitly preserved', () => {
    const historicalAppointment = {
      ...validAppointment,
      uuid: 'appointment-uuid',
      startDateTime: '2025-06-10T09:00:00-05:00',
      endDateTime: '2025-06-10T09:30:00-05:00',
    };

    expect(() => saveAppointment(historicalAppointment, new AbortController())).toThrow(
      'Appointment start date cannot be in the past',
    );
    expect(mockOpenmrsFetch).not.toHaveBeenCalled();

    const originalStartDate = new Date(historicalAppointment.startDateTime);
    saveAppointment(historicalAppointment, new AbortController(), originalStartDate);

    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(1);
  });

  it('does not call the recurring API when its end date precedes its start date', () => {
    const payload: RecurringAppointmentsPayload = {
      appointmentRequest: validAppointment,
      recurringPattern: {
        type: 'DAY',
        period: 1,
        endDate: '2026-07-17T23:59:00-05:00',
      },
    };

    expect(() => saveRecurringAppointments(payload, new AbortController())).toThrow(
      'Recurring appointment end date must be between its start date and 365 days later',
    );
    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
  });

  it('does not call the recurring API with a manipulated repeat interval', () => {
    const payload: RecurringAppointmentsPayload = {
      ...validRecurringAppointments,
      recurringPattern: { ...validRecurringAppointments.recurringPattern, period: 1.5 },
    };

    expect(() => saveRecurringAppointments(payload, new AbortController())).toThrow(
      'Recurring appointment period must be a whole number between 1 and 356',
    );
    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
  });

  it('does not call the recurring conflict API when a weekly pattern has no weekday', () => {
    const payload: RecurringAppointmentsPayload = {
      ...validRecurringAppointments,
      recurringPattern: {
        ...validRecurringAppointments.recurringPattern,
        type: 'WEEK',
        daysOfWeek: [],
      },
    };

    expect(() => checkRecurringAppointmentConflict(payload)).toThrow(
      'A weekly recurring appointment must include at least one day of the week',
    );
    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
  });

  it('rejects malformed or ambiguous weekday payloads before calling the API', () => {
    const malformedWeekdays: RecurringAppointmentsPayload = {
      ...validRecurringAppointments,
      recurringPattern: {
        ...validRecurringAppointments.recurringPattern,
        type: 'WEEK',
        daysOfWeek: 'MONDAY' as unknown as Array<string>,
      },
    };
    const ambiguousDailyPattern: RecurringAppointmentsPayload = {
      ...validRecurringAppointments,
      recurringPattern: {
        ...validRecurringAppointments.recurringPattern,
        daysOfWeek: ['MONDAY'],
      },
    };

    expect(() => checkRecurringAppointmentConflict(malformedWeekdays)).toThrow(
      'Recurring appointment weekdays must be unique, valid days of the week',
    );
    expect(() => saveRecurringAppointments(ambiguousDailyPattern, new AbortController())).toThrow(
      'Recurring appointment weekdays must be unique, valid days of the week',
    );
    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
  });

  it('creates a recurring series with POST when the appointment has no UUID', () => {
    saveRecurringAppointments(validRecurringAppointments, new AbortController());

    expect(mockOpenmrsFetch).toHaveBeenCalledWith(
      `${restBaseUrl}/recurring-appointments`,
      expect.objectContaining({
        method: 'POST',
        body: validRecurringAppointments,
      }),
    );
  });

  it('edits a recurring series with PUT and the metadata required by the classic backend', () => {
    const recurringEdit: RecurringAppointmentsPayload = {
      ...validRecurringAppointments,
      appointmentRequest: { ...validAppointment, uuid: 'appointment-uuid' },
    };

    saveRecurringAppointments(recurringEdit, new AbortController());

    expect(mockOpenmrsFetch).toHaveBeenCalledWith(
      `${restBaseUrl}/recurring-appointments/appointment-uuid`,
      expect.objectContaining({
        method: 'PUT',
        body: {
          ...recurringEdit,
          applyForAll: true,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        },
      }),
    );
  });

  it('checks every occurrence through the recurring conflicts endpoint', () => {
    checkRecurringAppointmentConflict(validRecurringAppointments);

    expect(mockOpenmrsFetch).toHaveBeenCalledWith(`${restBaseUrl}/recurring-appointments/conflicts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: validRecurringAppointments,
    });
  });

  it('includes edit metadata when checking conflicts for an existing recurring series', () => {
    const recurringEdit: RecurringAppointmentsPayload = {
      ...validRecurringAppointments,
      appointmentRequest: { ...validAppointment, uuid: 'appointment-uuid' },
      applyForAll: false,
      timeZone: 'America/Lima',
    };

    checkRecurringAppointmentConflict(recurringEdit);

    expect(mockOpenmrsFetch).toHaveBeenCalledWith(`${restBaseUrl}/recurring-appointments/conflicts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: recurringEdit,
    });
  });
});
