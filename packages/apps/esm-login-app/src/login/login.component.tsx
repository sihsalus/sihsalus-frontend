import { Button, InlineLoading, InlineNotification, PasswordInput, TextInput, Tile } from '@carbon/react';
import {
  ArrowRightIcon,
  getCoreTranslation,
  interpolateUrl,
  navigate as openmrsNavigate,
  refetchCurrentUser,
  useConfig,
  useConnectivity,
  useSession,
} from '@openmrs/esm-framework';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

import { type ConfigSchema } from '../config-schema';
import { LoginArtwork } from '../login-artwork.component';
import Logo from '../logo.component';
import { buildSpaNavigationTarget, hardNavigate } from '../navigation';

import { LanguageSwitcher } from './language-switcher.component';
import styles from './login.module.scss';

export interface LoginReferrer {
  referrer?: string;
}

type LoginErrorKey = 'invalidCredentials' | 'accountLocked' | 'serverUnavailable' | 'sessionEndpointNotFound';
type LoginView = 'login' | 'passwordRecovery';

interface BuildInfo {
  version: string;
  gitSha: string;
  buildTime?: string;
}

/**
 * Reads the deployed build provenance from `<spaBase>/build-info.json`, which CI
 * stamps at image build time (see assemble-importmap.js / Dockerfile). Best-effort:
 * returns empty values when the file is absent (e.g. local dev) so the UI just
 * hides the version line instead of erroring.
 */
function useBuildInfo(): BuildInfo {
  const [buildInfo, setBuildInfo] = useState<BuildInfo>({ version: '', gitSha: '' });

  useEffect(() => {
    let active = true;
    const spaBase = typeof globalThis.getOpenmrsSpaBase === 'function' ? globalThis.getOpenmrsSpaBase() : '/';

    fetch(`${spaBase}build-info.json`, { headers: { Accept: 'application/json' } })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data && typeof data.version === 'string') {
          setBuildInfo({ version: data.version, gitSha: data.gitSha ?? '', buildTime: data.buildTime });
        }
      })
      .catch(() => {
        // build-info.json is optional; ignore fetch/parse errors.
      });

    return () => {
      active = false;
    };
  }, []);

  return buildInfo;
}

// t('invalidCredentials', 'Invalid username or password')
// t('accountLocked', 'Account temporarily locked')
// t('accountLockedDetail', 'Your account was locked after several failed attempts. Wait about {{minutes}} minutes and try again, or ask an administrator to unlock it.')
// t('serverUnavailable', 'The authentication server is not responding. Please try again later.')
// t('sessionEndpointNotFound', 'The login service is not available at this backend address. Please contact support or try a different environment.')
const loginErrorFallbacks = {
  invalidCredentials: 'Invalid username or password',
  accountLocked: 'Account temporarily locked',
  serverUnavailable: 'The authentication server is not responding. Please try again later.',
  sessionEndpointNotFound:
    'The login service is not available at this backend address. Please contact support or try a different environment.',
} satisfies Record<LoginErrorKey, string>;

/**
 * OpenMRS core locks an account after `security.allowedFailedLoginsBeforeLockout`
 * failed attempts (default 7) and throws a distinct ContextAuthenticationException
 * ("Invalid number of connection attempts. Please try again later.") while the
 * lockout window (`security.unlockAccountAfter`, default 5 min) is active. That
 * message rides in the body of the openmrsFetch error; its exact field varies, so
 * we probe the common shapes.
 */
function getServerErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return typeof error === 'string' ? error : '';
  }
  const candidate = error as {
    message?: unknown;
    responseBody?: { error?: { message?: unknown }; message?: unknown };
    response?: { statusText?: unknown };
  };
  const parts = [
    candidate.responseBody?.error?.message,
    candidate.responseBody?.message,
    candidate.message,
    candidate.response?.statusText,
  ];
  return parts.filter((part) => typeof part === 'string').join(' ');
}

// Matches the OpenMRS lockout message across versions/locales without matching the
// generic "invalid username or password". Deliberately narrow: keys on the
// "connection attempts"/"try again later"/"locked" phrasing, not on "invalid".
const accountLockedPattern =
  /number of connection attempts|too many .*attempts|account .*lock|locked|try again later|intentos de conexi[oó]n|cuenta .*bloque|bloque/i;

function getLoginErrorKey(error: unknown): LoginErrorKey {
  const session = (error as { session?: { backendUnavailable?: boolean } })?.session;
  const nestedError = (error as { error?: unknown })?.error;
  const errorToInspect = nestedError ?? error;
  const status = (errorToInspect as { response?: { status?: number } })?.response?.status;
  const message = errorToInspect instanceof Error ? errorToInspect.message : String(errorToInspect ?? '');
  const serverMessage = getServerErrorMessage(errorToInspect);

  if (session?.backendUnavailable) {
    return 'serverUnavailable';
  }

  if (status === 404 || /404|not found/i.test(message)) {
    return 'sessionEndpointNotFound';
  }

  if (status >= 500 || /failed to fetch|gateway timeout|status of 0|load failed|network/i.test(message)) {
    return 'serverUnavailable';
  }

  // A locked account is a 401 like bad credentials, so it can only be told apart
  // by the backend message; check it before falling through to invalidCredentials.
  if (accountLockedPattern.test(serverMessage)) {
    return 'accountLocked';
  }

  return 'invalidCredentials';
}

const Login: React.FC = () => {
  const {
    announcements = [],
    background = { image: '', color: '' },
    languageSwitcher,
    showPasswordOnSeparateScreen,
    provider: loginProvider,
    links: loginLinks,
    accountLockout,
  } = useConfig<ConfigSchema>();
  const isLoginEnabled = useConnectivity();
  const { t } = useTranslation();
  const { user } = useSession();
  const buildInfo = useBuildInfo();
  const location = useLocation() as unknown as Omit<Location, 'state'> & {
    state: LoginReferrer;
  };
  const navigate = useNavigate();

  const [errorMessage, setErrorMessage] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordInvalid, setPasswordInvalid] = useState(false);
  const [activeView, setActiveView] = useState<LoginView>('login');
  const [recoveryIdentifier, setRecoveryIdentifier] = useState('');
  const [recoveryIdentifierInvalid, setRecoveryIdentifierInvalid] = useState(false);
  const [recoverySubmitted, setRecoverySubmitted] = useState(false);
  const [username, setUsername] = useState('');
  const [usernameInvalid, setUsernameInvalid] = useState(false);
  const [showPasswordField, setShowPasswordField] = useState(false);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const recoveryInputRef = useRef<HTMLInputElement>(null);
  const usernameInputRef = useRef<HTMLInputElement>(null);
  const openmrsLogoSrc = `${globalThis.getOpenmrsSpaBase()}logos/logo-openmrs.svg`;
  const pucpLogoSrc = `${globalThis.getOpenmrsSpaBase()}logos/logo-pucp.svg`;
  const santaClotildeLogoSrc = `${globalThis.getOpenmrsSpaBase()}logos/logo-santa-clotilde.png`;

  useEffect(() => {
    if (!user) {
      if (loginProvider.type === 'oauth2' || loginProvider.type === 'custom') {
        openmrsNavigate({ to: loginProvider.loginUrl });
      } else if (!username && location.pathname === '/login/confirm') {
        navigate('/login');
      }
    }
  }, [username, navigate, location, user, loginProvider]);

  useEffect(() => {
    if (showPasswordOnSeparateScreen) {
      if (showPasswordField) {
        if (!passwordInputRef.current?.value) {
          passwordInputRef.current?.focus();
        }
      } else {
        usernameInputRef.current?.focus();
      }
    }
  }, [showPasswordField, showPasswordOnSeparateScreen]);

  useEffect(() => {
    if (activeView === 'passwordRecovery') {
      recoveryInputRef.current?.focus();
    }
  }, [activeView]);

  const continueLogin = useCallback(() => {
    const currentUsername = usernameInputRef.current?.value?.trim();
    const isInvalid = !currentUsername;
    setUsernameInvalid(isInvalid);

    if (currentUsername) {
      // If credentials were autofilled, input onChange might not have been called
      setUsername(currentUsername);
      setShowPasswordField(true);
    } else {
      usernameInputRef.current?.focus();
    }
  }, []);

  const changeUsername = useCallback((evt: React.ChangeEvent<HTMLInputElement>) => {
    setUsername(evt.target.value);
    if (evt.target.value.trim()) {
      setUsernameInvalid(false);
    }
  }, []);
  const changePassword = useCallback((evt: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(evt.target.value);
    if (evt.target.value.trim()) {
      setPasswordInvalid(false);
    }
  }, []);
  const changeRecoveryIdentifier = useCallback((evt: React.ChangeEvent<HTMLInputElement>) => {
    setRecoveryIdentifier(evt.target.value);
    if (evt.target.value.trim()) {
      setRecoveryIdentifierInvalid(false);
    }
    setRecoverySubmitted(false);
  }, []);

  const openPasswordRecovery = useCallback(() => {
    setErrorMessage('');
    setRecoveryIdentifier(username.trim());
    setRecoveryIdentifierInvalid(false);
    setRecoverySubmitted(false);
    setActiveView('passwordRecovery');
  }, [username]);

  const returnToLogin = useCallback(() => {
    setActiveView('login');
    setRecoveryIdentifierInvalid(false);
    setRecoverySubmitted(false);
    setTimeout(() => usernameInputRef.current?.focus(), 0);
  }, []);

  const containerClassName = [
    styles.container,
    background.image ? styles.containerWithImage : '',
    !background.image && background.color ? styles.containerWithColor : '',
  ]
    .filter(Boolean)
    .join(' ');

  const containerStyle = useMemo<React.CSSProperties | undefined>(() => {
    if (background.image) {
      return {
        '--login-bg-image': `url(${interpolateUrl(background.image)})`,
      } as React.CSSProperties;
    }
    if (background.color) {
      return { '--login-bg-color': background.color } as React.CSSProperties;
    }
    return undefined;
  }, [background]);

  const handleSubmit = useCallback(
    async (evt: React.FormEvent<HTMLFormElement>) => {
      evt.preventDefault();
      evt.stopPropagation();

      // If credentials were autofilled, input onChange might not have been called
      const currentUsername = (usernameInputRef.current?.value || username).trim();
      const currentPassword = passwordInputRef.current?.value || password;
      const isUsernameInvalid = !currentUsername;

      setUsernameInvalid(isUsernameInvalid);
      if (isUsernameInvalid) {
        usernameInputRef.current?.focus();
        return false;
      }

      if (showPasswordOnSeparateScreen && !showPasswordField) {
        continueLogin();
        return false;
      }

      const isPasswordInvalid = !currentPassword || !currentPassword.trim();
      setPasswordInvalid(isPasswordInvalid);
      if (isPasswordInvalid) {
        passwordInputRef.current?.focus();
        return false;
      }

      try {
        setIsLoggingIn(true);
        const sessionStore = await refetchCurrentUser(currentUsername, currentPassword);
        const session = sessionStore.session;
        const authenticated = sessionStore?.session?.authenticated;

        if (authenticated) {
          if (session.sessionLocation) {
            let to = loginLinks?.loginSuccess || '/home';
            if (location?.state?.referrer) {
              if (location.state.referrer.startsWith('/')) {
                to = buildSpaNavigationTarget(location.state.referrer);
              } else {
                to = location.state.referrer;
              }
            }

            hardNavigate(to);
          } else {
            navigate('/login/location', { state: location.state });
          }
        } else {
          setErrorMessage(getLoginErrorKey({ session }));
          setUsername('');
          setPassword('');
          setUsernameInvalid(false);
          setPasswordInvalid(false);
          if (showPasswordOnSeparateScreen) {
            setShowPasswordField(false);
          }
        }

        return true;
      } catch (error: unknown) {
        setErrorMessage(getLoginErrorKey(error));
        setUsername('');
        setPassword('');
        setUsernameInvalid(false);
        setPasswordInvalid(false);
        if (showPasswordOnSeparateScreen) {
          setShowPasswordField(false);
        }
      } finally {
        setIsLoggingIn(false);
      }
    },
    [
      username,
      password,
      navigate,
      showPasswordOnSeparateScreen,
      showPasswordField,
      loginLinks,
      location,
      continueLogin,
    ],
  );

  const handleRecoverySubmit = useCallback(
    (evt: React.FormEvent<HTMLFormElement>) => {
      evt.preventDefault();

      const isInvalid = !recoveryIdentifier.trim();
      setRecoveryIdentifierInvalid(isInvalid);
      if (isInvalid) {
        recoveryInputRef.current?.focus();
        return;
      }

      setRecoverySubmitted(true);
    },
    [recoveryIdentifier],
  );

  if (!loginProvider || loginProvider.type === 'basic') {
    return (
      <div className={containerClassName} style={containerStyle} data-testid="login-container">
        <main className={styles.loginLayout}>
          <h1 className={styles.srOnly}>{t('login', 'Log in')}</h1>
          <div className={styles.imagePanel} aria-hidden="true">
            <LoginArtwork imageClassName={styles.loginMedia} />
          </div>
          <div className={styles.formPanel}>
            <LanguageSwitcher locales={languageSwitcher.locales} />
            {announcements.length > 0 && (
              <div className={styles.announcements}>
                {announcements.map((announcement, index) => (
                  <InlineNotification
                    key={`${announcement.kind}-${announcement.title}-${announcement.text}-${index}`}
                    kind={announcement.kind}
                    title={announcement.title ? t(announcement.title) : ''}
                    subtitle={t(announcement.text)}
                    lowContrast
                    hideCloseButton
                  />
                ))}
              </div>
            )}
            <Tile className={styles.loginCard}>
              <div className={styles.center}>
                <Logo t={t} />
              </div>
              {activeView === 'login' ? (
                <form onSubmit={handleSubmit} noValidate>
                  <div className={styles.inputGroup}>
                    <TextInput
                      id="username"
                      type="text"
                      name="username"
                      autoComplete="username"
                      labelText={t('username', 'Username')}
                      value={username}
                      onChange={changeUsername}
                      ref={usernameInputRef}
                      required
                      invalid={usernameInvalid}
                      invalidText={t('validValueRequired', 'A valid value is required')}
                      autoFocus
                    />
                    {showPasswordOnSeparateScreen ? (
                      <>
                        <div className={showPasswordField ? undefined : styles.hiddenPasswordField}>
                          <PasswordInput
                            id="password"
                            labelText={t('password', 'Password')}
                            name="password"
                            autoComplete="current-password"
                            onChange={changePassword}
                            ref={passwordInputRef}
                            required
                            invalid={showPasswordField && passwordInvalid}
                            value={password}
                            showPasswordLabel={t('showPassword', 'Show password')}
                            invalidText={t('validValueRequired', 'A valid value is required')}
                            aria-hidden={!showPasswordField}
                            tabIndex={showPasswordField ? 0 : -1}
                          />
                        </div>
                        {showPasswordField ? (
                          <Button
                            type="submit"
                            className={styles.continueButton}
                            renderIcon={(props) => <ArrowRightIcon size={24} {...props} />}
                            iconDescription={t('loginButtonIconDescription', 'Log in button')}
                            disabled={!isLoginEnabled || isLoggingIn}
                          >
                            {isLoggingIn ? (
                              <InlineLoading
                                className={styles.loader}
                                description={t('loggingIn', 'Logging in') + '...'}
                              />
                            ) : (
                              t('login', 'Log in')
                            )}
                          </Button>
                        ) : (
                          <Button
                            type="submit"
                            className={styles.continueButton}
                            renderIcon={(props) => <ArrowRightIcon size={24} {...props} />}
                            iconDescription={t('continueToPassword', 'Continue to password')}
                            onClick={(evt) => {
                              evt.preventDefault();
                              continueLogin();
                            }}
                            disabled={!isLoginEnabled}
                          >
                            {t('continue', 'Continue')}
                          </Button>
                        )}
                      </>
                    ) : (
                      <>
                        <PasswordInput
                          id="password"
                          labelText={t('password', 'Password')}
                          name="password"
                          autoComplete="current-password"
                          onChange={changePassword}
                          ref={passwordInputRef}
                          required
                          invalid={passwordInvalid}
                          value={password}
                          showPasswordLabel={t('showPassword', 'Show password')}
                          invalidText={t('validValueRequired', 'A valid value is required')}
                        />
                        <Button
                          type="submit"
                          className={styles.continueButton}
                          renderIcon={(props) => <ArrowRightIcon size={24} {...props} />}
                          iconDescription={t('loginButtonIconDescription', 'Log in button')}
                          disabled={!isLoginEnabled || isLoggingIn}
                        >
                          {isLoggingIn ? (
                            <InlineLoading
                              className={styles.loader}
                              description={t('loggingIn', 'Logging in') + '...'}
                            />
                          ) : (
                            t('login', 'Log in')
                          )}
                        </Button>
                      </>
                    )}
                  </div>
                  <Button
                    type="button"
                    kind="ghost"
                    size="sm"
                    className={styles.recoveryLinkButton}
                    onClick={openPasswordRecovery}
                  >
                    {t('forgotPassword', 'Forgot your password?')}
                  </Button>
                  {errorMessage &&
                    (errorMessage === 'accountLocked' ? (
                      <div className={styles.errorMessage}>
                        <InlineNotification
                          kind="warning"
                          subtitle={t(
                            'accountLockedDetail',
                            'Your account was locked after several failed attempts. Wait about {{minutes}} minutes and try again, or ask an administrator to unlock it.',
                            { minutes: accountLockout.retryAfterMinutes },
                          )}
                          title={t('accountLocked', 'Account temporarily locked')}
                          onClick={() => setErrorMessage('')}
                        />
                      </div>
                    ) : (
                      <div className={styles.errorMessage}>
                        <InlineNotification
                          kind="error"
                          subtitle={t(errorMessage, loginErrorFallbacks[errorMessage as LoginErrorKey])}
                          title={getCoreTranslation('error')}
                          onClick={() => setErrorMessage('')}
                        />
                      </div>
                    ))}
                </form>
              ) : (
                <form className={styles.recoveryForm} onSubmit={handleRecoverySubmit} noValidate>
                  <div className={styles.recoveryHeader}>
                    <h2 className={styles.recoveryTitle}>{t('recoverPassword', 'Recover password')}</h2>
                    <p className={styles.recoveryDescription}>
                      {t(
                        'recoverPasswordHelp',
                        'Enter your username so the facility administrator can identify your account and reset your password.',
                      )}
                    </p>
                  </div>
                  <div className={styles.inputGroup}>
                    <TextInput
                      id="password-recovery-identifier"
                      type="text"
                      name="password-recovery-identifier"
                      autoComplete="username"
                      labelText={t('passwordRecoveryUsername', 'Username')}
                      value={recoveryIdentifier}
                      onChange={changeRecoveryIdentifier}
                      ref={recoveryInputRef}
                      required
                      invalid={recoveryIdentifierInvalid}
                      invalidText={t('validValueRequired', 'A valid value is required')}
                    />
                    <Button
                      type="submit"
                      className={styles.continueButton}
                      renderIcon={(props) => <ArrowRightIcon size={24} {...props} />}
                      iconDescription={t('requestPasswordRecovery', 'Request password recovery')}
                    >
                      {t('requestPasswordRecovery', 'Request password recovery')}
                    </Button>
                  </div>
                  {recoverySubmitted && (
                    <InlineNotification
                      className={styles.recoveryNotice}
                      kind="info"
                      lowContrast
                      hideCloseButton
                      title={t('passwordRecoveryInstructionsTitle', 'Ask an administrator for help')}
                      subtitle={t(
                        'passwordRecoveryInstructions',
                        'Ask the facility administrator to reset the password for {{username}}. Then return here and log in with the new password.',
                        { username: recoveryIdentifier.trim() },
                      )}
                    />
                  )}
                  <Button
                    type="button"
                    kind="ghost"
                    size="sm"
                    className={styles.recoveryBackButton}
                    onClick={returnToLogin}
                  >
                    {t('backToLogin', 'Back to log in')}
                  </Button>
                </form>
              )}
            </Tile>
            <div className={styles.partnerSection}>
              <p className={styles.partnerSubtitle}>{t('madeInCollaboration', 'Hecho en colaboración')}</p>
              <div className={styles.partnerLinks}>
                <a href={globalThis.getOpenmrsSpaBase()} rel="noopener noreferrer" aria-label="OpenMRS">
                  <img src={openmrsLogoSrc} alt={t('openmrsLogo', 'OpenMRS logo')} />
                </a>
                <a
                  href="https://sanjosedelamazonas.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Santa Clotilde"
                >
                  <img src={santaClotildeLogoSrc} alt={t('santaClotildeLogo', 'Logo de Santa Clotilde')} />
                </a>
                <a
                  className={styles.pucpLogoLink}
                  href="https://inform.pucp.edu.pe/santaclotilde/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="PUCP"
                >
                  <img src={pucpLogoSrc} alt={t('pucpLogo', 'Logo de la PUCP')} />
                </a>
              </div>
              {buildInfo.version ? (
                <p className={styles.frontendVersion}>
                  {t('frontendVersion', 'v{{version}}', { version: buildInfo.version })}
                  {buildInfo.gitSha ? ` · ${buildInfo.gitSha}` : ''}
                </p>
              ) : null}
            </div>
          </div>
        </main>
      </div>
    );
  }
  return null;
};

export default Login;
