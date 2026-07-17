import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';

import type { AppointmentPayload, RecurringAppointmentsPayload } from '../types';
import { saveAppointment, saveRecurringAppointments } from './appointments-form.resource';

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
      'Recurring appointment end date cannot be before its start date',
    );
    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
  });
});
