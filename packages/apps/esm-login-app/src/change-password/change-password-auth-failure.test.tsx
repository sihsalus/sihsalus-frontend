import { showSnackbar } from '@openmrs/esm-framework';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChangePasswordModal from './change-password.modal';

const transport = vi.hoisted(() => ({
  getConfig: vi.fn(),
  navigate: vi.fn(),
  clearHistory: vi.fn(),
}));

vi.mock('@openmrs/esm-config', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getConfig: transport.getConfig,
}));

vi.mock('@openmrs/esm-navigation', () => ({
  navigate: transport.navigate,
  clearHistory: transport.clearHistory,
}));

vi.mock('@openmrs/esm-framework', async (importOriginal) => {
  // Exercise this checkout's transport, rather than a mock that assumes how
  // rejectOnAuthFailure works. Only configuration, navigation and HTTP are stubbed.
  const { openmrsFetch, restBaseUrl } = await vi.importActual<typeof import('@openmrs/esm-api')>(
    '../../../../libs/esm-api/src/openmrs-fetch',
  );
  return {
    ...(await importOriginal<object>()),
    openmrsFetch,
    restBaseUrl,
  };
});

describe('password change HTTP outcomes', () => {
  const close = vi.fn();

  beforeEach(() => {
    transport.getConfig.mockResolvedValue({
      redirectAuthFailure: {
        enabled: true,
        errors: [401],
        url: '/openmrs/spa/login',
        resolvePromise: false,
      },
      followRedirects: true,
    });
    vi.spyOn(window, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function submitPasswordChange() {
    const user = userEvent.setup();
    render(<ChangePasswordModal close={close} />);
    await user.type(screen.getByLabelText('Old password'), 'SyntheticOld9');
    await user.type(screen.getByLabelText('New password'), 'SyntheticNew9');
    await user.type(screen.getByLabelText('Confirm new password'), 'SyntheticNew9');
    await user.click(screen.getByRole('button', { name: 'Change' }));
  }

  it.each([false, true])('rejects HTTP 401 when redirect resolvePromise is %s', async (resolvePromise) => {
    transport.getConfig.mockResolvedValue({
      redirectAuthFailure: {
        enabled: true,
        errors: [401],
        url: '/openmrs/spa/login',
        resolvePromise,
      },
      followRedirects: true,
    });
    vi.mocked(window.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { message: 'Synthetic private backend detail' },
        }),
        { status: 401 },
      ),
    );

    await submitPasswordChange();

    expect(await screen.findByText('Error changing password')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Change' })).toBeEnabled());
    expect(transport.navigate).toHaveBeenCalledWith({
      to: '/openmrs/spa/login',
    });
    expect(close).not.toHaveBeenCalled();
    expect(showSnackbar).not.toHaveBeenCalled();
    expect(screen.queryByText('Synthetic private backend detail')).not.toBeInTheDocument();
    expect(window.fetch).toHaveBeenCalledTimes(1);
  });

  it.each([200, 204])('confirms an empty successful HTTP %s response', async (status) => {
    vi.mocked(window.fetch).mockResolvedValue(new Response(null, { status }));

    await submitPasswordChange();

    await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
    expect(showSnackbar).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' }));
    expect(transport.navigate).not.toHaveBeenCalled();
    expect(screen.queryByText('Error changing password')).not.toBeInTheDocument();
  });

  it('keeps a forbidden response as an error without claiming success', async () => {
    vi.mocked(window.fetch).mockResolvedValue(new Response('{}', { status: 403 }));

    await submitPasswordChange();

    expect(await screen.findByText('Error changing password')).toBeInTheDocument();
    expect(close).not.toHaveBeenCalled();
    expect(showSnackbar).not.toHaveBeenCalled();
    expect(transport.navigate).not.toHaveBeenCalled();
  });

  it('settles a network failure without automatically retrying the password change', async () => {
    vi.mocked(window.fetch).mockRejectedValue(new TypeError('Synthetic network failure'));

    await submitPasswordChange();

    expect(await screen.findByText('Error changing password')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Change' })).toBeEnabled());
    expect(close).not.toHaveBeenCalled();
    expect(showSnackbar).not.toHaveBeenCalled();
    expect(window.fetch).toHaveBeenCalledTimes(1);
  });
});
