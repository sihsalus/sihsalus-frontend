import { Button, Form, InlineNotification, PasswordInput, Tile } from '@carbon/react';
import { useConnectivity, useSession } from '@openmrs/esm-framework';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import Logo from '../logo.component';
import styles from './reset-password.scss';
import { readRecoveryToken, recoveryErrorStatus, resetPassword } from './password-recovery.resource';

export default function ResetPassword() {
  const { t } = useTranslation();
  const session = useSession();
  const online = useConnectivity();
  const [token, setToken] = useState(() => readRecoveryToken(globalThis.location.hash));
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<'required' | 'mismatch' | 'invalid' | 'policy' | 'unavailable' | null>(null);
  const submitting = useRef(false);

  useEffect(() => {
    // Keep the bearer key in component memory only, never URL history or storage.
    globalThis.history.replaceState(
      globalThis.history.state,
      '',
      globalThis.location.pathname + globalThis.location.search,
    );
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || !online || !token || session.authenticated || saved) return;
    if (!password || !confirmation) {
      setError('required');
      return;
    }
    if (password !== confirmation) {
      setError('mismatch');
      return;
    }
    submitting.current = true;
    setPending(true);
    setError(null);
    try {
      await resetPassword(token, password);
      setSaved(true);
      setToken('');
      setPassword('');
      setConfirmation('');
    } catch (failure) {
      const status = recoveryErrorStatus(failure);
      setError(status === 400 ? 'invalid' : status === 422 ? 'policy' : 'unavailable');
      if (status === 400) setToken('');
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  const errorText =
    error === 'required'
      ? t('resetPasswordRequired', 'Enter and confirm your new password.')
      : error === 'mismatch'
        ? t('passwordsDoNotMatch', 'Passwords do not match')
        : error === 'policy'
          ? t(
              'resetPasswordPolicy',
              'The password does not meet the facility requirements. Choose a stronger password.',
            )
          : error === 'unavailable'
            ? t('resetPasswordUnconfirmed', 'Could not confirm the password change. Try signing in with the new password, or request a new recovery link.')
            : t('resetPasswordInvalidLink', 'This recovery link is invalid or has expired. Request a new link.');

  return (
    <div className={styles.container}>
      <Logo t={t} />
      <Tile className={styles.card}>
        <h1>{t('resetPasswordTitle', 'Set a new password')}</h1>
        {saved ? (
          <InlineNotification
            kind="success"
            hideCloseButton
            title={t('passwordChangedSuccessfully', 'Password changed successfully')}
            subtitle={t('resetPasswordSignIn', 'Sign in with your new password.')}
          />
        ) : session.authenticated ? (
          <InlineNotification
            kind="info"
            hideCloseButton
            title={t('resetPasswordSignOutFirst', 'Sign out before using a recovery link.')}
          />
        ) : (
          <>
            {(!token || error) && <InlineNotification kind="error" hideCloseButton title={errorText} />}
            {!online && (
              <InlineNotification
                kind="warning"
                hideCloseButton
                title={t('resetPasswordOnlineRequired', 'Connect to the network to reset your password.')}
              />
            )}
            <Form onSubmit={submit} className={styles.form}>
              <PasswordInput
                id="reset-new-password"
                autoComplete="new-password"
                showPasswordLabel={t('showPassword', 'Show password')}
                hidePasswordLabel={t('hidePassword', 'Hide password')}
                labelText={t('newPassword', 'New password')}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={pending || !token}
              />
              <PasswordInput
                id="reset-confirm-password"
                autoComplete="new-password"
                showPasswordLabel={t('showPassword', 'Show password')}
                hidePasswordLabel={t('hidePassword', 'Hide password')}
                labelText={t('confirmPassword', 'Confirm password')}
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                disabled={pending || !token}
              />
              <Button type="submit" disabled={pending || !token || !online}>
                {pending ? t('resetPasswordSaving', 'Saving password…') : t('resetPasswordSubmit', 'Save new password')}
              </Button>
            </Form>
          </>
        )}
        <Link to="/login">{t('backToLogin', 'Back to login')}</Link>
      </Tile>
    </div>
  );
}
