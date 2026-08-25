import { type Session } from '@openmrs/esm-framework';

import { type ConfigSchema } from '../config-schema';

const legacyPasswordChangePath = '/admin/users/changePassword.form';
const forcedPasswordSafeSpaPath = 'login/forced-password';

type AuthenticationProvider = ConfigSchema['provider']['type'];
type TopLevelNavigate = (target: string) => void;
type PasswordChangePageCheck = (target: string) => Promise<void>;
type NavigationStillAllowed = () => boolean;

let navigationCompleted = false;
let activeNavigationAttempt: Promise<boolean> | null = null;

/**
 * Mirrors OpenMRS' Boolean.parseBoolean handling for the forcePassword user
 * property. A defensive boolean value is also accepted because some session
 * adapters normalize REST properties before exposing them to the frontend.
 */
export function isForcePasswordValue(value: unknown): boolean {
  return value === true || (typeof value === 'string' && value.toLowerCase() === 'true');
}

export function requiresForcedPasswordChange(
  session: Pick<Session, 'authenticated' | 'user'>,
  providerType: AuthenticationProvider,
): boolean {
  if (!session.authenticated || providerType === 'oauth2') {
    return false;
  }

  const userProperties = session.user?.userProperties as Record<string, unknown> | null | undefined;
  return isForcePasswordValue(userProperties?.forcePassword);
}

export function getForcedPasswordSafeSpaUrl(spaBase = globalThis.getOpenmrsSpaBase()): string {
  return `${spaBase.replace(/\/+$/, '')}/${forcedPasswordSafeSpaPath}`;
}

export function isForcedPasswordSafeSpaRoute(
  pathname = globalThis.location.pathname,
  spaBase = globalThis.getOpenmrsSpaBase(),
): boolean {
  return pathname.replace(/\/+$/, '') === getForcedPasswordSafeSpaUrl(spaBase);
}

export function isForcedPasswordLogoutSpaRoute(pathname: string, spaBase = globalThis.getOpenmrsSpaBase()): boolean {
  return pathname.replace(/\/+$/, '') === `${spaBase.replace(/\/+$/, '')}/logout`;
}

/**
 * Resolves only the configured OpenMRS context path. Keeping the target as a
 * rooted path guarantees that the browser stays on the current origin even if
 * an environment accidentally supplies an absolute API base URL.
 */
export function getForcedPasswordChangeUrl(openmrsBase = globalThis.openmrsBase): string {
  const contextPath = new URL(openmrsBase, globalThis.location.origin).pathname.replace(/\/+$/, '');
  return `${contextPath}${legacyPasswordChangePath}`;
}

export async function checkForcedPasswordChangePage(target: string, cancellationSignal?: AbortSignal): Promise<void> {
  const abortController = new AbortController();
  const timeout = globalThis.setTimeout(() => abortController.abort(), 8_000);
  const cancel = () => abortController.abort();
  cancellationSignal?.addEventListener('abort', cancel, { once: true });
  if (cancellationSignal?.aborted) {
    abortController.abort();
  }

  try {
    const expectedUrl = new URL(target, globalThis.location.origin);
    if (expectedUrl.origin !== globalThis.location.origin) {
      throw new Error('The password-change page must stay on the current origin');
    }

    const response = await globalThis.fetch(target, {
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { Accept: 'text/html' },
      redirect: 'follow',
      signal: abortController.signal,
    });
    if (abortController.signal.aborted) {
      throw new DOMException('The password-change page check was cancelled', 'AbortError');
    }

    const responseUrl = new URL(response.url, globalThis.location.origin);
    if (
      !response.ok ||
      response.redirected ||
      responseUrl.origin !== expectedUrl.origin ||
      responseUrl.pathname !== expectedUrl.pathname ||
      responseUrl.search !== expectedUrl.search
    ) {
      throw new Error('The password-change page is not directly available');
    }
  } finally {
    globalThis.clearTimeout(timeout);
    cancellationSignal?.removeEventListener('abort', cancel);
  }
}

export async function startForcedPasswordChangeNavigation(
  topLevelNavigate: TopLevelNavigate = (target) => globalThis.location.assign(target),
  checkPasswordChangePage: PasswordChangePageCheck = checkForcedPasswordChangePage,
  navigationStillAllowed: NavigationStillAllowed = () => true,
): Promise<boolean> {
  if (navigationCompleted || !navigationStillAllowed()) {
    return false;
  }

  while (activeNavigationAttempt) {
    const pendingAttempt = activeNavigationAttempt;
    try {
      await pendingAttempt;
    } catch {
      // A cancelled or failed attempt releases the lock for an allowed caller.
    }
    if (navigationCompleted || !navigationStillAllowed()) {
      return false;
    }
  }

  const attempt = (async () => {
    const target = getForcedPasswordChangeUrl();
    await checkPasswordChangePage(target);
    if (!navigationStillAllowed()) {
      return false;
    }
    topLevelNavigate(target);
    navigationCompleted = true;
    return true;
  })();
  activeNavigationAttempt = attempt;

  try {
    return await attempt;
  } finally {
    if (activeNavigationAttempt === attempt) {
      activeNavigationAttempt = null;
    }
  }
}

export function __resetForcedPasswordChangeNavigationForTests(): void {
  navigationCompleted = false;
  activeNavigationAttempt = null;
}
