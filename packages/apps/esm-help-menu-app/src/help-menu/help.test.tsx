import { showModal, useAssignedExtensions, useSession } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockSession } from 'test-utils/mocks/session.mock';
import HelpMenu from './help.component';
import HelpMenuPopup from './help-popup.component';
import routes from '../routes.json';

const mockUseAssignedExtensions = vi.mocked(useAssignedExtensions);
const mockUseSession = vi.mocked(useSession);
const helpMenuItems = [{ id: 'docs', name: 'docs', moduleName: '@sihsalus/esm-help-menu-app', meta: {}, config: null }];

beforeEach(() => {
  mockUseSession.mockReturnValue(mockSession.data);
  mockUseAssignedExtensions.mockReturnValue(helpMenuItems);
});

it('registers help in the native user menu and opens the native modal by keyboard', async () => {
  expect(routes).not.toHaveProperty('pages');
  expect(routes.extensions).toContainEqual(expect.objectContaining({ slot: 'user-panel-slot', component: 'root' }));
  expect(routes.modals).toContainEqual({ name: 'help-menu-modal', component: 'helpMenuModal' });
  const user = userEvent.setup();
  render(<HelpMenu />);
  const button = screen.getByRole('button', { name: 'Help menu' });
  await user.tab();
  expect(button).toHaveFocus();
  await user.keyboard('{Enter}');
  expect(showModal).toHaveBeenLastCalledWith('help-menu-modal', { size: 'sm' }, expect.any(Function));
  button.blur();
  vi.mocked(showModal).mock.calls.at(-1)?.[2]?.();
  expect(button).toHaveFocus();
});

it('focuses the native modal close action and closes it normally', async () => {
  const close = vi.fn();
  render(<HelpMenuPopup close={close} />);
  const button = screen.getAllByRole('button', { name: /^Close$/ }).at(-1);
  expect(button).toBeDefined();
  expect(button).toHaveFocus();
  await userEvent.setup().keyboard('{Enter}');
  expect(close).toHaveBeenCalledOnce();
});

it.each(['authentication', 'user', 'extensions'] as const)(
  'hides help and closes the modal when %s disappears',
  (missing) => {
    const close = vi.fn();
    const { rerender } = render(
      <>
        <HelpMenu />
        <HelpMenuPopup close={close} />
      </>,
    );
    if (missing === 'extensions') {
      mockUseAssignedExtensions.mockReturnValue([]);
    } else {
      mockUseSession.mockReturnValue({
        ...mockSession.data,
        authenticated: missing !== 'authentication',
        user: missing === 'user' ? undefined : mockSession.data.user,
      });
    }
    rerender(
      <>
        <HelpMenu />
        <HelpMenuPopup close={close} />
      </>,
    );
    expect(close).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'Help menu' })).not.toBeInTheDocument();
    expect(screen.queryByText('Help menu')).not.toBeInTheDocument();
  },
);
