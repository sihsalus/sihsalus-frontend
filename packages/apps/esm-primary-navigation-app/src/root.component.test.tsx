import {
  type AssignedExtension,
  type Session,
  useAssignedExtensions,
  useConfig,
  useLeftNavStore,
  useSession,
} from '@openmrs/esm-framework';
import { render, screen, waitFor } from '@testing-library/react';
import { of } from 'rxjs';

import { mockSession } from '../test-utils/mocks/mock-session';
import { mockUser } from '../test-utils/mocks/mock-user';

import Root from './root.component';
import { isDesktop } from './utils';

const mockUserObservable = of(mockUser);
const mockSessionObservable = of({ data: mockSession });

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  useConfig: vi.fn(),
  useAssignedExtensions: vi.fn(),
  useSession: vi.fn(),
  useLeftNavStore: vi.fn(),
  interpolateUrl: vi.fn(),
}));

vi.mock('./root.resource', async () => ({
  getSynchronizedCurrentUser: vi.fn(() => mockUserObservable),
  getCurrentSession: vi.fn(() => mockSessionObservable),
}));

vi.mock('./utils', async () => ({
  isDesktop: vi.fn(() => true),
}));

vi.mock('react-router-dom', async () => ({
  BrowserRouter: ({ children }: any) => <>{children}</>,
  Route: ({ children, element, path }: any) => {
    if (path === 'login/*' || path === 'logout/*') {
      return null;
    }
    return element ?? children;
  },
  Routes: ({ children }: any) => <>{children}</>,
}));

vi.mock('./components/navbar/navbar.component', async () => ({
  __esModule: true,
  default: () => <div data-testid="navbar">Mock EMR</div>,
}));

const mockUseConfig = vi.mocked(useConfig);
const mockUseAssignedExtensions = vi.mocked(useAssignedExtensions);
const mockUseSession = vi.mocked(useSession);
const mockUseLeftNavStore = vi.mocked(useLeftNavStore);
const mockIsDesktop = vi.mocked(isDesktop);

mockUseConfig.mockReturnValue({
  logo: { src: null, alt: null, name: 'Mock EMR', link: 'Mock EMR' },
});
mockUseAssignedExtensions.mockReturnValue(['mock-extension'] as unknown as AssignedExtension[]);
mockUseSession.mockReturnValue(mockSession as unknown as Session);
mockUseLeftNavStore.mockReturnValue({ slotName: '', basePath: '', mode: 'normal' });

describe('Root', () => {
  it('should display navbar with title', async () => {
    render(<Root />);
    expect(screen.getByTestId('navbar')).toBeInTheDocument();
  });

  describe('when view is desktop', () => {
    beforeEach(() => {
      mockIsDesktop.mockImplementation(() => true);
    });

    it('does not render side menu button if desktop', async () => {
      await waitFor(() => expect(screen.queryAllByLabelText('Open menu')).toHaveLength(0));
    });
  });
});
