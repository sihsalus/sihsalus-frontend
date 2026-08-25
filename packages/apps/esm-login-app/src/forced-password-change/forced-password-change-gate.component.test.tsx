import { navigate, useConfig, useConnectivity, useSession } from '@openmrs/esm-framework';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockConfig } from '../../../../test-utils/mocks/login-config.mock';

import ForcedPasswordChangeGate from './forced-password-change-gate.component';
import { startForcedPasswordChangeNavigation } from './forced-password-change';

const mockNavigate = vi.mocked(navigate);
const mockStartForcedPasswordChangeNavigation = vi.mocked(startForcedPasswordChangeNavigation);
const mockUseConfig = vi.mocked(useConfig);
const mockUseConnectivity = vi.mocked(useConnectivity);
const mockUseSession = vi.mocked(useSession);

vi.mock('./forced-password-change', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./forced-password-change')>()),
  startForcedPasswordChangeNavigation: vi.fn(),
}));

function sessionWithForcePassword(value: unknown) {
  return {
    authenticated: true,
    sessionId: 'active-session',
    user: {
      uuid: 'user-uuid',
      username: 'synthetic-user',
      userProperties: { forcePassword: value },
    },
  } as never;
}

describe('ForcedPasswordChangeGate', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/openmrs/spa/login/forced-password');
    mockUseConfig.mockReturnValue(mockConfig);
    mockUseConnectivity.mockReturnValue(true);
    mockUseSession.mockReturnValue({ authenticated: false, sessionId: 'anonymous-session' });
    mockStartForcedPasswordChangeNavigation.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it.each([true, 'true'])('blocks the SPA and redirects a basic-provider session flagged with %j', (value) => {
    mockUseSession.mockReturnValue(sessionWithForcePassword(value));

    render(<ForcedPasswordChangeGate />);

    expect(screen.getByRole('heading', { name: /must change your password/i })).toBeInTheDocument();
    expect(screen.getByText(/opening password change/i)).toBeInTheDocument();
    expect(mockStartForcedPasswordChangeNavigation).toHaveBeenCalledTimes(1);
  });

  it.each([false, 'false', '1', undefined])('does not redirect for the non-true value %j', (value) => {
    mockUseSession.mockReturnValue(sessionWithForcePassword(value));

    const { container } = render(<ForcedPasswordChangeGate />);

    expect(container).toBeEmptyDOMElement();
    expect(mockStartForcedPasswordChangeNavigation).not.toHaveBeenCalled();
  });

  it('sends an anonymous direct visit to the isolated route back to login', () => {
    render(<ForcedPasswordChangeGate />);

    expect(mockNavigate).toHaveBeenCalledWith({ to: '/openmrs/spa/login' });
    expect(mockStartForcedPasswordChangeNavigation).not.toHaveBeenCalled();
  });

  it('sends an authenticated unmarked direct visit to its normal post-login route', () => {
    mockUseSession.mockReturnValue({
      authenticated: true,
      sessionId: 'active-session',
      sessionLocation: { uuid: 'location-uuid' },
      user: { uuid: 'user-uuid', username: 'synthetic-user', userProperties: {} },
    } as never);

    render(<ForcedPasswordChangeGate />);

    expect(mockNavigate).toHaveBeenCalledWith({ to: mockConfig.links.loginSuccess });
    expect(mockStartForcedPasswordChangeNavigation).not.toHaveBeenCalled();
  });

  it('does not send the oauth2 provider to Legacy', () => {
    mockUseConfig.mockReturnValue({
      ...mockConfig,
      provider: { ...mockConfig.provider, type: 'oauth2' },
    });
    mockUseSession.mockReturnValue(sessionWithForcePassword('true'));

    const { container } = render(<ForcedPasswordChangeGate />);

    expect(container).toBeEmptyDOMElement();
    expect(mockStartForcedPasswordChangeNavigation).not.toHaveBeenCalled();
  });

  it('keeps a custom provider fail-closed when the OpenMRS flag is present', async () => {
    mockUseConfig.mockReturnValue({
      ...mockConfig,
      provider: { ...mockConfig.provider, type: 'custom' },
    });
    mockUseSession.mockReturnValue(sessionWithForcePassword('true'));

    render(<ForcedPasswordChangeGate />);

    expect(screen.getByRole('heading', { name: /must change your password/i })).toBeInTheDocument();
    expect(await screen.findByText(/administrator assistance is required/i)).toBeInTheDocument();
    expect(screen.getByText(/configured login provider cannot complete it/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
    expect(mockStartForcedPasswordChangeNavigation).not.toHaveBeenCalled();
  });

  it('leaves a clinical deep link before probing or opening Legacy', async () => {
    window.history.replaceState({}, '', '/openmrs/spa/patient/synthetic-patient/chart');
    mockUseSession.mockReturnValue(sessionWithForcePassword('true'));

    render(<ForcedPasswordChangeGate />);

    expect(mockNavigate).toHaveBeenCalledWith({ to: '/openmrs/spa/login/forced-password' });
    expect(mockStartForcedPasswordChangeNavigation).not.toHaveBeenCalled();

    act(() => {
      window.history.replaceState({}, '', '/openmrs/spa/login/forced-password');
      window.dispatchEvent(new CustomEvent('single-spa:routing-event'));
    });

    await waitFor(() => expect(mockStartForcedPasswordChangeNavigation).toHaveBeenCalledTimes(1));
  });

  it('cancels Back navigation to a clinical route and invalidates the pending Legacy navigation', () => {
    mockUseSession.mockReturnValue(sessionWithForcePassword('true'));
    const navigationChecks: Array<() => boolean> = [];
    mockStartForcedPasswordChangeNavigation.mockImplementation(
      (_topLevelNavigate, _checkPasswordChangePage, isStillAllowed) => {
        navigationChecks.push(isStillAllowed);
        return new Promise<boolean>(() => undefined);
      },
    );
    const cancelNavigation = vi.fn();

    render(<ForcedPasswordChangeGate />);

    expect(navigationChecks[0]?.()).toBe(true);
    act(() => {
      window.dispatchEvent(
        new CustomEvent('single-spa:before-routing-event', {
          detail: {
            newUrl: `${globalThis.location.origin}/openmrs/spa/patient/synthetic-patient/chart`,
            cancelNavigation,
          },
        }),
      );
    });

    expect(cancelNavigation).toHaveBeenCalledOnce();
    expect(navigationChecks[0]?.()).toBe(false);
  });

  it('resumes the gate after single-spa silently restores a cancelled Back navigation', async () => {
    mockUseSession.mockReturnValue(sessionWithForcePassword('true'));
    mockStartForcedPasswordChangeNavigation
      .mockImplementationOnce(() => new Promise<boolean>(() => undefined))
      .mockResolvedValueOnce(true);
    const cancelNavigation = vi.fn();

    render(<ForcedPasswordChangeGate />);
    expect(mockStartForcedPasswordChangeNavigation).toHaveBeenCalledTimes(1);

    act(() => {
      window.dispatchEvent(
        new CustomEvent('single-spa:before-routing-event', {
          detail: {
            newUrl: `${globalThis.location.origin}/openmrs/spa/patient/synthetic-patient/chart`,
            cancelNavigation,
          },
        }),
      );
    });

    expect(cancelNavigation).toHaveBeenCalledOnce();
    expect(globalThis.location.pathname).toBe('/openmrs/spa/login/forced-password');
    await waitFor(() => expect(mockStartForcedPasswordChangeNavigation).toHaveBeenCalledTimes(2));
  });

  it('restores the isolated route when an unsafe routing event could not be cancelled', () => {
    mockUseSession.mockReturnValue(sessionWithForcePassword('true'));
    render(<ForcedPasswordChangeGate />);
    mockNavigate.mockClear();

    act(() => {
      window.history.replaceState({}, '', '/openmrs/spa/patient/synthetic-patient/chart');
      window.dispatchEvent(new CustomEvent('single-spa:routing-event'));
    });

    expect(mockNavigate).toHaveBeenCalledWith({ to: '/openmrs/spa/login/forced-password' });
  });

  it('rejects a cross-origin routing target even when its path resembles the isolated route', () => {
    mockUseSession.mockReturnValue(sessionWithForcePassword('true'));
    const cancelNavigation = vi.fn();
    render(<ForcedPasswordChangeGate />);

    act(() => {
      window.dispatchEvent(
        new CustomEvent('single-spa:before-routing-event', {
          detail: {
            newUrl: 'https://malicious.example/openmrs/spa/login/forced-password',
            cancelNavigation,
          },
        }),
      );
    });

    expect(cancelNavigation).toHaveBeenCalledOnce();
  });

  it('aborts the Legacy page check when the gate unmounts', async () => {
    mockUseSession.mockReturnValue(sessionWithForcePassword('true'));
    let pageCheckSignal: AbortSignal | undefined;
    vi.spyOn(globalThis, 'fetch').mockImplementation((_input, init) => {
      pageCheckSignal = init?.signal as AbortSignal;
      return new Promise<Response>((_resolve, reject) => {
        pageCheckSignal?.addEventListener(
          'abort',
          () => reject(new DOMException('The page check was cancelled', 'AbortError')),
          { once: true },
        );
      });
    });
    mockStartForcedPasswordChangeNavigation.mockImplementation(
      async (_topLevelNavigate, checkPasswordChangePage, navigationIsStillAllowed) => {
        await checkPasswordChangePage('/openmrs/admin/users/changePassword.form');
        return navigationIsStillAllowed();
      },
    );

    const view = render(<ForcedPasswordChangeGate />);
    await waitFor(() => expect(pageCheckSignal).toBeDefined());
    view.unmount();

    expect(pageCheckSignal?.aborted).toBe(true);
    await act(async () => Promise.resolve());
  });

  it('aborts the Legacy page check and permits logout routing', async () => {
    mockUseSession.mockReturnValue(sessionWithForcePassword('true'));
    let pageCheckSignal: AbortSignal | undefined;
    vi.spyOn(globalThis, 'fetch').mockImplementation((_input, init) => {
      pageCheckSignal = init?.signal as AbortSignal;
      return new Promise<Response>((_resolve, reject) => {
        pageCheckSignal?.addEventListener(
          'abort',
          () => reject(new DOMException('The page check was cancelled', 'AbortError')),
          { once: true },
        );
      });
    });
    mockStartForcedPasswordChangeNavigation.mockImplementation(
      async (_topLevelNavigate, checkPasswordChangePage, navigationIsStillAllowed) => {
        await checkPasswordChangePage('/openmrs/admin/users/changePassword.form');
        return navigationIsStillAllowed();
      },
    );
    const cancelNavigation = vi.fn();
    render(<ForcedPasswordChangeGate />);
    await waitFor(() => expect(pageCheckSignal).toBeDefined());

    act(() => {
      window.dispatchEvent(
        new CustomEvent('single-spa:before-routing-event', {
          detail: { newUrl: `${globalThis.location.origin}/openmrs/spa/logout`, cancelNavigation },
        }),
      );
    });

    expect(pageCheckSignal?.aborted).toBe(true);
    expect(cancelNavigation).not.toHaveBeenCalled();
    await act(async () => Promise.resolve());
  });

  it('recovers when another listener silently cancels logout navigation', async () => {
    vi.useFakeTimers();
    mockUseSession.mockReturnValue(sessionWithForcePassword('true'));
    mockStartForcedPasswordChangeNavigation
      .mockImplementationOnce(() => new Promise<boolean>(() => undefined))
      .mockResolvedValueOnce(true);

    render(<ForcedPasswordChangeGate />);
    expect(mockStartForcedPasswordChangeNavigation).toHaveBeenCalledTimes(1);

    act(() => {
      window.dispatchEvent(
        new CustomEvent('single-spa:before-routing-event', {
          detail: { newUrl: `${globalThis.location.origin}/openmrs/spa/logout` },
        }),
      );
    });

    expect(globalThis.location.pathname).toBe('/openmrs/spa/login/forced-password');
    expect(mockStartForcedPasswordChangeNavigation).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTimeAsync(5_000));
    expect(mockStartForcedPasswordChangeNavigation).toHaveBeenCalledTimes(2);
  });

  it('invalidates a failed navigation attempt before the logout button changes routes', async () => {
    mockUseSession.mockReturnValue(sessionWithForcePassword('true'));
    let navigationStillAllowed: (() => boolean) | undefined;
    mockStartForcedPasswordChangeNavigation.mockImplementation(
      async (_topLevelNavigate, _checkPasswordChangePage, isStillAllowed) => {
        navigationStillAllowed = isStillAllowed;
        throw new Error('synthetic destination failure');
      },
    );
    const user = userEvent.setup();
    render(<ForcedPasswordChangeGate />);

    await screen.findByText(/password change could not be opened/i);
    expect(navigationStillAllowed?.()).toBe(true);
    await user.click(screen.getByRole('button', { name: /logout/i }));

    expect(navigationStillAllowed?.()).toBe(false);
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/openmrs/spa/logout' });
  });

  it('fails closed if the transition to the isolated route never completes', () => {
    vi.useFakeTimers();
    window.history.replaceState({}, '', '/openmrs/spa/patient/synthetic-patient/chart');
    mockUseSession.mockReturnValue(sessionWithForcePassword('true'));

    render(<ForcedPasswordChangeGate />);
    expect(mockStartForcedPasswordChangeNavigation).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(5_000));

    expect(screen.getByText(/password change could not be opened/i)).toBeInTheDocument();
    expect(mockStartForcedPasswordChangeNavigation).not.toHaveBeenCalled();
  });

  it('fails closed without opening the online-only Legacy page while offline', async () => {
    mockUseConnectivity.mockReturnValue(false);
    mockUseSession.mockReturnValue(sessionWithForcePassword('true'));
    const user = userEvent.setup();

    render(<ForcedPasswordChangeGate />);

    expect(screen.getByRole('heading', { name: /connect to change your password/i })).toBeInTheDocument();
    expect(screen.getByText(/cannot use SIHSALUS until it is complete/i)).toBeInTheDocument();
    expect(mockStartForcedPasswordChangeNavigation).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /logout/i }));
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/openmrs/spa/logout' });
  });

  it('opens the required change when connectivity returns', async () => {
    mockUseConnectivity.mockReturnValue(false);
    mockUseSession.mockReturnValue(sessionWithForcePassword('true'));
    const view = render(<ForcedPasswordChangeGate />);

    expect(mockStartForcedPasswordChangeNavigation).not.toHaveBeenCalled();

    mockUseConnectivity.mockReturnValue(true);
    view.rerender(<ForcedPasswordChangeGate />);

    await waitFor(() => expect(mockStartForcedPasswordChangeNavigation).toHaveBeenCalledTimes(1));
  });

  it('shows a safe blocking error without exposing the navigation exception', async () => {
    mockUseSession.mockReturnValue(sessionWithForcePassword('true'));
    mockStartForcedPasswordChangeNavigation.mockRejectedValueOnce(new Error('raw internal navigation detail'));
    const user = userEvent.setup();

    render(<ForcedPasswordChangeGate />);

    expect(await screen.findByText(/password change could not be opened/i)).toBeInTheDocument();
    expect(screen.queryByText(/raw internal navigation detail/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /try again/i }));

    await waitFor(() => expect(mockStartForcedPasswordChangeNavigation).toHaveBeenCalledTimes(2));
    expect(screen.queryByText(/password change could not be opened/i)).not.toBeInTheDocument();
    expect(screen.getByText(/opening password change/i)).toBeInTheDocument();
  });
});
