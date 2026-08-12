import { fetchCurrentPatient, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';

import type { AppointmentPayload, RecurringAppointmentsPayload } from '../types';
import {
  assertPatientCanReceiveAppointment,
  DECEASED_PATIENT_APPOINTMENT_BLOCKED,
  PATIENT_DEATH_STATUS_UNAVAILABLE,
  saveAppointment,
  saveRecurringAppointments,
} from './appointments-form.resource';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  fetchCurrentPatient: vi.fn(),
  openmrsFetch: vi.fn(),
  restBaseUrl: '/ws/rest/v1',
}));

const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const mockFetchCurrentPatient = vi.mocked(fetchCurrentPatient);
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

  it('uses a fresh online patient read before allowing an appointment', async () => {
    mockFetchCurrentPatient.mockResolvedValue({ id: 'patient-uuid', deceasedBoolean: false } as fhir.Patient);

    await expect(assertPatientCanReceiveAppointment('patient-uuid')).resolves.toBeUndefined();

    expect(mockFetchCurrentPatient).toHaveBeenCalledWith('patient-uuid', undefined, false);
  });

  it('rejects a new appointment for a deceased patient', async () => {
    mockFetchCurrentPatient.mockResolvedValue({
      id: 'patient-uuid',
      deceasedDateTime: '2026-08-12T15:41:28.000Z',
    } as fhir.Patient);

    await expect(assertPatientCanReceiveAppointment('patient-uuid')).rejects.toMatchObject({
      code: DECEASED_PATIENT_APPOINTMENT_BLOCKED,
    });
  });

  it('fails closed when the patient cannot be loaded', async () => {
    mockFetchCurrentPatient.mockResolvedValue(null);

    await expect(assertPatientCanReceiveAppointment('patient-uuid')).rejects.toMatchObject({
      code: PATIENT_DEATH_STATUS_UNAVAILABLE,
    });
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
      'Recurring appointment end date cannot be before its start date',
    );
    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
  });
});
