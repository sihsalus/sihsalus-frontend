import {
  type Session,
  useAssignedExtensions,
  useConfig,
  useLayoutType,
  useLeftNavStore,
  useSession,
} from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';

import Navbar from './navbar.component';

vi.mock('@carbon/react', () => ({
  Header: ({ children }: { children: React.ReactNode }) => <header>{children}</header>,
  HeaderContainer: ({ render: Component }: { render: React.ComponentType }) => <Component />,
  HeaderGlobalBar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  HeaderMenuButton: () => null,
}));

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  ConfigurableLink: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ExtensionSlot: ({ name }: { name: string }) => <div data-testid={`slot-${name}`} />,
  useAssignedExtensions: vi.fn(),
  useConfig: vi.fn(),
  useLayoutType: vi.fn(),
  useLeftNavStore: vi.fn(),
  useSession: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  Navigate: ({ to }: { to: string }) => <div data-testid="navigate">{to}</div>,
}));

vi.mock('../logo/logo.component', () => ({
  default: () => <div>SIH SALUS</div>,
}));
vi.mock('../navbar-header-panels/notifications-menu-panel.component', () => ({
  default: () => null,
}));
vi.mock('../navbar-header-panels/side-menu-panel.component', () => ({
  default: () => null,
}));

const mockUseAssignedExtensions = vi.mocked(useAssignedExtensions);
const mockUseConfig = vi.mocked(useConfig);
const mockUseLayoutType = vi.mocked(useLayoutType);
const mockUseLeftNavStore = vi.mocked(useLeftNavStore);
const mockUseSession = vi.mocked(useSession);

describe('Navbar', () => {
  beforeEach(() => {
    mockUseAssignedExtensions.mockReturnValue([]);
    mockUseConfig.mockReturnValue({ logo: { link: '/home' } });
    mockUseLayoutType.mockReturnValue('large-desktop');
    mockUseLeftNavStore.mockReturnValue({
      slotName: 'home-sidebar-slot',
      mode: 'normal',
      basePath: '/home',
    });
  });

  it('renders for an authenticated role whose person is redacted by RBAC', () => {
    mockUseSession.mockReturnValue({
      authenticated: true,
      sessionId: 'session-id',
      sessionLocation: { uuid: 'location-uuid' },
      user: {
        uuid: 'user-uuid',
        display: 'Laboratory User',
        username: 'laboratory',
        person: undefined,
      },
    } as unknown as Session);

    render(<Navbar />);

    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.queryByTestId('navigate')).not.toBeInTheDocument();
  });

  it('sends an authenticated user without a session location to the location picker', () => {
    mockUseSession.mockReturnValue({
      authenticated: true,
      sessionId: 'session-id',
      sessionLocation: null,
      user: {
        uuid: 'user-uuid',
        display: 'Laboratory User',
        person: undefined,
      },
    } as unknown as Session);

    render(<Navbar />);

    expect(screen.getByTestId('navigate')).toHaveTextContent('/login/location');
  });

  it('sends an unauthenticated session to login', () => {
    mockUseSession.mockReturnValue({
      authenticated: false,
      sessionId: '',
    } as Session);

    render(<Navbar />);

    expect(screen.getByTestId('navigate')).toHaveTextContent('/login');
  });
});
