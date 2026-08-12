import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { fetchFreshPatientVitalStatus } from '@openmrs/esm-patient-common-lib';

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
  openmrsFetch: vi.fn(),
  restBaseUrl: '/ws/rest/v1',
}));

vi.mock('@openmrs/esm-patient-common-lib', async () => ({
  ...(await vi.importActual('@openmrs/esm-patient-common-lib')),
  fetchFreshPatientVitalStatus: vi.fn(),
}));

const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const mockFetchFreshPatientVitalStatus = vi.mocked(fetchFreshPatientVitalStatus);
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
    mockFetchFreshPatientVitalStatus.mockResolvedValue({ dead: false, deathDate: null, isDeceased: false });
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-17T12:00:00-05:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses a fresh online patient read before allowing an appointment', async () => {
    mockFetchFreshPatientVitalStatus.mockResolvedValue({ dead: false, deathDate: null, isDeceased: false });

    await expect(assertPatientCanReceiveAppointment('patient-uuid')).resolves.toBeUndefined();

    expect(mockFetchFreshPatientVitalStatus).toHaveBeenCalledWith('patient-uuid');
  });

  it('rejects a new appointment for a deceased patient', async () => {
    mockFetchFreshPatientVitalStatus.mockResolvedValue({
      dead: true,
      deathDate: '2026-08-12T15:41:28.000Z',
      isDeceased: true,
    });

    await expect(assertPatientCanReceiveAppointment('patient-uuid')).rejects.toMatchObject({
      code: DECEASED_PATIENT_APPOINTMENT_BLOCKED,
    });
  });

  it('fails closed when the patient cannot be loaded', async () => {
    mockFetchFreshPatientVitalStatus.mockRejectedValue(new Error('network unavailable'));

    await expect(assertPatientCanReceiveAppointment('patient-uuid')).rejects.toMatchObject({
      code: PATIENT_DEATH_STATUS_UNAVAILABLE,
    });
  });

  it('does not call the API when a new appointment has a historical date', async () => {
    const historicalAppointment = { ...validAppointment, startDateTime: '1742-01-01T09:00:00-05:00' };

    await expect(saveAppointment(historicalAppointment, new AbortController())).rejects.toThrow(
      'Appointment start date cannot be in the past',
    );
    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
  });

  it('posts an appointment after its dates and fresh vital status pass validation', async () => {
    await saveAppointment(validAppointment, new AbortController());

    expect(mockFetchFreshPatientVitalStatus).toHaveBeenCalledWith(validAppointment.patientUuid);
    expect(mockOpenmrsFetch).toHaveBeenCalledWith(
      `${restBaseUrl}/appointment`,
      expect.objectContaining({
        method: 'POST',
        body: validAppointment,
      }),
    );
  });

  it('only posts a historical edit when its original date is explicitly preserved', async () => {
    const historicalAppointment = {
      ...validAppointment,
      uuid: 'appointment-uuid',
      startDateTime: '2025-06-10T09:00:00-05:00',
      endDateTime: '2025-06-10T09:30:00-05:00',
    };

    await expect(saveAppointment(historicalAppointment, new AbortController())).rejects.toThrow(
      'Appointment start date cannot be in the past',
    );
    expect(mockOpenmrsFetch).not.toHaveBeenCalled();

    const originalStartDate = new Date(historicalAppointment.startDateTime);
    await saveAppointment(historicalAppointment, new AbortController(), originalStartDate);

    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(1);
  });

  it('does not call the recurring API when its end date precedes its start date', async () => {
    const payload: RecurringAppointmentsPayload = {
      appointmentRequest: validAppointment,
      recurringPattern: {
        type: 'DAY',
        period: 1,
        endDate: '2026-07-17T23:59:00-05:00',
      },
    };

    await expect(saveRecurringAppointments(payload, new AbortController())).rejects.toThrow(
      'Recurring appointment end date cannot be before its start date',
    );
    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
  });

  it('does not post a direct appointment write when the patient is deceased', async () => {
    mockFetchFreshPatientVitalStatus.mockResolvedValue({ dead: true, deathDate: null, isDeceased: true });

    await expect(saveAppointment(validAppointment, new AbortController())).rejects.toMatchObject({
      code: DECEASED_PATIENT_APPOINTMENT_BLOCKED,
    });

    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
  });

  it('does not post a recurring appointment write when fresh vital status is unavailable', async () => {
    const payload: RecurringAppointmentsPayload = {
      appointmentRequest: validAppointment,
      recurringPattern: {
        type: 'DAY',
        period: 1,
        endDate: '2026-07-20T23:59:00-05:00',
      },
    };
    mockFetchFreshPatientVitalStatus.mockRejectedValue(new Error('network unavailable'));

    await expect(saveRecurringAppointments(payload, new AbortController())).rejects.toMatchObject({
      code: PATIENT_DEATH_STATUS_UNAVAILABLE,
    });

    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
  });
});
