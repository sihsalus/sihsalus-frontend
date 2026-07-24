import { navigate, showModal } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { mockQueueEntries as mockQueueEntryData } from 'test-utils';
import { useQueueEntries } from '../hooks/useQueueEntries';
import { serviceQueuesBasePath } from '../constants';
import { useServiceQueuesStore } from '../store/store';
import type { QueueEntry } from '../types';
import MetricsHeader from './metrics-header.component';

const mockShowModal = vi.mocked(showModal);
const mockNavigate = vi.mocked(navigate);
const mockUseQueueEntries = vi.mocked(useQueueEntries);
const mockUseServiceQueuesStore = vi.mocked(useServiceQueuesStore);

vi.mock('../hooks/useQueueEntries', () => ({
  useQueueEntries: vi.fn(),
}));

vi.mock('../permissions', () => ({
  CanEditServiceQueues: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('../store/store', () => ({
  useServiceQueuesStore: vi.fn(),
}));

describe('MetricsHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseServiceQueuesStore.mockReturnValue({
      selectedServiceUuid: 'service-uuid',
      selectedQueueLocationUuid: 'location-uuid',
      selectedQueueStatusUuid: null,
      selectedAppointmentStatus: '',
      selectedQueueRoomTimestamp: new Date(),
      isPermanentProviderQueueRoom: false,
    });
  });

  it('keeps the clear queue action visible but disabled when the queue is empty', async () => {
    const user = userEvent.setup();
    mockQueueEntriesResult([]);

    render(<MetricsHeader />);

    expect(mockUseQueueEntries).toHaveBeenCalledWith({
      service: 'service-uuid',
      location: 'location-uuid',
      isEnded: false,
    });

    const clearQueueButton = screen.getByRole('button', { name: /clear queue entries/i });
    expect(clearQueueButton).toBeDisabled();

    await user.click(clearQueueButton);

    expect(mockShowModal).not.toHaveBeenCalled();
  });

  it('enables the clear queue action and opens its confirmation when patients are present', async () => {
    const user = userEvent.setup();
    mockQueueEntriesResult(mockQueueEntryData);

    render(<MetricsHeader />);

    const clearQueueButton = screen.getByRole('button', { name: /clear queue entries/i });
    expect(clearQueueButton).toBeEnabled();
    expect(clearQueueButton).toHaveClass('cds--btn--danger--ghost');
    expect(clearQueueButton.querySelector('svg')).toBeInTheDocument();

    await user.click(clearQueueButton);

    expect(mockShowModal).toHaveBeenCalledWith(
      'clear-all-queue-entries-modal',
      expect.objectContaining({ queueEntries: mockQueueEntryData, closeModal: expect.any(Function) }),
    );
  });

  it('opens the visual queue from the metrics header', async () => {
    const user = userEvent.setup();
    mockQueueEntriesResult(mockQueueEntryData);

    render(<MetricsHeader />);

    await user.click(screen.getByRole('button', { name: /visual queue/i }));

    expect(mockNavigate).toHaveBeenCalledWith({ to: `${serviceQueuesBasePath}/visual` });
  });
});

function mockQueueEntriesResult(queueEntries: Array<QueueEntry>) {
  mockUseQueueEntries.mockReturnValue({
    queueEntries,
    isLoading: false,
    error: undefined,
    totalCount: queueEntries.length,
    isValidating: false,
    mutate: vi.fn(),
  });
}
