import { render, screen } from '@testing-library/react';

import NotificationsMenuPanel from './notifications-menu-panel.component';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  __esModule: true,
  ExtensionSlot: vi.fn(({ children }) => <>{children}</>),
}));

test('renders the notifications menu panel scaffold', () => {
  render(<NotificationsMenuPanel expanded />);

  expect(screen.getByRole('heading', { name: /notifications/i })).toBeInTheDocument();
});
