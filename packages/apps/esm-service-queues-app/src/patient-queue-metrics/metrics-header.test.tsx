import { launchWorkspace, launchWorkspace2, UserHasAccess } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { canManageServiceQueueRoomCatalog } from '../permissions';
import MetricsHeader from './metrics-header.component';

vi.mock('../permissions', () => ({
  canManageServiceQueueRoomCatalog: vi.fn(),
  canManageServiceQueueCatalog: vi.fn(() => false),
  canAssignProviderToQueueRoom: vi.fn(() => false),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(canManageServiceQueueRoomCatalog).mockReturnValue(true);
  vi.mocked(UserHasAccess).mockImplementation(({ children }: { children?: ReactNode }) => children);
});

test('the queue shortcut opens the same room form as Administration', async () => {
  const user = userEvent.setup();
  render(<MetricsHeader />);
  await user.click(screen.getByRole('button', { name: /additional actions/i }));
  await user.click(screen.getByText('Add new service room'));
  expect(launchWorkspace2).toHaveBeenCalledExactlyOnceWith('service-queues-room-workspace');
  expect(launchWorkspace).not.toHaveBeenCalled();
});

test('the shortcut cannot launch a form without room management permissions', async () => {
  const user = userEvent.setup();
  vi.mocked(canManageServiceQueueRoomCatalog).mockReturnValue(false);
  render(<MetricsHeader />);
  await user.click(screen.getByRole('button', { name: /additional actions/i }));
  expect(screen.queryByText('Add new service room')).not.toBeInTheDocument();
  expect(launchWorkspace2).not.toHaveBeenCalled();
});
