import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import {
  getPasswordRecoveryCapability,
  readRecoveryToken,
  requestPasswordRecovery,
  resetPassword,
} from './password-recovery.resource';

const fetchMock = vi.mocked(openmrsFetch);

it('uses the backend capability and requires explicit queue acceptance', async () => {
  fetchMock.mockResolvedValueOnce({ data: { enabled: true } } as never);
  expect(await getPasswordRecoveryCapability()).toBe(true);
  fetchMock.mockResolvedValueOnce({ status: 200 } as never);
  await expect(requestPasswordRecovery('synthetic')).rejects.toThrow('not accepted');
  fetchMock.mockResolvedValueOnce({ status: 202 } as never);
  await expect(requestPasswordRecovery('synthetic')).resolves.toBeUndefined();
});

it('sends secrets in the request body, never in the URL', async () => {
  fetchMock.mockResolvedValueOnce({ status: 204 } as never);
  await resetPassword('synthetic-key', 'synthetic-password');
  expect(fetchMock).toHaveBeenCalledWith(`${restBaseUrl}/passwordreset/confirm`, {
    method: 'POST',
    rejectOnAuthFailure: true,
    headers: { 'Content-Type': 'application/json' },
    body: {
      activationKey: 'synthetic-key',
      newPassword: 'synthetic-password',
    },
  });
});

it.each(['', '#token=short', '#token=' + 'a'.repeat(129), '#token=%3Cscript%3E'])(
  'rejects an invalid fragment: %s',
  (fragment) => {
    expect(readRecoveryToken(fragment)).toBe('');
  },
);

it.each([20, 128])('accepts supported token length %i without accepting query strings', (length) => {
  expect(readRecoveryToken('#token=' + 'a'.repeat(length))).toBe('a'.repeat(length));
  expect(readRecoveryToken('?token=' + 'a'.repeat(length))).toBe('');
});
