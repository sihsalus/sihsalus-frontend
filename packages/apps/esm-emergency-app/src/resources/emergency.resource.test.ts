import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { createEmergencyQueueEntry } from './emergency.resource';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const mockFetchResponse = { data: { uuid: 'queue-entry-uuid' } } as Awaited<ReturnType<typeof openmrsFetch>>;

describe('createEmergencyQueueEntry', () => {
  beforeEach(() => {
    mockOpenmrsFetch.mockReset();
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
});
