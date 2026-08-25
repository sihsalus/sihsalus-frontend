import { Button, InlineLoading, InlineNotification, Tile } from '@carbon/react';
import { navigate, useConfig, useConnectivity, useSession } from '@openmrs/esm-framework';
import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { type ConfigSchema } from '../config-schema';

import {
  checkForcedPasswordChangePage,
  getForcedPasswordSafeSpaUrl,
  isForcedPasswordLogoutSpaRoute,
  isForcedPasswordSafeSpaRoute,
  requiresForcedPasswordChange,
  startForcedPasswordChangeNavigation,
} from './forced-password-change';
import styles from './forced-password-change-gate.module.scss';

const ForcedPasswordChangeGate: React.FC = () => {
  const { links, provider } = useConfig<ConfigSchema>();
  const session = useSession();
  const isOnline = useConnectivity();
  const { t } = useTranslation();
  const activeNavigationAbortRef = useRef<AbortController | null>(null);
  const gateRef = useRef<HTMLElement>(null);
  const logoutInProgressRef = useRef(false);
  const routeTransitionTimerRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
  const [navigationFailed, setNavigationFailed] = useState(false);
  const [safeRouteReady, setSafeRouteReady] = useState(isForcedPasswordSafeSpaRoute);
  const changeRequired = requiresForcedPasswordChange(session, provider.type);
  const providerCannotChangeLocalPassword = provider.type === 'custom';
  const navigationAllowedRef = useRef(false);
  navigationAllowedRef.current = changeRequired && !providerCannotChangeLocalPassword && safeRouteReady && isOnline;

  const cancelActiveNavigation = useCallback(() => {
    navigationAllowedRef.current = false;
    activeNavigationAbortRef.current?.abort();
    activeNavigationAbortRef.current = null;
  }, []);

  const clearRouteTransitionTimer = useCallback(() => {
    if (routeTransitionTimerRef.current !== null) {
      globalThis.clearTimeout(routeTransitionTimerRef.current);
      routeTransitionTimerRef.current = null;
    }
  }, []);

  const waitForSafeRoute = useCallback(() => {
    clearRouteTransitionTimer();
    routeTransitionTimerRef.current = globalThis.setTimeout(() => {
      routeTransitionTimerRef.current = null;
      const reachedSafeRoute = isForcedPasswordSafeSpaRoute();
      logoutInProgressRef.current = false;
      setSafeRouteReady(reachedSafeRoute);
      setNavigationFailed(!reachedSafeRoute);
    }, 5_000);
  }, [clearRouteTransitionTimer]);

  const moveToSafeRoute = useCallback(() => {
    logoutInProgressRef.current = false;
    cancelActiveNavigation();
    setSafeRouteReady(false);
    setNavigationFailed(false);
    waitForSafeRoute();
    try {
      navigate({ to: getForcedPasswordSafeSpaUrl() });
    } catch {
      clearRouteTransitionTimer();
      setNavigationFailed(true);
    }
  }, [cancelActiveNavigation, clearRouteTransitionTimer, waitForSafeRoute]);

  const attemptPasswordChangeNavigation = useCallback(async (cancellationSignal: AbortSignal) => {
    setNavigationFailed(false);
    try {
      await startForcedPasswordChangeNavigation(
        undefined,
        (target) => checkForcedPasswordChangePage(target, cancellationSignal),
        () => navigationAllowedRef.current && !cancellationSignal.aborted && isForcedPasswordSafeSpaRoute(),
      );
    } catch {
      if (!cancellationSignal.aborted) {
        // The backend remains authoritative and denies clinical requests. Keep
        // a safe, non-technical blocking state when Legacy is unavailable.
        setNavigationFailed(true);
      }
    }
  }, []);

  useLayoutEffect(() => {
    if (!changeRequired) {
      return;
    }

    navigationAllowedRef.current = !providerCannotChangeLocalPassword && safeRouteReady && isOnline;
    gateRef.current?.focus();

    const handleRoutingComplete = () => {
      if (isForcedPasswordLogoutSpaRoute(globalThis.location.pathname)) {
        cancelActiveNavigation();
        setSafeRouteReady(false);
        clearRouteTransitionTimer();
        return;
      }

      logoutInProgressRef.current = false;
      const isSafeRoute = isForcedPasswordSafeSpaRoute();
      setSafeRouteReady(isSafeRoute);
      clearRouteTransitionTimer();
      if (isSafeRoute) {
        setNavigationFailed(false);
      } else {
        moveToSafeRoute();
      }
    };
    const preventUnsafeRouting = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          cancelNavigation?: () => void;
          newUrl?: string;
        }>
      ).detail;
      let targetUrl: URL | null = null;
      try {
        targetUrl = new URL(detail?.newUrl ?? globalThis.location.href, globalThis.location.origin);
      } catch {
        // An invalid navigation target is unsafe and is handled below.
      }

      const isSameOrigin = targetUrl?.origin === globalThis.location.origin;
      const targetPath = targetUrl?.pathname ?? '';
      if (isSameOrigin && isForcedPasswordLogoutSpaRoute(targetPath)) {
        logoutInProgressRef.current = true;
        cancelActiveNavigation();
        setSafeRouteReady(false);
        waitForSafeRoute();
        return;
      }

      if (!isSameOrigin || !isForcedPasswordSafeSpaRoute(targetPath)) {
        logoutInProgressRef.current = false;
        cancelActiveNavigation();
        setSafeRouteReady(false);
        setNavigationFailed(false);
        waitForSafeRoute();
        if (detail?.cancelNavigation) {
          try {
            detail.cancelNavigation();
          } catch {
            moveToSafeRoute();
          }
        } else {
          moveToSafeRoute();
        }
      }
    };

    window.addEventListener('single-spa:before-routing-event', preventUnsafeRouting);
    window.addEventListener('single-spa:routing-event', handleRoutingComplete);
    if (!isForcedPasswordSafeSpaRoute()) {
      moveToSafeRoute();
    } else if (!safeRouteReady && !logoutInProgressRef.current) {
      // single-spa restores the previous URL silently when a navigation is
      // cancelled. Reconcile from the actual URL so Back cannot leave the gate
      // waiting forever for a routing-event that will not be emitted.
      clearRouteTransitionTimer();
      setSafeRouteReady(true);
    }

    return () => {
      window.removeEventListener('single-spa:before-routing-event', preventUnsafeRouting);
      window.removeEventListener('single-spa:routing-event', handleRoutingComplete);
      cancelActiveNavigation();
    };
  }, [
    cancelActiveNavigation,
    changeRequired,
    clearRouteTransitionTimer,
    isOnline,
    moveToSafeRoute,
    providerCannotChangeLocalPassword,
    safeRouteReady,
    waitForSafeRoute,
  ]);

  useLayoutEffect(() => {
    if (changeRequired || !isForcedPasswordSafeSpaRoute()) {
      return;
    }

    const target = session.authenticated
      ? session.sessionLocation
        ? links?.loginSuccess || `${globalThis.getOpenmrsSpaBase()}home`
        : `${globalThis.getOpenmrsSpaBase()}login/location`
      : `${globalThis.getOpenmrsSpaBase()}login`;
    navigate({ to: target });
  }, [changeRequired, links?.loginSuccess, session.authenticated, session.sessionLocation]);

  useLayoutEffect(() => {
    if (!changeRequired || providerCannotChangeLocalPassword || !safeRouteReady || !isOnline) {
      return;
    }

    const abortController = new AbortController();
    activeNavigationAbortRef.current = abortController;
    void attemptPasswordChangeNavigation(abortController.signal);

    return () => {
      abortController.abort();
      if (activeNavigationAbortRef.current === abortController) {
        activeNavigationAbortRef.current = null;
      }
    };
  }, [attemptPasswordChangeNavigation, changeRequired, isOnline, providerCannotChangeLocalPassword, safeRouteReady]);

  useLayoutEffect(
    () => () => {
      cancelActiveNavigation();
      clearRouteTransitionTimer();
    },
    [cancelActiveNavigation, clearRouteTransitionTimer],
  );

  if (!changeRequired) {
    return null;
  }

  const isBlocked = !isOnline || navigationFailed || providerCannotChangeLocalPassword;
  const title = isOnline
    ? t('forcedPasswordChangeRequired', 'You must change your password')
    : t('forcedPasswordChangeOffline', 'Connect to change your password');
  const detail = providerCannotChangeLocalPassword
    ? t(
        'forcedPasswordChangeCustomProviderDetail',
        'This account is marked for a local password change, but the configured login provider cannot complete it. Log out and ask an administrator for help.',
      )
    : isOnline
      ? t(
          'forcedPasswordChangeRequiredDetail',
          'OpenMRS will open the secure password change screen before you can continue.',
        )
      : t(
          'forcedPasswordChangeOfflineDetail',
          'The required password change needs a network connection. You cannot use SIHSALUS until it is complete.',
        );

  return (
    <main
      ref={gateRef}
      className={styles.overlay}
      aria-labelledby="forced-password-change-title"
      aria-live="assertive"
      tabIndex={-1}
    >
      <Tile className={styles.card}>
        <h1 id="forced-password-change-title" className={styles.title}>
          {title}
        </h1>
        <p className={styles.detail}>{detail}</p>
        {isBlocked ? (
          <>
            {(navigationFailed || providerCannotChangeLocalPassword) && (
              <>
                <InlineNotification
                  className={styles.notification}
                  kind="error"
                  hideCloseButton
                  lowContrast
                  title={
                    providerCannotChangeLocalPassword
                      ? t('forcedPasswordChangeNeedsAdmin', 'Administrator assistance is required')
                      : t('forcedPasswordChangeUnavailable', 'Password change could not be opened')
                  }
                  subtitle={
                    providerCannotChangeLocalPassword
                      ? undefined
                      : t(
                          'forcedPasswordChangeUnavailableDetail',
                          'Try again after checking the connection, or ask an administrator for help.',
                        )
                  }
                />
                {!providerCannotChangeLocalPassword && isOnline && (
                  <Button
                    className={styles.retryButton}
                    onClick={() => {
                      if (safeRouteReady) {
                        const abortController = new AbortController();
                        cancelActiveNavigation();
                        activeNavigationAbortRef.current = abortController;
                        navigationAllowedRef.current =
                          changeRequired && !providerCannotChangeLocalPassword && safeRouteReady && isOnline;
                        void attemptPasswordChangeNavigation(abortController.signal);
                      } else {
                        moveToSafeRoute();
                      }
                    }}
                  >
                    {t('retryPasswordChange', 'Try again')}
                  </Button>
                )}
              </>
            )}
            <Button
              className={styles.logoutButton}
              kind={navigationFailed ? 'tertiary' : 'secondary'}
              onClick={() => {
                cancelActiveNavigation();
                navigate({ to: `${globalThis.getOpenmrsSpaBase()}logout` });
              }}
            >
              {t('logout', 'Logout')}
            </Button>
          </>
        ) : (
          <InlineLoading
            className={styles.loading}
            description={t('openingPasswordChange', 'Opening password change') + '...'}
          />
        )}
      </Tile>
    </main>
  );
};

export default ForcedPasswordChangeGate;
