import { useConfig, useConnectivity, useSession } from '@openmrs/esm-framework';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig } from 'swr';
import { mockConfig } from '../../../../test-utils/mocks/login-config.mock';
import Login from '../login/login.component';
import { getPasswordRecoveryCapability, requestPasswordRecovery } from './password-recovery.resource';

vi.mock('./password-recovery.resource', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./password-recovery.resource')>()),
  getPasswordRecoveryCapability: vi.fn(),
  requestPasswordRecovery: vi.fn(),
}));
const requestMock = vi.mocked(requestPasswordRecovery);
const capabilityMock = vi.mocked(getPasswordRecoveryCapability);

beforeEach(() => {
  vi.mocked(useConfig).mockReturnValue(mockConfig);
  vi.mocked(useConnectivity).mockReturnValue(true);
  vi.mocked(useSession).mockReturnValue({
    authenticated: false,
    sessionId: 'synthetic',
  });
  capabilityMock.mockResolvedValue(true);
  requestMock.mockResolvedValue(undefined);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
});
afterEach(() => vi.unstubAllGlobals());

async function openRecovery() {
  const user = userEvent.setup();
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    </SWRConfig>,
  );
  await user.click(screen.getByRole('button', { name: /forgot your password/i }));
  await waitFor(() => expect(screen.getByRole('button', { name: /request password recovery/i })).toBeEnabled());
  return user;
}

it('waits for queue acceptance and prevents duplicate submissions', async () => {
  let resolve!: () => void;
  requestMock.mockReturnValue(
    new Promise<void>((done) => {
      resolve = done;
    }),
  );
  const user = await openRecovery();
  await user.type(screen.getByRole('textbox', { name: /username or registered email/i }), 'synthetic@example.invalid');
  const submit = screen.getByRole('button', {
    name: /request password recovery/i,
  });
  await user.click(submit);
  fireEvent.submit(submit.closest('form') as HTMLFormElement);
  expect(requestMock).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('Recovery request accepted')).not.toBeInTheDocument();
  resolve();
  expect(await screen.findByText('Recovery request accepted')).toBeInTheDocument();
});

it.each([254, 255, 256])('preserves pasted identifier at boundary %i', async (length) => {
  const user = await openRecovery();
  const input = screen.getByRole('textbox', {
    name: /username or registered email/i,
  });
  const identifier = 'a'.repeat(length);
  fireEvent.change(input, { target: { value: identifier } });
  await user.click(screen.getByRole('button', { name: /request password recovery/i }));
  expect(input).toHaveValue(identifier);
  if (length > 255) {
    expect(requestMock).not.toHaveBeenCalled();
    expect(input).toHaveAttribute('aria-invalid', 'true');
  } else {
    await waitFor(() => expect(requestMock).toHaveBeenCalledWith(identifier));
  }
});

it('counts supplementary Unicode characters as code points without truncation', async () => {
  const user = await openRecovery();
  const identifier = 'é😀'.repeat(127) + 'a';
  fireEvent.change(screen.getByRole('textbox', { name: /username or registered email/i }), {
    target: { value: identifier },
  });
  await user.click(screen.getByRole('button', { name: /request password recovery/i }));
  await waitFor(() => expect(requestMock).toHaveBeenCalledWith(identifier));
});

it('keeps administrator recovery available when backend support is absent', async () => {
  capabilityMock.mockRejectedValue({ response: { status: 404 } });
  const user = await openRecovery();
  await user.type(screen.getByRole('textbox', { name: /username/i }), 'synthetic');
  await user.click(screen.getByRole('button', { name: /request password recovery/i }));
  expect(screen.getByText('Ask an administrator for help')).toBeInTheDocument();
  expect(requestMock).not.toHaveBeenCalled();
});

it('does not claim acceptance or expose backend details on failure', async () => {
  requestMock.mockRejectedValue(new Error('Synthetic SMTP secret'));
  const user = await openRecovery();
  await user.type(screen.getByRole('textbox', { name: /username/i }), 'synthetic');
  await user.click(screen.getByRole('button', { name: /request password recovery/i }));
  expect(await screen.findByText('Could not request password recovery')).toBeInTheDocument();
  expect(screen.queryByText('Recovery request accepted')).not.toBeInTheDocument();
  expect(screen.queryByText('Synthetic SMTP secret')).not.toBeInTheDocument();
});
