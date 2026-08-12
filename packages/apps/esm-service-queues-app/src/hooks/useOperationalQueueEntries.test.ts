import { type QueueEntry } from '../types';
import { getOperationalQueueLocationUuid, matchesOperationalQueueLocation } from './useOperationalQueueEntries';

function makeQueueEntry({ visitLocation, queueLocation }: { visitLocation?: string; queueLocation?: string }) {
  return {
    uuid: 'queue-entry-uuid',
    queue: {
      uuid: 'queue-uuid',
      location: queueLocation ? { uuid: queueLocation } : undefined,
    },
    visit: visitLocation ? { uuid: 'visit-uuid', location: { uuid: visitLocation } } : undefined,
  } as QueueEntry;
}

describe('operational queue location', () => {
  it('uses the visit UPSS instead of the administrative location of a shared queue', () => {
    const triageEntry = makeQueueEntry({ visitLocation: 'upss-consulta-externa', queueLocation: 'hospital' });

    expect(getOperationalQueueLocationUuid(triageEntry)).toBe('upss-consulta-externa');
    expect(matchesOperationalQueueLocation(triageEntry, 'upss-consulta-externa')).toBe(true);
    expect(matchesOperationalQueueLocation(triageEntry, 'hospital')).toBe(false);
  });

  it('uses the queue location for administrative entries without a visit', () => {
    const queueOnlyEntry = makeQueueEntry({ queueLocation: 'upss-consulta-externa' });

    expect(getOperationalQueueLocationUuid(queueOnlyEntry)).toBe('upss-consulta-externa');
    expect(matchesOperationalQueueLocation(queueOnlyEntry, 'upss-consulta-externa')).toBe(true);
  });

  it('does not mix entries from another UPSS', () => {
    const rehabilitationEntry = makeQueueEntry({ visitLocation: 'upss-rehabilitacion', queueLocation: 'hospital' });

    expect(matchesOperationalQueueLocation(rehabilitationEntry, 'upss-consulta-externa')).toBe(false);
  });

  it('keeps every location when Todo is selected', () => {
    const entryWithoutLocation = makeQueueEntry({});

    expect(matchesOperationalQueueLocation(entryWithoutLocation, null)).toBe(true);
    expect(matchesOperationalQueueLocation(entryWithoutLocation, [])).toBe(true);
  });
});
