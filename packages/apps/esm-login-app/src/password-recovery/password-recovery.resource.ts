import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';

// OpenMRS users.email is varchar(255); username is varchar(50).
export const RECOVERY_IDENTIFIER_MAX_LENGTH = 255;
const recoveryUrl = `${restBaseUrl}/passwordreset`;

export async function getPasswordRecoveryCapability() {
  const response = await openmrsFetch<{ enabled: boolean }>(recoveryUrl, {
    rejectOnAuthFailure: true,
  });
  return response.data?.enabled === true;
}

export async function requestPasswordRecovery(usernameOrEmail: string) {
  const response = await openmrsFetch(recoveryUrl, {
    method: 'POST',
    rejectOnAuthFailure: true,
    headers: { 'Content-Type': 'application/json' },
    body: { usernameOrEmail },
  });
  // A legacy endpoint's empty 200 does not establish that a request was queued.
  if (response.status !== 202) {
    throw new Error('Password recovery request was not accepted');
  }
}

export async function resetPassword(activationKey: string, newPassword: string) {
  await openmrsFetch(`${recoveryUrl}/confirm`, {
    method: 'POST',
    rejectOnAuthFailure: true,
    headers: { 'Content-Type': 'application/json' },
    body: { activationKey, newPassword },
  });
}

export function readRecoveryToken(hash: string) {
  if (!hash.startsWith('#')) return '';
  const token = new URLSearchParams(hash.replace(/^#/, '')).get('token') ?? '';
  return /^[a-zA-Z0-9]{20,128}$/.test(token) ? token : '';
}

export function recoveryErrorStatus(error: unknown): number | undefined {
  return (error as { response?: { status?: number } })?.response?.status;
}
