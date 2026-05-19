import {
  Button,
  InlineLoading,
  InlineNotification,
  PasswordInput,
  TextInput,
  Tile,
} from '@carbon/react';
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
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

import { type ConfigSchema } from '../config-schema';
import Logo from '../logo.component';

import { LanguageSwitcher } from './language-switcher.component';
import styles from './login.module.scss';

export interface LoginReferrer {
  referrer?: string;
}

type LoginErrorKey =
  | 'invalidCredentials'
  | 'serverUnavailable'
  | 'sessionEndpointNotFound';
type LoginView = 'login' | 'passwordRecovery';

// t('invalidCredentials', 'Invalid username or password')
// t('serverUnavailable', 'The authentication server is not responding. Please try again later.')
// t('sessionEndpointNotFound', 'The login service is not available at this backend address. Please contact support or try a different environment.')
const loginErrorFallbacks = {
  invalidCredentials: 'Invalid username or password',
  serverUnavailable:
    'The authentication server is not responding. Please try again later.',
  sessionEndpointNotFound:
    'The login service is not available at this backend address. Please contact support or try a different environment.',
} satisfies Record<LoginErrorKey, string>;

function getLoginErrorKey(error: unknown): LoginErrorKey {
  const session = (error as { session?: { backendUnavailable?: boolean } })
    ?.session;
  const nestedError = (error as { error?: unknown })?.error;
  const errorToInspect = nestedError ?? error;
  const status = (errorToInspect as { response?: { status?: number } })
    ?.response?.status;
  const message =
    errorToInspect instanceof Error
      ? errorToInspect.message
      : String(errorToInspect ?? '');

  if (session?.backendUnavailable) {
    return 'serverUnavailable';
  }

  if (status === 404 || /404|not found/i.test(message)) {
    return 'sessionEndpointNotFound';
  }

  if (
    status >= 500 ||
    /failed to fetch|gateway timeout|status of 0|load failed|network/i.test(
      message,
    )
  ) {
    return 'serverUnavailable';
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
  } = useConfig<ConfigSchema>();
  const isLoginEnabled = useConnectivity();
  const { t } = useTranslation();
  const { user } = useSession();
  const location = useLocation() as unknown as Omit<Location, 'state'> & {
    state: LoginReferrer;
  };
  const navigate = useNavigate();

  const [errorMessage, setErrorMessage] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [password, setPassword] = useState('');
  const [activeView, setActiveView] = useState<LoginView>('login');
  const [recoveryIdentifier, setRecoveryIdentifier] = useState('');
  const [recoverySubmitted, setRecoverySubmitted] = useState(false);
  const [username, setUsername] = useState('');
  const [showPasswordField, setShowPasswordField] = useState(false);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const recoveryInputRef = useRef<HTMLInputElement>(null);
  const usernameInputRef = useRef<HTMLInputElement>(null);
  const loginImageSrc = `${globalThis.getOpenmrsSpaBase()}login.png`;
  const sihsalusLogoSrc = `${globalThis.getOpenmrsSpaBase()}sihsalus-horizontal.svg`;
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
    if (currentUsername) {
      // If credentials were autofilled, input onChange might not have been called
      setUsername(currentUsername);
      setShowPasswordField(true);
    } else {
      usernameInputRef.current?.focus();
    }
  }, []);

  const changeUsername = useCallback(
    (evt: React.ChangeEvent<HTMLInputElement>) => setUsername(evt.target.value),
    [],
  );
  const changePassword = useCallback(
    (evt: React.ChangeEvent<HTMLInputElement>) => setPassword(evt.target.value),
    [],
  );
  const changeRecoveryIdentifier = useCallback(
    (evt: React.ChangeEvent<HTMLInputElement>) => {
      setRecoveryIdentifier(evt.target.value);
      setRecoverySubmitted(false);
    },
    [],
  );

  const openPasswordRecovery = useCallback(() => {
    setErrorMessage('');
    setRecoveryIdentifier(username.trim());
    setRecoverySubmitted(false);
    setActiveView('passwordRecovery');
  }, [username]);

  const returnToLogin = useCallback(() => {
    setActiveView('login');
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
      const currentUsername =
        usernameInputRef.current?.value?.trim() || username;
      const currentPassword = passwordInputRef.current?.value || password;

      if (showPasswordOnSeparateScreen && !showPasswordField) {
        continueLogin();
        return false;
      }

      if (!currentPassword || !currentPassword.trim()) {
        passwordInputRef.current?.focus();
        return false;
      }

      try {
        setIsLoggingIn(true);
        const sessionStore = await refetchCurrentUser(
          currentUsername,
          currentPassword,
        );
        const session = sessionStore.session;
        const authenticated = sessionStore?.session?.authenticated;

        if (authenticated) {
          if (session.sessionLocation) {
            let to = loginLinks?.loginSuccess || '/home';
            if (location?.state?.referrer) {
              if (location.state.referrer.startsWith('/')) {
                to = `\${openmrsSpaBase}${location.state.referrer}`;
              } else {
                to = location.state.referrer;
              }
            }

            openmrsNavigate({ to });
          } else {
            navigate('/login/location');
          }
        } else {
          setErrorMessage(getLoginErrorKey({ session }));
          setUsername('');
          setPassword('');
          if (showPasswordOnSeparateScreen) {
            setShowPasswordField(false);
          }
        }

        return true;
      } catch (error: unknown) {
        setErrorMessage(getLoginErrorKey(error));
        setUsername('');
        setPassword('');
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

      if (!recoveryIdentifier.trim()) {
        recoveryInputRef.current?.focus();
        return;
      }

      setRecoverySubmitted(true);
    },
    [recoveryIdentifier],
  );

  if (!loginProvider || loginProvider.type === 'basic') {
    return (
      <div
        className={containerClassName}
        style={containerStyle}
        data-testid="login-container"
      >
        <main className={styles.loginLayout}>
          <h1 className={styles.srOnly}>{t('login', 'Log in')}</h1>
          <div className={styles.imagePanel} aria-hidden="true">
            <img className={styles.loginMedia} src={loginImageSrc} alt="" />
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
                <form onSubmit={handleSubmit}>
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
                      autoFocus
                    />
                    {showPasswordOnSeparateScreen ? (
                      <>
                        <div
                          className={
                            showPasswordField
                              ? undefined
                              : styles.hiddenPasswordField
                          }
                        >
                          <PasswordInput
                            id="password"
                            labelText={t('password', 'Password')}
                            name="password"
                            autoComplete="current-password"
                            onChange={changePassword}
                            ref={passwordInputRef}
                            required
                            value={password}
                            showPasswordLabel={t(
                              'showPassword',
                              'Show password',
                            )}
                            invalidText={t(
                              'validValueRequired',
                              'A valid value is required',
                            )}
                            aria-hidden={!showPasswordField}
                            tabIndex={showPasswordField ? 0 : -1}
                          />
                        </div>
                        {showPasswordField ? (
                          <Button
                            type="submit"
                            className={styles.continueButton}
                            renderIcon={(props) => (
                              <ArrowRightIcon size={24} {...props} />
                            )}
                            iconDescription={t(
                              'loginButtonIconDescription',
                              'Log in button',
                            )}
                            disabled={!isLoginEnabled || isLoggingIn}
                          >
                            {isLoggingIn ? (
                              <InlineLoading
                                className={styles.loader}
                                description={
                                  t('loggingIn', 'Logging in') + '...'
                                }
                              />
                            ) : (
                              t('login', 'Log in')
                            )}
                          </Button>
                        ) : (
                          <Button
                            type="submit"
                            className={styles.continueButton}
                            renderIcon={(props) => (
                              <ArrowRightIcon size={24} {...props} />
                            )}
                            iconDescription={t(
                              'continueToPassword',
                              'Continue to password',
                            )}
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
                          value={password}
                          showPasswordLabel={t('showPassword', 'Show password')}
                          invalidText={t(
                            'validValueRequired',
                            'A valid value is required',
                          )}
                        />
                        <Button
                          type="submit"
                          className={styles.continueButton}
                          renderIcon={(props) => (
                            <ArrowRightIcon size={24} {...props} />
                          )}
                          iconDescription={t(
                            'loginButtonIconDescription',
                            'Log in button',
                          )}
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
                  {errorMessage && (
                    <div className={styles.errorMessage}>
                      <InlineNotification
                        kind="error"
                        subtitle={t(
                          errorMessage,
                          loginErrorFallbacks[errorMessage as LoginErrorKey],
                        )}
                        title={getCoreTranslation('error')}
                        onClick={() => setErrorMessage('')}
                      />
                    </div>
                  )}
                </form>
              ) : (
                <form
                  className={styles.recoveryForm}
                  onSubmit={handleRecoverySubmit}
                >
                  <div className={styles.recoveryHeader}>
                    <h2 className={styles.recoveryTitle}>
                      {t('recoverPassword', 'Recover password')}
                    </h2>
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
                    />
                    <Button
                      type="submit"
                      className={styles.continueButton}
                      renderIcon={(props) => (
                        <ArrowRightIcon size={24} {...props} />
                      )}
                      iconDescription={t(
                        'requestPasswordRecovery',
                        'Request password recovery',
                      )}
                    >
                      {t(
                        'requestPasswordRecovery',
                        'Request password recovery',
                      )}
                    </Button>
                  </div>
                  {recoverySubmitted && (
                    <InlineNotification
                      className={styles.recoveryNotice}
                      kind="info"
                      lowContrast
                      hideCloseButton
                      title={t(
                        'passwordRecoveryInstructionsTitle',
                        'Ask an administrator for help',
                      )}
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
              <p className={styles.partnerSubtitle}>
                {t('madeInCollaboration', 'Hecho en colaboración')}
              </p>
              <div className={styles.partnerLinks}>
                <a
                  href={globalThis.getOpenmrsSpaBase()}
                  rel="noopener noreferrer"
                  aria-label="Sihsalus"
                >
                  <img
                    src={sihsalusLogoSrc}
                    alt={t('sihsalusLogo', 'Sihsalus logo')}
                  />
                </a>
                <a
                  href="https://sanjosedelamazonas.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Santa Clotilde"
                >
                  <img
                    src={santaClotildeLogoSrc}
                    alt={t('santaClotildeLogo', 'Logo de Santa Clotilde')}
                  />
                </a>
                <a
                  className={styles.pucpLogoLink}
                  href="https://inform.pucp.edu.pe/santaclotilde/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="PUCP"
                >
                  <img
                    src={pucpLogoSrc}
                    alt={t('pucpLogo', 'Logo de la PUCP')}
                  />
                </a>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }
  return null;
};

export default Login;
