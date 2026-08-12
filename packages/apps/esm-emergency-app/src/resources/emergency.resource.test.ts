import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import {
  assertFreshPatientIsAlive,
  DECEASED_PATIENT_OPERATION_BLOCKED,
  PATIENT_VITAL_STATUS_UNAVAILABLE,
} from '@openmrs/esm-patient-common-lib';
import { createEmergencyQueueEntry } from './emergency.resource';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const mockAssertFreshPatientIsAlive = vi.mocked(assertFreshPatientIsAlive);
const mockFetchResponse = { data: { uuid: 'queue-entry-uuid' } } as Awaited<ReturnType<typeof openmrsFetch>>;

vi.mock('@openmrs/esm-patient-common-lib', async () => ({
  ...(await vi.importActual('@openmrs/esm-patient-common-lib')),
  assertFreshPatientIsAlive: vi.fn(),
}));

describe('createEmergencyQueueEntry', () => {
  beforeEach(() => {
    mockOpenmrsFetch.mockReset();
    mockAssertFreshPatientIsAlive.mockReset();
    mockAssertFreshPatientIsAlive.mockResolvedValue({ dead: false, deathDate: null, isDeceased: false });
  });

  it('preserves sortWeight 0 for direct emergency attention', async () => {
    mockOpenmrsFetch.mockResolvedValue(mockFetchResponse);

    await createEmergencyQueueEntry(
      'patient-uuid',
      'visit-uuid',
      'priority-i-uuid',
      'in-service-uuid',
      'queue-uuid',
      0,
    );

    expect(mockOpenmrsFetch).toHaveBeenCalledWith(`${restBaseUrl}/visit-queue-entry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: expect.objectContaining({
        queueEntry: expect.objectContaining({
          sortWeight: 0,
        }),
      }),
    });
    expect(mockAssertFreshPatientIsAlive).toHaveBeenCalledWith('patient-uuid');
    expect(mockAssertFreshPatientIsAlive.mock.invocationCallOrder[0]).toBeLessThan(
      mockOpenmrsFetch.mock.invocationCallOrder[0],
    );
  });

  it('defaults sortWeight only when none is provided', async () => {
    mockOpenmrsFetch.mockResolvedValue(mockFetchResponse);

    await createEmergencyQueueEntry('patient-uuid', 'visit-uuid', 'priority-uuid', 'waiting-status-uuid', 'queue-uuid');

    expect(mockOpenmrsFetch).toHaveBeenCalledWith(
      `${restBaseUrl}/visit-queue-entry`,
      expect.objectContaining({
        body: expect.objectContaining({
          queueEntry: expect.objectContaining({
            sortWeight: 4,
          }),
        }),
      }),
    );
  });

  it.each([
    ['deceased', DECEASED_PATIENT_OPERATION_BLOCKED],
    ['unavailable', PATIENT_VITAL_STATUS_UNAVAILABLE],
  ])('fails closed when patient vital status is %s', async (_state, code) => {
    mockAssertFreshPatientIsAlive.mockRejectedValueOnce(Object.assign(new Error(String(_state)), { code }));

    await expect(
      createEmergencyQueueEntry(
        'patient-uuid',
        'visit-uuid',
        'priority-uuid',
        'waiting-status-uuid',
        'queue-uuid',
      ),
    ).rejects.toMatchObject({ code });

    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
  });
});
