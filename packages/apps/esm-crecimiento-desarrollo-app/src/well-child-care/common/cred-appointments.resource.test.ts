import { openmrsFetch } from '@openmrs/esm-framework';

import { generateCREDSchedule } from '../../utils/cred-schedule-rules';

import { createCREDAppointments } from './cred-appointments.resource';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  openmrsFetch: vi.fn(),
  restBaseUrl: '/ws/rest/v1',
}));

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

describe('createCREDAppointments', () => {
  beforeEach(() => {
    vi.useFakeTimers().setSystemTime(new Date('2026-07-10T12:00:00-05:00'));
    mockOpenmrsFetch.mockReset();
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
  });
});
