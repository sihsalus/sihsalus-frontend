import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { assertFreshPatientIsAlive } from '@openmrs/esm-patient-common-lib';

import { serveQueueEntry } from './queue-screen.resource';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  openmrsFetch: vi.fn(),
}));

vi.mock('@openmrs/esm-patient-common-lib', async () => ({
  ...(await vi.importActual('@openmrs/esm-patient-common-lib')),
  assertFreshPatientIsAlive: vi.fn(),
}));

const mockAssertFreshPatientIsAlive = vi.mocked(assertFreshPatientIsAlive);
const mockOpenmrsFetch = vi.mocked(openmrsFetch);

describe('serveQueueEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertFreshPatientIsAlive.mockResolvedValue(undefined);
  });

  it('fresh-checks the patient immediately before posting the ticket state', async () => {
    mockOpenmrsFetch.mockResolvedValue({ status: 200 } as Awaited<ReturnType<typeof openmrsFetch>>);

    await serveQueueEntry('patient-uuid', 'Triage', '42', 'serving');

    expect(mockAssertFreshPatientIsAlive).toHaveBeenCalledWith('patient-uuid');
    expect(mockAssertFreshPatientIsAlive.mock.invocationCallOrder[0]).toBeLessThan(
      mockOpenmrsFetch.mock.invocationCallOrder[0],
    );
    expect(mockOpenmrsFetch).toHaveBeenCalledWith(
      `${restBaseUrl}/queueutil/assignticket`,
      expect.objectContaining({
        method: 'POST',
        body: { servicePointName: 'Triage', status: 'serving', ticketNumber: '42' },
      }),
    );
  });

  it('does not post when the authoritative patient guard rejects', async () => {
    mockAssertFreshPatientIsAlive.mockRejectedValue(new Error('deceased patient'));

    await expect(serveQueueEntry('patient-uuid', 'Triage', '42', 'calling')).rejects.toThrow(
      'deceased patient',
    );

    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
  });
});
