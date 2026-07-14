import { showSnackbar } from '@openmrs/esm-framework';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ClearQueueEntriesModal from './clear-queue-entries.modal';
import { batchClearQueueEntries } from './clear-queue-entries.resource';

const mockBatchClearQueueEntries = vi.mocked(batchClearQueueEntries);
const mockCloseModal = vi.fn();
const mockMutateQueueEntries = vi.fn();
const mockShowSnackbar = vi.mocked(showSnackbar);

const defaultProps = {
  queueEntries: [],
  closeModal: mockCloseModal,
};

vi.mock('./clear-queue-entries.resource', () => ({
  batchClearQueueEntries: vi.fn(),
}));

vi.mock('../hooks/useQueueEntries', () => ({
  useMutateQueueEntries: () => ({ mutateQueueEntries: mockMutateQueueEntries }),
}));

describe('ClearQueueEntriesModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMutateQueueEntries.mockResolvedValue(undefined);
  });

  it('renders the component with warning message', () => {
    renderClearQueueEntriesModal();

    expect(screen.getByRole('heading', { name: 'Service queue' })).toBeInTheDocument();
    expect(screen.getByText('Clear all queue entries?')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Clear queue')).toBeInTheDocument();
  });

  it('should close modal when the cancel button is clicked', async () => {
    const user = userEvent.setup();

    renderClearQueueEntriesModal();

    await user.click(screen.getByText('Cancel'));
    expect(mockCloseModal).toHaveBeenCalledTimes(1);
  });

  it('refreshes the queue and reports a partial batch result', async () => {
    const user = userEvent.setup();
    mockBatchClearQueueEntries.mockResolvedValue({ total: 3, cleared: 1, alreadyEnded: 1, failed: 1 });
    renderClearQueueEntriesModal({
      queueEntries: [{ uuid: 'entry-a' }, { uuid: 'entry-b' }, { uuid: 'entry-c' }],
    });

    await user.click(screen.getByRole('button', { name: /Clear queue/ }));

    await waitFor(() => expect(mockCloseModal).toHaveBeenCalledOnce());
    expect(mockMutateQueueEntries).toHaveBeenCalledOnce();
    expect(mockShowSnackbar).toHaveBeenCalledWith({
      isLowContrast: true,
      title: 'Queue partially cleared',
      kind: 'warning',
      subtitle: '2 of 3 entries were cleared or were already inactive. 1 could not be processed.',
    });
  });
});

function renderClearQueueEntriesModal(props = {}) {
  render(<ClearQueueEntriesModal {...defaultProps} {...props} />);
}
