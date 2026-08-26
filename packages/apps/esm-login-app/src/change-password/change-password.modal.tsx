import {
  Button,
  Form,
  InlineLoading,
  InlineNotification,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Stack,
} from '@carbon/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { getUserFacingErrorMessage, showSnackbar } from '@openmrs/esm-framework';
import React, { useCallback, useState } from 'react';
import { Controller, type SubmitHandler, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { changeUserPassword } from './change-password.resource';
import PasswordInput from './password-input.component';
import {
  type ChangePasswordFormData,
  createChangePasswordFormSchema,
  getPasswordRequirements,
  INCORRECT_OLD_PASSWORD_ERROR_CODE,
  normalizeChangePasswordError,
} from './change-password.validation';
import styles from './change-password-modal.scss';

interface ChangePasswordModalProps {
  close(): void;
}

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ close }) => {
  const { t } = useTranslation();
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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
          close();

          showSnackbar({
            title: t('passwordChangedSuccessfully', 'Password changed successfully'),
            kind: 'success',
          });
        })
        .catch((error) => {
          setErrorMessage(
            getUserFacingErrorMessage(
              normalizeChangePasswordError(error),
              t('passwordChangeFailed', 'The password could not be changed. Please try again'),
              {
                codeMessages: {
                  [INCORRECT_OLD_PASSWORD_ERROR_CODE]: t('oldPasswordIncorrect', 'The current password is incorrect'),
                },
                logContext: 'Changing password',
              },
            ),
          );
        })
        .finally(() => {
          setIsChangingPassword(false);
        });
    },
    [close, t],
  );

  const onError = () => setIsChangingPassword(false);

  return (
    <Form onSubmit={handleSubmit(onSubmit, onError)}>
      <ModalHeader
        closeModal={close}
        iconDescription={t('close', 'Close')}
        title={t('changePassword', 'Change password')}
      />
      <ModalBody>
        <Stack gap={5} className={styles.languageOptionsContainer}>
          <Controller
            name="oldPassword"
            control={control}
            render={({ field: { onBlur, onChange, value } }) => (
              <PasswordInput
                {...passwordInputLabels}
                id="oldPassword"
                invalid={!!errors?.oldPassword}
                invalidText={errors?.oldPassword?.message}
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
                invalidText={errors?.newPassword?.message}
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
                invalidText={errors?.passwordConfirmation?.message}
                labelText={t('confirmPassword', 'Confirm new password')}
                onBlur={onBlur}
                onChange={onChange}
                value={value}
              />
            )}
          />
          {errorMessage && (
            <InlineNotification
              kind="error"
              onClick={() => setErrorMessage('')}
              subtitle={errorMessage}
              title={t('errorChangingPassword', 'Error changing password')}
            />
          )}
        </Stack>
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={close}>
          {t('cancel', 'Cancel')}
        </Button>
        <Button className={styles.submitButton} disabled={isChangingPassword} type="submit">
          {isChangingPassword ? (
            <InlineLoading description={t('changingPassword', 'Changing password') + '...'} />
          ) : (
            <span>{t('change', 'Change')}</span>
          )}
        </Button>
      </ModalFooter>
    </Form>
  );
};

export default ChangePasswordModal;
