import { updateVisit } from '@openmrs/esm-framework';

import { endQueueEntry as endQueueEntrySafely } from '../modals/queue-entry-actions.resource';
import { endQueueEntry } from './remove-queue-entry.resource';

const mockEndQueueEntrySafely = vi.mocked(endQueueEntrySafely);
const mockUpdateVisit = vi.mocked(updateVisit);

vi.mock('../modals/queue-entry-actions.resource', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../modals/queue-entry-actions.resource')>()),
  endQueueEntry: vi.fn(),
}));

describe('endQueueEntry with visit close', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEndQueueEntrySafely.mockResolvedValue({
      data: { endedAt: '2026-07-14T13:20:00.000Z' },
      status: 200,
    } as Awaited<ReturnType<typeof endQueueEntrySafely>>);
    mockUpdateVisit.mockResolvedValue({ status: 200 } as Awaited<ReturnType<typeof updateVisit>>);
  });

  it('uses the queue server end time as the visit stop time', async () => {
    const visitPayload = {
      location: 'location-uuid',
      startDatetime: new Date('2026-07-14T13:00:00.000Z'),
      visitType: 'visit-type-uuid',
    };

    await endQueueEntry('queue-entry-uuid', visitPayload, 'visit-uuid', null);

    expect(mockEndQueueEntrySafely).toHaveBeenCalledWith('queue-entry-uuid', expect.any(AbortController));
    expect(mockUpdateVisit).toHaveBeenCalledWith(
      'visit-uuid',
      { ...visitPayload, stopDatetime: new Date('2026-07-14T13:20:00.000Z') },
      expect.any(AbortController),
    );
  });

  it('ends only the queue entry when there is no active visit', async () => {
    await endQueueEntry('queue-entry-uuid', null, 'visit-uuid', null);

    expect(mockEndQueueEntrySafely).toHaveBeenCalledOnce();
    expect(mockUpdateVisit).not.toHaveBeenCalled();
  });

  it('propagates a visit-close failure so the operation can be retried', async () => {
    mockUpdateVisit.mockRejectedValueOnce(new Error('visit close failed'));

    await expect(
      endQueueEntry(
        'queue-entry-uuid',
        {
          location: 'location-uuid',
          startDatetime: new Date('2026-07-14T13:00:00.000Z'),
          visitType: 'visit-type-uuid',
        },
        'visit-uuid',
        null,
      ),
    ).rejects.toThrow('visit close failed');
  });
});
