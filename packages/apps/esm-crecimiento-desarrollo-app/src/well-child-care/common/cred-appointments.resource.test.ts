import { openmrsFetch } from '@openmrs/esm-framework';
import { fetchFreshPatientVitalStatus } from '@openmrs/esm-patient-common-lib';

import { generateCREDSchedule } from '../../utils/cred-schedule-rules';

import {
  createCREDAppointments,
  DECEASED_PATIENT_CRED_APPOINTMENT_BLOCKED,
} from './cred-appointments.resource';

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

describe('createCREDAppointments', () => {
  beforeEach(() => {
    vi.useFakeTimers().setSystemTime(new Date('2026-07-10T12:00:00-05:00'));
    mockOpenmrsFetch.mockReset();
    mockFetchFreshPatientVitalStatus.mockResolvedValue({ dead: false, deathDate: null, isDeceased: false });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not send appointments with a historical target date', async () => {
    const historicalControl = { ...generateCREDSchedule('2025-01-01')[0], status: 'overdue' as const };

    const result = await createCREDAppointments(
      'patient-uuid',
      [historicalControl],
      'service-uuid',
      'location-uuid',
      30,
    );

    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
    expect(result.created).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
  });

  it('creates an appointment for a future ideal-age control', async () => {
    const futureControl = { ...generateCREDSchedule('2026-07-01')[10], status: 'future' as const };
    mockOpenmrsFetch.mockResolvedValueOnce({ data: { uuid: 'appointment-uuid' } } as Awaited<
      ReturnType<typeof openmrsFetch>
    >);

    const result = await createCREDAppointments('patient-uuid', [futureControl], 'service-uuid', 'location-uuid', 30);

    expect(mockOpenmrsFetch).toHaveBeenCalledWith(
      '/ws/rest/v1/appointment',
      expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({ patientUuid: 'patient-uuid', serviceUuid: 'service-uuid' }),
      }),
    );
    expect(result.created).toEqual(['appointment-uuid']);
    expect(mockFetchFreshPatientVitalStatus).toHaveBeenCalledWith('patient-uuid');
  });

  it('fresh-checks each write and does not create an appointment for a deceased patient', async () => {
    const futureControl = { ...generateCREDSchedule('2026-07-01')[10], status: 'future' as const };
    mockFetchFreshPatientVitalStatus.mockResolvedValue({
      dead: true,
      deathDate: '2026-08-12T15:41:28.000Z',
      isDeceased: true,
    });

    const result = await createCREDAppointments('patient-uuid', [futureControl], 'service-uuid', 'location-uuid', 30);

    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
    expect(result.created).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].error).toMatchObject({ code: DECEASED_PATIENT_CRED_APPOINTMENT_BLOCKED });
  });
});
