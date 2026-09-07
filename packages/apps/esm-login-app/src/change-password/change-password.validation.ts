import { z } from 'zod';

type Translate = (key: string, defaultValue: string) => string;

const passwordRequirementsPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
export const INCORRECT_OLD_PASSWORD_ERROR_CODE = 'INCORRECT_OLD_PASSWORD';

export function getPasswordRequirements(t: Translate) {
  return t(
    'passwordRequirements',
    'Use at least 8 characters, including an uppercase letter, a lowercase letter, and a digit',
  );
}

export function createChangePasswordFormSchema(t: Translate) {
  const oldPasswordRequired = t('oldPasswordRequired', 'Enter your current password');
  const newPasswordRequired = t('newPasswordRequired', 'Enter a new password');
  const passwordConfirmationRequired = t('passwordConfirmationRequired', 'Confirm your new password');

  return z
    .object({
      oldPassword: z.string({ required_error: oldPasswordRequired }).min(1, oldPasswordRequired),
      newPassword: z
        .string({ required_error: newPasswordRequired })
        .min(1, newPasswordRequired)
        .regex(passwordRequirementsPattern, getPasswordRequirements(t)),
      passwordConfirmation: z
        .string({ required_error: passwordConfirmationRequired })
        .min(1, passwordConfirmationRequired),
    })
    .refine((data) => data.newPassword === data.passwordConfirmation, {
      message: t('passwordsDoNotMatch', 'Passwords do not match'),
      path: ['passwordConfirmation'],
    });
}

export type ChangePasswordFormData = z.infer<ReturnType<typeof createChangePasswordFormSchema>>;

type ChangePasswordError = {
  message?: unknown;
  responseBody?: {
    message?: unknown;
    error?: {
      code?: unknown;
      message?: unknown;
    };
  };
};

export function normalizeChangePasswordError(error: unknown) {
  const typedError = error as ChangePasswordError;
  const backendError = [
    typedError?.message,
    typedError?.responseBody?.message,
    typedError?.responseBody?.error?.code,
    typedError?.responseBody?.error?.message,
  ]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase();

  const isIncorrectOldPassword =
    backendError.includes('old.password.not.correct') ||
    backendError.includes('old password is not correct') ||
    backendError.includes('incorrect old password') ||
    backendError.includes('old password is incorrect');

  if (isIncorrectOldPassword) {
    return {
      cause: error,
      code: INCORRECT_OLD_PASSWORD_ERROR_CODE,
    };
  }

  return error;
}
