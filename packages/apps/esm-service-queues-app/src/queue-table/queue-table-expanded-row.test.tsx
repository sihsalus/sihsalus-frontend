import { render, screen } from '@testing-library/react';
import { mockQueueEntryAlice } from 'test-utils';

import QueueTableExpandedRow from './queue-table-expanded-row.component';

vi.mock('../current-visit/current-visit-summary.component', () => ({
  default: ({ visitUuid }: { visitUuid: string }) => <div>Current visit {visitUuid}</div>,
}));

vi.mock('../past-visit/past-visit.component', () => ({
  default: () => <div>Past visits</div>,
}));

describe('QueueTableExpandedRow', () => {
  it('keeps the history available and shows a safe message when the entry has no visit', () => {
    render(<QueueTableExpandedRow queueEntry={{ ...mockQueueEntryAlice, visit: null }} />);

    expect(screen.getByText('No visit is associated with this queue entry.')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Previous visit' })).toBeInTheDocument();
    expect(screen.queryByText(/Current visit c90386ff/)).not.toBeInTheDocument();
  });
});
