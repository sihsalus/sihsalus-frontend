import { render, screen } from '@testing-library/react';

import QueueScreen from './queue-screen.component';
import { useActiveTickets } from './useActiveTickets';

const mockUseActiveTickets = vi.mocked(useActiveTickets);

vi.mock('./useActiveTickets', () => ({
  useActiveTickets: vi.fn(),
}));

vi.mock('../helpers/helpers', () => ({
  useSelectedQueueLocationName: vi.fn().mockReturnValue('Room A'),
  useSelectedQueueLocationUuid: vi.fn().mockReturnValue(''),
}));

describe('QueueScreen component', () => {
  test('renders loading skeleton when data is loading', () => {
    mockUseActiveTickets.mockReturnValue({ isLoading: true, activeTickets: [], error: undefined, mutate: vi.fn() });

    render(<QueueScreen />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  test('renders error message when there is an error fetching data', () => {
    mockUseActiveTickets.mockReturnValue({
      error: new Error('Error'),
      isLoading: false,
      activeTickets: [],
      mutate: vi.fn(),
    });

    render(<QueueScreen />);

    expect(screen.getByText('Error')).toBeInTheDocument();
  });

  test('renders table with active tickets when data is loaded', () => {
    mockUseActiveTickets.mockReturnValue({
      activeTickets: [
        {
          room: 'Room A',
          ticketNumber: '123',
          status: 'Pending',
        },
      ],
      isLoading: false,
      error: undefined,
      mutate: vi.fn(),
    });

    render(<QueueScreen />);

    expect(screen.getByText('Room : Room A')).toBeInTheDocument();
    expect(screen.getByText('Ticket number')).toBeInTheDocument();
    expect(screen.getByText('123')).toBeInTheDocument();
  });
});
