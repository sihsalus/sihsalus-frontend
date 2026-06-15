import {
  clearCurrentUser,
  type FetchResponse,
  navigate,
  openmrsFetch,
  refetchCurrentUser,
  restBaseUrl,
  type Session,
  setUserLanguage,
  useConfig,
  useConnectivity,
  useSession,
} from '@openmrs/esm-framework';
import { render, waitFor } from '@testing-library/react';
import { mutate } from 'swr';

import RedirectLogout from './redirect-logout.component';

vi.mock('swr', () => ({
  mutate: vi.fn(),
}));

const mockClearCurrentUser = vi.mocked(clearCurrentUser);
const mockNavigate = vi.mocked(navigate);
const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const mockRefetchCurrentUser = vi.mocked(refetchCurrentUser);
const mockSetUserLanguage = vi.mocked(setUserLanguage);
const mockUseConfig = vi.mocked(useConfig);
const mockUseConnectivity = vi.mocked(useConnectivity);
const mockUseSession = vi.mocked(useSession);

describe('RedirectLogout', () => {
  beforeEach(() => {
    mockUseConnectivity.mockReturnValue(true);
    mockOpenmrsFetch.mockResolvedValue({} as FetchResponse<unknown>);

    mockUseSession.mockReturnValue({
      authenticated: true,
      sessionId: 'xyz',
    } as Session);

    mockUseConfig.mockReturnValue({
      provider: {
        type: '',
        logoutUrl: '${openmrsSpaBase}/logout',
      },
    });

    document.documentElement.dataset.defaultLang = 'km';
  });

  it('should redirect to login page upon logout', async () => {
    render(<RedirectLogout />);

    expect(mockOpenmrsFetch).toHaveBeenCalledWith(`${restBaseUrl}/session`, {
      method: 'DELETE',
    });

    await waitFor(() => expect(mutate).toHaveBeenCalled());

    expect(mockClearCurrentUser).toHaveBeenCalled();
    expect(mockRefetchCurrentUser).toHaveBeenCalled();
    expect(mockSetUserLanguage).toHaveBeenCalledWith({
      locale: 'km',
      authenticated: false,
      sessionId: '',
    });
    expect(mockNavigate).toHaveBeenCalledWith({ to: '${openmrsSpaBase}/login' });
  });

  it('should redirect to the configured logout URL if the provider is `oauth2`', async () => {
    mockUseConfig.mockReturnValue({
      provider: {
        type: 'oauth2',
        logoutUrl: '/openmrs/oauth2logout',
      },
    });

    render(<RedirectLogout />);

    expect(mockOpenmrsFetch).toHaveBeenCalledWith(`${restBaseUrl}/session`, {
      method: 'DELETE',
    });

    await waitFor(() => expect(mutate).toHaveBeenCalled());

    expect(mockClearCurrentUser).toHaveBeenCalled();
    expect(mockRefetchCurrentUser).toHaveBeenCalled();
    expect(mockSetUserLanguage).toHaveBeenCalledWith({
      locale: 'km',
      authenticated: false,
      sessionId: '',
    });
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/openmrs/oauth2logout' });
  });

  it('should redirect to login if the session is already unauthenticated', async () => {
    mockUseSession.mockReturnValue({
      authenticated: false,
    } as Session);

    render(<RedirectLogout />);

    expect(mockNavigate).toHaveBeenCalledWith({ to: '${openmrsSpaBase}/login' });
  });

  it('should redirect to login if the application is offline', async () => {
    mockUseConnectivity.mockReturnValue(false);

    render(<RedirectLogout />);

    expect(mockNavigate).toHaveBeenCalledWith({ to: '${openmrsSpaBase}/login' });
  });

  it('should handle logout failure gracefully', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockOpenmrsFetch.mockRejectedValue(new Error('Logout failed'));

    render(<RedirectLogout />);

    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith('Logout failed:', new Error('Logout failed'));
    });

    consoleError.mockRestore();
  });

  it('should handle missing default language attribute', async () => {
    delete document.documentElement.dataset.defaultLang;

    render(<RedirectLogout />);

    await waitFor(() => {
      expect(mockSetUserLanguage).toHaveBeenCalledWith({
        locale: undefined,
        authenticated: false,
        sessionId: '',
      });
    });
  });

  it('should handle config changes appropriately', async () => {
    const { rerender } = render(<RedirectLogout />);

    mockUseConfig.mockReturnValue({
      provider: {
        type: 'testProvider',
      },
    });

    rerender(<RedirectLogout />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: '${openmrsSpaBase}/login' });
    });
  });

  it('should redirect to the configured logout URL if user is not authenticated and the provider is oauth2', async () => {
    mockUseSession.mockReturnValue({
      authenticated: false,
    } as Session);
    mockUseConfig.mockReturnValue({
      provider: {
        type: 'oauth2',
        logoutUrl: '/openmrs/oauth2logout',
      },
    });

    render(<RedirectLogout />);

    expect(mockNavigate).toHaveBeenCalledWith({ to: '/openmrs/oauth2logout' });
  });
});
