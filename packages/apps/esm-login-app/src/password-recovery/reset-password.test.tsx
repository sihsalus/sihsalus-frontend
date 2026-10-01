import { useConfig, useConnectivity, useSession } from '@openmrs/esm-framework';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { mockConfig } from '../../../../test-utils/mocks/login-config.mock';
import { resetPassword } from './password-recovery.resource';
import ResetPassword from './reset-password.component';

vi.mock('./password-recovery.resource', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./password-recovery.resource')>()),
  resetPassword: vi.fn(),
}));
const token = 'SyntheticRecoveryToken0123456789';
const resetMock = vi.mocked(resetPassword);

beforeEach(() => {
  vi.mocked(useConfig).mockReturnValue(mockConfig);
  vi.mocked(useConnectivity).mockReturnValue(true);
  vi.mocked(useSession).mockReturnValue({
    authenticated: false,
    sessionId: 'synthetic',
  });
  globalThis.history.replaceState(null, '', `/login/reset-password#token=${token}`);
  resetMock.mockResolvedValue(undefined);
});
afterEach(() => globalThis.history.replaceState(null, '', '/'));
const mount = () =>
  render(
    <StrictMode>
      <MemoryRouter>
        <ResetPassword />
      </MemoryRouter>
    </StrictMode>,
  );

async function fillAndSubmit() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('New password'), 'SyntheticPassword123');
  await user.type(screen.getByLabelText('Confirm password'), 'SyntheticPassword123');
  await user.click(screen.getByRole('button', { name: 'Save new password' }));
}

it('removes the token from history and saves exactly once without logging in', async () => {
  let resolve!: () => void;
  resetMock.mockReturnValue(
    new Promise<void>((done) => {
      resolve = done;
    }),
  );
  mount();
  expect(globalThis.location.hash).toBe('');
  await fillAndSubmit();
  fireEvent.submit(screen.getByRole('button', { name: 'Saving password…' }).closest('form') as HTMLFormElement);
  expect(resetMock).toHaveBeenCalledTimes(1);
  expect(resetMock).toHaveBeenCalledWith(token, 'SyntheticPassword123');
  expect(screen.queryByText('Password changed successfully')).not.toBeInTheDocument();
  resolve();
  expect(await screen.findByText('Password changed successfully')).toBeInTheDocument();
  expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Back to log/i })).toHaveAttribute('href', '/login');
});

it('requires matching passwords before contacting the backend', async () => {
  const user = userEvent.setup();
  mount();
  await user.click(screen.getByRole('button', { name: 'Save new password' }));
  expect(screen.getByText('Enter and confirm your new password.')).toBeInTheDocument();
  await user.type(screen.getByLabelText('New password'), 'SyntheticPassword123');
  await user.type(screen.getByLabelText('Confirm password'), 'DifferentPassword123');
  await user.click(screen.getByRole('button', { name: 'Save new password' }));
  expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
  expect(resetMock).not.toHaveBeenCalled();
});

it.each([400, 422, 503])('handles rejection %i without exposing raw errors or claiming success', async (status) => {
  resetMock.mockRejectedValue({
    response: { status },
    message: 'Synthetic internal detail',
  });
  mount();
  await fillAndSubmit();
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Save new password' })).toHaveProperty('disabled', status === 400),
  );
  expect(screen.queryByText('Password changed successfully')).not.toBeInTheDocument();
  expect(screen.queryByText('Synthetic internal detail')).not.toBeInTheDocument();
  expect(screen.getByLabelText('New password')).toHaveValue('SyntheticPassword123');
});

it('does not submit offline', () => {
  vi.mocked(useConnectivity).mockReturnValue(false);
  mount();
  expect(screen.getByRole('button', { name: 'Save new password' })).toBeDisabled();
  expect(resetMock).not.toHaveBeenCalled();
});

it('does not accept a missing token or reset an authenticated session', () => {
  globalThis.history.replaceState(null, '', '/login/reset-password');
  const { unmount } = mount();
  expect(screen.getByRole('button', { name: 'Save new password' })).toBeDisabled();
  unmount();
  vi.mocked(useSession).mockReturnValue({
    authenticated: true,
    sessionId: 'synthetic',
  });
  mount();
  expect(screen.getByText('Sign out before using a recovery link.')).toBeInTheDocument();
  expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
  expect(resetMock).not.toHaveBeenCalled();
});
