import { render, screen } from '@testing-library/react';

import { useQueueEntriesMetrics } from '../hooks/useQueueEntries';
import PatientsInQueueTile from './patients-in-queue-tile.component';

vi.mock('../hooks/useQueueEntries', async () => ({
  ...(await vi.importActual('../hooks/useQueueEntries')),
  useQueueEntriesMetrics: vi.fn(),
}));

const mockUseQueueEntriesMetrics = vi.mocked(useQueueEntriesMetrics);

describe('PatientsInQueueTile', () => {
  it('shows the number of active queue entries', () => {
    mockUseQueueEntriesMetrics.mockReturnValue({
      count: 7,
      averageWaitTime: undefined,
      error: undefined,
      isLoading: false,
    });

    render(<PatientsInQueueTile />);

    expect(mockUseQueueEntriesMetrics).toHaveBeenCalledWith({ isEnded: false });
    expect(screen.getByText('Pacientes en cola')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('does not present a false zero while loading or after an error', () => {
    mockUseQueueEntriesMetrics.mockReturnValue({
      count: 0,
      averageWaitTime: undefined,
      error: new Error('request failed'),
      isLoading: false,
    });

    render(<PatientsInQueueTile />);

    expect(screen.getByText('--')).toBeInTheDocument();
  });
});
