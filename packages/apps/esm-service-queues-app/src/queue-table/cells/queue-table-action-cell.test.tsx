import { showModal, useLayoutType, useSession, userHasAccess } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockQueueEntryAlice, mockSession } from 'test-utils';

import { serviceQueuesEditPrivilege } from '../../constants';

import { QueueTableActionCell } from './queue-table-action-cell.component';

const mockShowModal = vi.mocked(showModal);
const mockUseLayoutType = vi.mocked(useLayoutType);
const mockUseSession = vi.mocked(useSession);
const mockUserHasAccess = vi.mocked(userHasAccess);

describe('QueueTableActionCell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLayoutType.mockReturnValue('small-desktop');
    mockUseSession.mockReturnValue(mockSession.data);
    mockUserHasAccess.mockReturnValue(true);
  });

  it('labels the overflow menu as actions instead of Carbon default options', async () => {
    const user = userEvent.setup();

    render(<QueueTableActionCell queueEntry={mockQueueEntryAlice} />);

    const actionsButton = screen.getByRole('button', { name: 'Actions' });
    expect(actionsButton).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Options' })).not.toBeInTheDocument();

    await user.click(actionsButton);
    await user.click(screen.getByText('Edit'));

    expect(mockShowModal).toHaveBeenCalledWith(
      'edit-queue-entry-modal',
      expect.objectContaining({ queueEntry: mockQueueEntryAlice, closeModal: expect.any(Function) }),
    );
    expect(mockUserHasAccess).toHaveBeenCalledWith(serviceQueuesEditPrivilege, mockSession.data.user);
  });

  it('does not expose queue actions without the edit privilege', () => {
    mockUserHasAccess.mockReturnValue(false);

    render(<QueueTableActionCell queueEntry={mockQueueEntryAlice} />);

    expect(screen.queryByRole('button', { name: 'Actions' })).not.toBeInTheDocument();
  });
});
