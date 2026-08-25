import {
  __resetForcedPasswordChangeNavigationForTests,
  checkForcedPasswordChangePage,
  getForcedPasswordChangeUrl,
  getForcedPasswordSafeSpaUrl,
  isForcedPasswordLogoutSpaRoute,
  isForcedPasswordSafeSpaRoute,
  isForcePasswordValue,
  requiresForcedPasswordChange,
  startForcedPasswordChangeNavigation,
} from './forced-password-change';

function sessionWithForcePassword(value: unknown, authenticated = true) {
  return {
    authenticated,
    user: {
      userProperties: value === undefined ? {} : { forcePassword: value },
    },
  } as never;
}

describe('forced password change contract', () => {
  beforeEach(() => {
    __resetForcedPasswordChangeNavigationForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it.each([true, 'true', 'TRUE'])('accepts the OpenMRS true value %j', (value) => {
    expect(isForcePasswordValue(value)).toBe(true);
    expect(requiresForcedPasswordChange(sessionWithForcePassword(value), 'basic')).toBe(true);
  });

  it.each([false, 'false', ' TRUE ', '1', undefined, null])('rejects the non-OpenMRS true value %j', (value) => {
    expect(isForcePasswordValue(value)).toBe(false);
    expect(requiresForcedPasswordChange(sessionWithForcePassword(value), 'basic')).toBe(false);
  });

  it('requires an authenticated basic-provider session', () => {
    expect(requiresForcedPasswordChange(sessionWithForcePassword('true', false), 'basic')).toBe(false);
    expect(requiresForcedPasswordChange(sessionWithForcePassword('true'), 'oauth2')).toBe(false);
    expect(requiresForcedPasswordChange(sessionWithForcePassword('true'), 'custom')).toBe(true);
  });

  it('uses an isolated SPA route before opening Legacy', () => {
    expect(getForcedPasswordSafeSpaUrl('/openmrs/spa/')).toBe('/openmrs/spa/login/forced-password');
    expect(isForcedPasswordSafeSpaRoute('/openmrs/spa/login/forced-password/', '/openmrs/spa/')).toBe(true);
    expect(isForcedPasswordSafeSpaRoute('/openmrs/spa/patient/synthetic/chart', '/openmrs/spa/')).toBe(false);
    expect(isForcedPasswordLogoutSpaRoute('/openmrs/spa/logout/', '/openmrs/spa/')).toBe(true);
  });

  it('builds a rooted same-origin Legacy URL from the configured OpenMRS context path', () => {
    expect(getForcedPasswordChangeUrl('/openmrs/')).toBe('/openmrs/admin/users/changePassword.form');
    expect(getForcedPasswordChangeUrl('https://backend.example.test/nested/openmrs/')).toBe(
      '/nested/openmrs/admin/users/changePassword.form',
    );
  });

  it('checks reachability and starts only one top-level navigation', async () => {
    const topLevelNavigate = vi.fn();
    const checkPasswordChangePage = vi.fn().mockResolvedValue(undefined);

    await expect(startForcedPasswordChangeNavigation(topLevelNavigate, checkPasswordChangePage)).resolves.toBe(true);
    await expect(startForcedPasswordChangeNavigation(topLevelNavigate, checkPasswordChangePage)).resolves.toBe(false);
    expect(checkPasswordChangePage).toHaveBeenCalledTimes(1);
    expect(topLevelNavigate).toHaveBeenCalledTimes(1);
    expect(topLevelNavigate).toHaveBeenCalledWith('/openmrs/admin/users/changePassword.form');
  });

  it('allows a later retry when the destination check fails', async () => {
    await expect(
      startForcedPasswordChangeNavigation(vi.fn(), async () => {
        throw new Error('destination unavailable');
      }),
    ).rejects.toThrow('destination unavailable');

    const retry = vi.fn();
    await expect(startForcedPasswordChangeNavigation(retry, async () => undefined)).resolves.toBe(true);
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('does not navigate after the session gate invalidates an in-flight check', async () => {
    const topLevelNavigate = vi.fn();
    let navigationAllowed = true;

    await expect(
      startForcedPasswordChangeNavigation(
        topLevelNavigate,
        async () => {
          navigationAllowed = false;
        },
        () => navigationAllowed,
      ),
    ).resolves.toBe(false);
    expect(topLevelNavigate).not.toHaveBeenCalled();

    navigationAllowed = true;
    await expect(startForcedPasswordChangeNavigation(topLevelNavigate, async () => undefined)).resolves.toBe(true);
    expect(topLevelNavigate).toHaveBeenCalledOnce();
  });

  it('does not probe Legacy when navigation is already disallowed', async () => {
    const checkPasswordChangePage = vi.fn();
    const topLevelNavigate = vi.fn();

    await expect(
      startForcedPasswordChangeNavigation(topLevelNavigate, checkPasswordChangePage, () => false),
    ).resolves.toBe(false);
    expect(checkPasswordChangePage).not.toHaveBeenCalled();
    expect(topLevelNavigate).not.toHaveBeenCalled();
  });

  it('releases the navigation lock when top-level navigation throws', async () => {
    await expect(
      startForcedPasswordChangeNavigation(
        () => {
          throw new Error('synthetic location.assign failure');
        },
        async () => undefined,
      ),
    ).rejects.toThrow('synthetic location.assign failure');

    const retry = vi.fn();
    await expect(startForcedPasswordChangeNavigation(retry, async () => undefined)).resolves.toBe(true);
    expect(retry).toHaveBeenCalledOnce();
  });

  it('queues a replacement attempt until a cancelled check releases the lock', async () => {
    let rejectFirstCheck: ((reason: unknown) => void) | undefined;
    const firstAttempt = startForcedPasswordChangeNavigation(
      vi.fn(),
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectFirstCheck = reject;
        }),
    );
    const replacementNavigation = vi.fn();
    const replacementAttempt = startForcedPasswordChangeNavigation(replacementNavigation, async () => undefined);
    const firstExpectation = expect(firstAttempt).rejects.toMatchObject({ name: 'AbortError' });

    rejectFirstCheck?.(new DOMException('cancelled', 'AbortError'));

    await firstExpectation;
    await expect(replacementAttempt).resolves.toBe(true);
    expect(replacementNavigation).toHaveBeenCalledOnce();
  });

  it('accepts only a direct successful response from the same Legacy path', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        redirected: false,
        url: `${globalThis.location.origin}/openmrs/admin/users/changePassword.form`,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        redirected: true,
        url: `${globalThis.location.origin}/openmrs/login.htm`,
      } as Response);

    await expect(checkForcedPasswordChangePage('/openmrs/admin/users/changePassword.form')).resolves.toBeUndefined();
    await expect(checkForcedPasswordChangePage('/openmrs/admin/users/changePassword.form')).rejects.toThrow(
      /not directly available/i,
    );
    expect(fetchMock).toHaveBeenCalledWith(
      '/openmrs/admin/users/changePassword.form',
      expect.objectContaining({ cache: 'no-store', credentials: 'same-origin', redirect: 'follow' }),
    );
  });

  it('rejects a cross-origin response even when it claims the expected path without a redirect', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      redirected: false,
      url: 'https://malicious.example/openmrs/admin/users/changePassword.form',
    } as Response);

    await expect(checkForcedPasswordChangePage('/openmrs/admin/users/changePassword.form')).rejects.toThrow(
      /not directly available/i,
    );
  });

  it('rejects a cross-origin check target before making a request', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    await expect(
      checkForcedPasswordChangePage('https://malicious.example/openmrs/admin/users/changePassword.form'),
    ).rejects.toThrow(/current origin/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('propagates cancellation to the page check and removes its listener', async () => {
    const cancellation = new AbortController();
    const removeEventListener = vi.spyOn(cancellation.signal, 'removeEventListener');
    let fetchSignal: AbortSignal | undefined;
    vi.spyOn(globalThis, 'fetch').mockImplementation((_input, init) => {
      fetchSignal = init?.signal as AbortSignal;
      return new Promise<Response>((_resolve, reject) => {
        fetchSignal?.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')), {
          once: true,
        });
      });
    });

    const pageCheck = checkForcedPasswordChangePage('/openmrs/admin/users/changePassword.form', cancellation.signal);
    const rejection = expect(pageCheck).rejects.toMatchObject({ name: 'AbortError' });
    cancellation.abort();

    await rejection;
    expect(fetchSignal?.aborted).toBe(true);
    expect(removeEventListener).toHaveBeenCalledWith('abort', expect.any(Function));
  });

  it('fails a page check when its isolation timeout expires even if fetch resolves afterward', async () => {
    vi.useFakeTimers();
    let resolveFetch: ((response: Response) => void) | undefined;
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    const pageCheck = checkForcedPasswordChangePage('/openmrs/admin/users/changePassword.form');
    const rejection = expect(pageCheck).rejects.toMatchObject({ name: 'AbortError' });
    vi.advanceTimersByTime(8_000);
    resolveFetch?.({
      ok: true,
      redirected: false,
      url: `${globalThis.location.origin}/openmrs/admin/users/changePassword.form`,
    } as Response);

    await rejection;
  });
});
