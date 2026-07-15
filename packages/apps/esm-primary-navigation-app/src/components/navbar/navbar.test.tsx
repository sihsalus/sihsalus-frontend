import { type Session, useSession } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';

import Navbar from './navbar.component';

const mockUseSession = vi.mocked(useSession);
const navigateSpy = vi.hoisted(() => vi.fn());

vi.mock('@carbon/react', async () => ({
  ...(await vi.importActual('@carbon/react')),
  HeaderContainer: () => <div data-testid="header-container" />,
}));

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  useAssignedExtensions: vi.fn(() => []),
  useConfig: vi.fn(() => ({})),
  useLayoutType: vi.fn(() => 'tablet'),
  useLeftNavStore: vi.fn(() => ({ slotName: '', mode: 'normal' })),
  useSession: vi.fn(),
}));

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  Navigate: (props) => {
    navigateSpy(props);
    return <div data-testid="navigate">{props.to}</div>;
  },
}));

describe('Navbar session location guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.getOpenmrsSpaBase = () => '/openmrs/spa/';
  });

  it('requires an admission user to choose a location before rendering the clinical navigation', () => {
    mockUseSession.mockReturnValue({
      authenticated: true,
      sessionId: 'session-id',
      sessionLocation: null,
      user: {
        uuid: 'user-uuid',
        person: { uuid: 'person-uuid' },
        roles: [{ display: 'Admisión' }],
      },
    } as unknown as Session);

    render(<Navbar />);

    expect(screen.getByTestId('navigate')).toHaveTextContent('/login/location');
    expect(navigateSpy).toHaveBeenCalledWith(expect.objectContaining({ to: '/login/location' }));
    expect(screen.queryByTestId('header-container')).not.toBeInTheDocument();
  });

  it('renders the clinical navigation only when the session has a location', () => {
    mockUseSession.mockReturnValue({
      authenticated: true,
      sessionId: 'session-id',
      sessionLocation: { uuid: 'location-uuid', display: 'Consulta externa' },
      user: { uuid: 'user-uuid', person: { uuid: 'person-uuid' }, roles: [{ display: 'Admisión' }] },
    } as unknown as Session);

    render(<Navbar />);

    expect(screen.getByTestId('header-container')).toBeInTheDocument();
    expect(screen.queryByTestId('navigate')).not.toBeInTheDocument();
  });
});
