import { Button, Form, InlineLoading, Tile } from '@carbon/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { getUserFacingErrorMessage, showSnackbar } from '@openmrs/esm-framework';
import React, { useCallback, useState } from 'react';
import { Controller, type SubmitHandler, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import Logo from '../logo.component';

import { changeUserPassword } from './change-password.resource';
import PasswordInput from './password-input.component';
import styles from './change-password.scss';
import {
  type ChangePasswordFormData,
  createChangePasswordFormSchema,
  getPasswordRequirements,
  INCORRECT_OLD_PASSWORD_ERROR_CODE,
  normalizeChangePasswordError,
} from './change-password.validation';

const ChangePassword: React.FC = () => {
  const { t } = useTranslation();
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const changePasswordFormSchema = createChangePasswordFormSchema(t);
  const passwordRequirements = getPasswordRequirements(t);
  const passwordInputLabels = {
    hidePasswordLabel: t('hidePassword', 'Hide password'),
    showPasswordLabel: t('showPassword', 'Show password'),
  };

  const {
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordFormSchema),
    mode: 'all',
    defaultValues: {
      oldPassword: '',
      newPassword: '',
      passwordConfirmation: '',
    },
  });

  const onSubmit: SubmitHandler<ChangePasswordFormData> = useCallback(
    (data) => {
      setIsChangingPassword(true);

      const { oldPassword, newPassword } = data;

      changeUserPassword(oldPassword, newPassword)
        .then(() => {
          showSnackbar({
            title: t('passwordChangedSuccessfully', 'Password changed successfully'),
            kind: 'success',
          });
        })
        .catch((error) => {
          showSnackbar({
            kind: 'error',
            subtitle: getUserFacingErrorMessage(
              normalizeChangePasswordError(error),
              t('passwordChangeFailed', 'The password could not be changed. Please try again'),
              {
                codeMessages: {
                  [INCORRECT_OLD_PASSWORD_ERROR_CODE]: t('oldPasswordIncorrect', 'The current password is incorrect'),
                },
                logContext: 'Changing password',
              },
            ),
            title: t('errorChangingPassword', 'Error changing password'),
          });
        })
        .finally(() => {
          setIsChangingPassword(false);
        });
    },
    [t],
  );

  const onError = useCallback(() => setIsChangingPassword(false), []);

  return (
    <div className={styles.container}>
      <Tile className={styles.changePasswordCard}>
        <div className={styles.alignCenter}>
          <Logo t={t} />
        </div>
        <Form onSubmit={handleSubmit(onSubmit, onError)}>
          <Controller
            name="oldPassword"
            control={control}
            render={({ field: { onBlur, onChange, value } }) => (
              <PasswordInput
                {...passwordInputLabels}
                id="oldPassword"
                invalid={!!errors?.oldPassword}
                invalidText={
                  (errors &&
                    errors.oldPassword &&
                    errors.oldPassword.message &&
                    typeof errors.oldPassword.message === 'string' &&
                    errors.oldPassword.message) ??
                  ''
                }
                labelText={t('oldPassword', 'Old password')}
                onBlur={onBlur}
                onChange={onChange}
                value={value}
              />
            )}
          />
          <Controller
            name="newPassword"
            control={control}
            render={({ field: { onBlur, onChange, value } }) => (
              <PasswordInput
                {...passwordInputLabels}
                helperText={passwordRequirements}
                id="newPassword"
                invalid={!!errors?.newPassword}
                invalidText={
                  (errors &&
                    errors.newPassword &&
                    errors.newPassword.message &&
                    typeof errors.newPassword.message === 'string' &&
                    errors.newPassword.message) ??
                  ''
                }
                labelText={t('newPassword', 'New password')}
                onBlur={onBlur}
                onChange={onChange}
                value={value}
              />
            )}
          />
          <Controller
            name="passwordConfirmation"
            control={control}
            render={({ field: { onBlur, onChange, value } }) => (
              <PasswordInput
                {...passwordInputLabels}
                id="passwordConfirmation"
                invalid={!!errors?.passwordConfirmation}
                invalidText={
                  (errors &&
                    errors.passwordConfirmation &&
                    errors.passwordConfirmation.message &&
                    typeof errors.passwordConfirmation.message === 'string' &&
                    errors.passwordConfirmation.message) ??
                  ''
                }
                labelText={t('confirmPassword', 'Confirm new password')}
                onBlur={onBlur}
                onChange={onChange}
                value={value}
              />
            )}
          />
          <Button className={styles.submitButton} disabled={isChangingPassword} type="submit">
            {isChangingPassword ? (
              <InlineLoading description={t('changingPassword', 'Changing password') + '...'} />
            ) : (
              <span>{t('change', 'Change Password')}</span>
            )}
          </Button>
        </Form>
      </Tile>
    </div>
  );
};

export default ChangePassword;
