import { mockQueueEntries } from 'test-utils';

import { type Concept } from '../types';

import { buildQueueBoardColumns } from './visual-queue.component';

describe('visual queue board', () => {
  it('groups entries by status and orders each lane by queue weight', () => {
    const entries = [
      { ...mockQueueEntries[0], sortWeight: 20 },
      { ...mockQueueEntries[1], sortWeight: 5, status: mockQueueEntries[0].status },
    ];
    const statuses = [mockQueueEntries[0].status, mockQueueEntries[1].status] as Array<Concept>;

    const columns = buildQueueBoardColumns(entries, statuses);

    expect(columns).toHaveLength(2);
    expect(columns[0].entries.map(({ uuid }) => uuid)).toEqual([mockQueueEntries[1].uuid, mockQueueEntries[0].uuid]);
    expect(columns[1].entries).toHaveLength(0);
  });

  it('returns only the selected status lane', () => {
    const selectedStatus = mockQueueEntries[0].status;

    const columns = buildQueueBoardColumns(mockQueueEntries, [selectedStatus], selectedStatus.uuid);

    expect(columns).toHaveLength(1);
    expect(columns[0].status.uuid).toBe(selectedStatus.uuid);
    expect(columns[0].entries.every(({ status }) => status.uuid === selectedStatus.uuid)).toBe(true);
  });
});
