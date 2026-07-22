import { type Session, useAssignedExtensions, useOnClickOutside, useSession } from '@openmrs/esm-framework';
import { render, screen, within } from '@testing-library/react';

import UserMenuButton from './user-menu-button.component';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  useAssignedExtensions: vi.fn(),
  useOnClickOutside: vi.fn(),
  useSession: vi.fn(),
}));

const mockUseAssignedExtensions = vi.mocked(useAssignedExtensions);
const mockUseOnClickOutside = vi.mocked(useOnClickOutside);
const mockUseSession = vi.mocked(useSession);
const longUserName = 'Johan Carlo Amador Egúsquiza';

const defaultProps = {
  hidePanel: vi.fn(() => vi.fn()),
  isActivePanel: vi.fn(() => false),
  togglePanel: vi.fn(),
};

describe('UserMenuButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAssignedExtensions.mockReturnValue([{ id: 'user-menu-item' }] as never);
    mockUseOnClickOutside.mockReturnValue({ current: null });
    mockUseSession.mockReturnValue({
      user: { person: { display: longUserName } },
    } as Session);
  });

  it('constrains a long name visually while preserving its complete value', () => {
    render(<UserMenuButton {...defaultProps} />);

    const userButton = screen.getByRole('button', { name: `Mi cuenta: ${longUserName}` });
    const userName = within(userButton).getByTitle(longUserName);

    expect(userName).toHaveTextContent(longUserName);
  });
});
