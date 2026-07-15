import {
  getSessionStore,
  refetchCurrentUser,
  type SessionStore,
  useConfig,
  useConnectivity,
  useSession,
} from '@openmrs/esm-framework';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { mockConfig } from '../../../../test-utils/mocks/login-config.mock';
import { hardNavigate } from '../navigation';
import renderWithRouter from '../test-helpers/render-with-router';

import Login from './login.component';

const mockGetSessionStore = vi.mocked(getSessionStore);
const mockLogin = vi.mocked(refetchCurrentUser);
const mockUseConfig = vi.mocked(useConfig);
const mockUseConnectivity = vi.mocked(useConnectivity);
const mockUseSession = vi.mocked(useSession);
const mockHardNavigate = vi.mocked(hardNavigate);

vi.mock('../navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../navigation')>()),
  hardNavigate: vi.fn(),
}));

const mockBuildInfo = { version: '1.2.3', gitSha: 'abc1234', buildTime: '2026-06-04T00:00:00Z' };
const openmrsSpaBasePlaceholder = '$' + '{openmrsSpaBase}';

const LoginRoutes = () => (
  <Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/login/location" element={<div>Location select page</div>} />
  </Routes>
);

describe('Login', () => {
  beforeEach(() => {
    mockUseConnectivity.mockReturnValue(true);
    mockLogin.mockResolvedValue({} as SessionStore);
    mockGetSessionStore.mockImplementation(() => {
      return {
        getState: vi.fn().mockReturnValue({
          loaded: true,
          session: {
            authenticated: true,
          },
        }),
        setState: vi.fn(),
        getInitialState: vi.fn(),
        subscribe: vi.fn(),
        destroy: vi.fn(),
      };
    });
    mockUseSession.mockReturnValue({ authenticated: false, sessionId: '123' });
    mockUseConfig.mockReturnValue(mockConfig);

    globalThis.fetch = vi.fn((input: RequestInfo | URL) =>
      String(input).endsWith('build-info.json')
        ? Promise.resolve({ ok: true, json: () => Promise.resolve(mockBuildInfo) } as Response)
        : Promise.resolve({ ok: false, json: () => Promise.resolve(null) } as Response),
    ) as typeof fetch;
  });

  it('renders the login form', async () => {
    renderWithRouter(
      Login,
      {},
      {
        route: '/login',
      },
    );

    const [openmrsLogo] = screen.getAllByRole('img', { name: /OpenMRS logo/i });
    expect(openmrsLogo).toHaveAttribute('src', '/openmrs/spa/logos/logo-openmrs.svg');
    expect(screen.getByText(/Sihsalus/i)).toBeInTheDocument();
    expect(screen.queryByAltText(/^logo$/i)).not.toBeInTheDocument();
    // Version + short SHA are fetched asynchronously from build-info.json
    expect(await screen.findByText(/v1\.2\.3 · abc1234/)).toBeInTheDocument();
    screen.getByRole('textbox', { name: /Username/i });
    screen.getByRole('button', { name: /Continue/i });
  });

  it('renders the login artwork', () => {
    const { container } = renderWithRouter(
      Login,
      {},
      {
        route: '/login',
      },
    );

    expect(container.querySelector('picture')).toBeInTheDocument();
  });

  it('renders a configurable logo', () => {
    const customLogoConfig = {
      src: 'https://some-image-host.com/foo.png',
      alt: 'Custom logo',
    };
    mockUseConfig.mockReturnValue({
      ...mockConfig,
      logo: customLogoConfig,
    });

    renderWithRouter(Login);

    const logo = screen.getByAltText(customLogoConfig.alt);

    expect(screen.queryByText(/^Sihsalus$/i)).not.toBeInTheDocument();
    expect(logo).toHaveAttribute('src', customLogoConfig.src);
    expect(logo).toHaveAttribute('alt', customLogoConfig.alt);
  });

  it('should return user focus to username input when input is invalid', async () => {
    renderWithRouter(
      Login,
      {},
      {
        route: '/login',
      },
    );
    const user = userEvent.setup();

    expect(screen.getByRole('textbox', { name: /username/i })).toBeInTheDocument();
    // no input to username
    const continueButton = screen.getByRole('button', { name: /Continue/i });
    await user.click(continueButton);
    expect(screen.getByRole('textbox', { name: /username/i })).toHaveFocus();
    expect(screen.getByText('A valid value is required')).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: /username/i }), 'yoshi');
    await user.click(continueButton);
    await screen.findByLabelText(/^password$/i);
    await user.type(screen.getByLabelText(/^password$/i), 'no-tax-fraud');
    expect(screen.getByLabelText(/^password$/i)).toHaveFocus();
  });

  it('shows an inline error when the password is empty', async () => {
    const user = userEvent.setup();
    const { container } = renderWithRouter(Login, {}, { route: '/login' });

    await user.type(screen.getByRole('textbox', { name: /username/i }), 'yoshi');
    await user.click(screen.getByRole('button', { name: /Continue/i }));
    await user.click(screen.getByRole('button', { name: /log in/i }));

    expect(screen.getByLabelText(/^password$/i)).toHaveFocus();
    expect(screen.getByText('A valid value is required')).toBeInTheDocument();
    expect(container.querySelector('form')).toHaveAttribute('novalidate');
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('shows an inline error when the recovery username is empty', async () => {
    const user = userEvent.setup();
    renderWithRouter(Login, {}, { route: '/login' });

    await user.click(screen.getByRole('button', { name: /forgot your password/i }));
    await user.click(screen.getByRole('button', { name: /request password recovery/i }));

    expect(screen.getByRole('textbox', { name: /username/i })).toHaveFocus();
    expect(screen.getByText('A valid value is required')).toBeInTheDocument();
  });

  it('makes an API request when you submit the form', async () => {
    mockLogin.mockResolvedValue({ some: 'data' } as unknown as SessionStore);

    renderWithRouter(
      Login,
      {},
      {
        route: '/login',
      },
    );
    const user = userEvent.setup();

    mockLogin.mockClear();
    await user.type(screen.getByRole('textbox', { name: /Username/i }), 'yoshi');
    await user.click(screen.getByRole('button', { name: /Continue/i }));

    const loginButton = screen.getByRole('button', { name: /log in/i });
    await screen.findByLabelText(/^password$/i);
    await user.type(screen.getByLabelText(/^password$/i), 'no-tax-fraud');
    await user.click(loginButton);
    await waitFor(() => expect(refetchCurrentUser).toHaveBeenCalledWith('yoshi', 'no-tax-fraud'));
  });

  it('shows a backend configuration error when the session endpoint is missing', async () => {
    mockLogin.mockRejectedValue({
      loaded: false,
      session: null,
      error: {
        response: {
          status: 404,
        },
      },
    });

    renderWithRouter(
      Login,
      {},
      {
        route: '/login',
      },
    );
    const user = userEvent.setup();

    await user.type(screen.getByRole('textbox', { name: /Username/i }), 'yoshi');
    await user.click(screen.getByRole('button', { name: /Continue/i }));
    await screen.findByLabelText(/^password$/i);
    await user.type(screen.getByLabelText(/^password$/i), 'no-tax-fraud');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    expect(await screen.findByText(/The login service is not available at this backend address/i)).toBeInTheDocument();
  });

  it('sends the user to the location select page on login if there is more than one location', async () => {
    mockLogin.mockResolvedValue({
      session: {
        authenticated: true,
      },
    } as SessionStore);

    renderWithRouter(
      LoginRoutes,
      {},
      {
        route: '/login',
      },
    );

    const user = userEvent.setup();

    await user.type(screen.getByRole('textbox', { name: /Username/i }), 'yoshi');
    await user.click(screen.getByRole('button', { name: /Continue/i }));
    await screen.findByLabelText(/^password$/i);
    await user.type(screen.getByLabelText(/^password$/i), 'no-tax-fraud');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    expect(await screen.findByText('Location select page')).toBeInTheDocument();
  });

  it('sends admission users directly home without selecting a location', async () => {
    mockLogin.mockResolvedValue({
      session: {
        authenticated: true,
        user: {
          roles: [{ display: 'Admisión' }],
          privileges: [{ display: 'app:home.admision' }],
        },
      },
    } as SessionStore);

    renderWithRouter(LoginRoutes, {}, { route: '/login' });
    const user = userEvent.setup();

    await user.type(screen.getByRole('textbox', { name: /Username/i }), 'admision');
    await user.click(screen.getByRole('button', { name: /Continue/i }));
    await user.type(await screen.findByLabelText(/^password$/i), 'secret');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => expect(mockHardNavigate).toHaveBeenCalledWith(mockConfig.links.loginSuccess));
    expect(screen.queryByText('Location select page')).not.toBeInTheDocument();
  });

  it('should render the both the username and password fields when the showPasswordOnSeparateScreen config is false', async () => {
    mockUseConfig.mockReturnValue({
      ...mockConfig,
      showPasswordOnSeparateScreen: false,
    });

    renderWithRouter(
      Login,
      {},
      {
        route: '/login',
      },
    );

    const usernameInput = screen.queryByRole('textbox', { name: /username/i });
    const continueButton = screen.queryByRole('button', { name: /Continue/i });
    const passwordInput = screen.queryByLabelText(/^password$/i);
    const loginButton = screen.queryByRole('button', { name: /log in/i });

    expect(usernameInput).toBeInTheDocument();
    expect(continueButton).not.toBeInTheDocument();
    expect(passwordInput).toBeInTheDocument();
    expect(loginButton).toBeInTheDocument();
  });

  it('should render password field hidden but present for autofill when showPasswordOnSeparateScreen config is true (default)', async () => {
    mockUseConfig.mockReturnValue({
      ...mockConfig,
    });

    renderWithRouter(
      Login,
      {},
      {
        route: '/login',
      },
    );

    const usernameInput = screen.queryByRole('textbox', { name: /username/i });
    const continueButton = screen.queryByRole('button', { name: /Continue/i });
    const passwordInput = screen.queryByLabelText(/^password$/i);
    const loginButton = screen.queryByRole('button', { name: /log in/i });

    expect(usernameInput).toBeInTheDocument();
    expect(continueButton).toBeInTheDocument();
    expect(passwordInput).toBeInTheDocument();
    expect(passwordInput).toHaveAttribute('aria-hidden', 'true');
    expect(passwordInput).toHaveAttribute('tabIndex', '-1');
    expect(loginButton).not.toBeInTheDocument();
  });

  it('should be able to login when the showPasswordOnSeparateScreen config is false', async () => {
    mockLogin.mockResolvedValue({ some: 'data' } as unknown as SessionStore);
    mockUseConfig.mockReturnValue({
      ...mockConfig,
      showPasswordOnSeparateScreen: false,
    });
    const user = userEvent.setup();
    mockLogin.mockClear();

    renderWithRouter(
      Login,
      {},
      {
        route: '/login',
      },
    );

    const usernameInput = screen.getByRole('textbox', { name: /username/i });
    const passwordInput = screen.getByLabelText(/^password$/i);
    const loginButton = screen.getByRole('button', { name: /log in/i });

    await user.type(usernameInput, 'yoshi');
    await user.type(passwordInput, 'no-tax-fraud');
    await user.click(loginButton);

    await waitFor(() => expect(refetchCurrentUser).toHaveBeenCalledWith('yoshi', 'no-tax-fraud'));
  });

  it('should focus the username input', async () => {
    mockUseConfig.mockReturnValue({
      ...mockConfig,
    });

    renderWithRouter(
      Login,
      {},
      {
        route: '/login',
      },
    );

    const usernameInput = screen.getByRole('textbox', { name: /username/i });
    expect(usernameInput).toHaveFocus();
  });

  it('should focus the password input in the password screen', async () => {
    const user = userEvent.setup();
    mockUseConfig.mockReturnValue({
      ...mockConfig,
    });

    renderWithRouter(
      Login,
      {},
      {
        route: '/login',
      },
    );

    const usernameInput = screen.getByRole('textbox', { name: /username/i });
    const continueButton = screen.getByRole('button', { name: /Continue/i });

    await user.type(usernameInput, 'yoshi');
    await user.click(continueButton);

    const passwordInput = screen.getByLabelText(/^password$/i);
    expect(passwordInput).toHaveFocus();
  });

  it('should focus the username input when the showPasswordOnSeparateScreen config is false', async () => {
    mockUseConfig.mockReturnValue({
      ...mockConfig,
      showPasswordOnSeparateScreen: false,
    });

    renderWithRouter(
      Login,
      {},
      {
        route: '/login',
      },
    );

    const usernameInput = screen.getByRole('textbox', { name: /username/i });

    expect(usernameInput).toHaveFocus();
  });

  it('does not render announcement banners by default', () => {
    renderWithRouter(
      Login,
      {},
      {
        route: '/login',
      },
    );

    expect(screen.queryByText(/Planned downtime/i)).not.toBeInTheDocument();
  });

  it('renders configured announcement banners above the login card', () => {
    mockUseConfig.mockReturnValue({
      ...mockConfig,
      announcements: [
        { title: '', text: 'Planned downtime tonight at 10pm', kind: 'warning' },
        { title: 'Heads up', text: 'New release shipping Friday', kind: 'info' },
      ],
    });

    renderWithRouter(
      Login,
      {},
      {
        route: '/login',
      },
    );

    expect(screen.getByText('Planned downtime tonight at 10pm')).toBeInTheDocument();
    expect(screen.getByText('New release shipping Friday')).toBeInTheDocument();
    expect(screen.getByText('Heads up')).toBeInTheDocument();
  });

  it('interpolates relative background image paths into CSS custom properties', () => {
    mockUseConfig.mockReturnValue({
      ...mockConfig,
      background: { image: `${openmrsSpaBasePlaceholder}/assets/bg.jpg`, color: '' },
    });

    renderWithRouter(
      Login,
      {},
      {
        route: '/login',
      },
    );
    const root = screen.getByTestId('login-container');

    const bgImage = root.style.getPropertyValue('--login-bg-image');
    expect(bgImage).toContain('/openmrs/spa/assets/bg.jpg');
    expect(bgImage).not.toContain(openmrsSpaBasePlaceholder);
    expect(root.className).toMatch(/containerWithImage/);
  });

  it('applies a configured background color when no background image is configured', () => {
    mockUseConfig.mockReturnValue({
      ...mockConfig,
      background: { image: '', color: '#0066cc' },
    });

    renderWithRouter(
      Login,
      {},
      {
        route: '/login',
      },
    );
    const root = screen.getByTestId('login-container');

    expect(root.style.getPropertyValue('--login-bg-color')).toBe('#0066cc');
    expect(root.style.getPropertyValue('--login-bg-image')).toBe('');
    expect(root.className).toMatch(/containerWithColor/);
    expect(root.className).not.toMatch(/containerWithImage/);
  });
});
