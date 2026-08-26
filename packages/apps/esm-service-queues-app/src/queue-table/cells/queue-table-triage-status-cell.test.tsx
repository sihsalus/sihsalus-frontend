import { render, screen } from '@testing-library/react';
import { mockQueueEntryAlice } from 'test-utils';

import { QueueTableTriageStatusCell } from './queue-table-triage-status-cell.component';

describe('QueueTableTriageStatusCell', () => {
  it('does not label triage as not applicable while its contract is loading', () => {
    const loadingEntry = {
      ...mockQueueEntryAlice,
      workflow: {
        isTriageQueue: false,
        sisState: 'notConsulted' as const,
        isSisStateResolved: false,
        triageState: 'loading' as const,
      },
    };

    render(<QueueTableTriageStatusCell queueEntry={loadingEntry} />);

    expect(screen.getByText('Verificando')).toBeInTheDocument();
    expect(screen.queryByText('No aplica')).not.toBeInTheDocument();
  });
});
