import { useAssignedExtensions, useSession } from '@openmrs/esm-framework';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockSession } from 'test-utils/mocks/session.mock';
import HelpMenu from './help.component';

const mockUseAssignedExtensions = vi.mocked(useAssignedExtensions);
const mockUseSession = vi.mocked(useSession);
const helpMenuItems = [{ id: 'docs', name: 'docs', moduleName: '@sihsalus/esm-help-menu-app', meta: {}, config: null }];

beforeEach(() => {
  mockUseSession.mockReturnValue(mockSession.data);
  mockUseAssignedExtensions.mockReturnValue(helpMenuItems);
});

it.each(['mouseDown', 'touchStart'] as const)('closes help on %s outside the menu only', async (eventName) => {
  const user = userEvent.setup();
  render(<HelpMenu />);

  const button = screen.getByRole('button', { name: 'Help menu' });
  await user.click(button);
  const menu = screen.getByRole('menu', { name: 'Help menu' });

  fireEvent[eventName](menu);
  expect(menu).toBeInTheDocument();
  fireEvent[eventName](button);
  expect(menu).toBeInTheDocument();

  fireEvent[eventName](window);
  expect(menu).toBeInTheDocument();

  fireEvent[eventName](document.body);
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
});

it.each([
  'authentication',
  'user',
  'extensions',
] as const)('closes help when %s disappears and keeps it closed on recovery', async (missing) => {
  const user = userEvent.setup();
  const { rerender } = render(<HelpMenu />);
  await user.click(screen.getByRole('button', { name: 'Help menu' }));
  expect(screen.getByRole('menu')).toBeInTheDocument();

  if (missing === 'extensions') {
    mockUseAssignedExtensions.mockReturnValue([]);
  } else {
    mockUseSession.mockReturnValue({
      ...mockSession.data,
      authenticated: missing !== 'authentication',
      user: missing === 'user' ? undefined : mockSession.data.user,
    });
  }
  rerender(<HelpMenu />);
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Help menu' })).not.toBeInTheDocument();

  mockUseSession.mockReturnValue(mockSession.data);
  mockUseAssignedExtensions.mockReturnValue(helpMenuItems);
  rerender(<HelpMenu />);
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Help menu' }));
  expect(screen.getByRole('menu')).toBeInTheDocument();
});
