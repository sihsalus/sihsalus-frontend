import { launchWorkspace2, showModal, useLayoutType } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockQueueRooms, mockQueues } from 'test-utils';

import QueueActionMenu from './queue-action-menu.component';
import QueueRoomActionMenu from './queue-room-action-menu.component';

const mockLaunchWorkspace = vi.mocked(launchWorkspace2);
const mockShowModal = vi.mocked(showModal);
const mockUseLayoutType = vi.mocked(useLayoutType);

describe('service queue administration action menus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLayoutType.mockReturnValue('small-desktop');
  });

  it('labels queue actions without Carbon default English text and opens editing', async () => {
    const user = userEvent.setup();
    const queue = mockQueues[0];

    render(<QueueActionMenu queue={queue} />);

    const actionsButton = screen.getByRole('button', { name: 'Actions' });
    expect(screen.queryByRole('button', { name: 'Options' })).not.toBeInTheDocument();

    await user.click(actionsButton);
    await user.click(screen.getByText('Edit'));

    expect(mockLaunchWorkspace).toHaveBeenCalledWith('service-queues-service-form', { queue });
  });

  it('labels queue room actions without Carbon default English text and opens deletion', async () => {
    const user = userEvent.setup();
    const queueRoom = mockQueueRooms.data.results[0];

    render(<QueueRoomActionMenu queueRoom={queueRoom} />);

    const actionsButton = screen.getByRole('button', { name: 'Actions' });
    expect(screen.queryByRole('button', { name: 'Options' })).not.toBeInTheDocument();

    await user.click(actionsButton);
    await user.click(screen.getByText('Delete'));

    expect(mockShowModal).toHaveBeenCalledWith(
      'delete-queue-room-modal',
      expect.objectContaining({ queueRoom, closeModal: expect.any(Function) }),
    );
  });
});
