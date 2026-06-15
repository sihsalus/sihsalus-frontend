import { type FormField, type FormFieldValidator } from '../types';
import { isTrue } from '../utils/boolean-utils';
import { FieldValidator, translateValidationMessage } from './form-validator';

interface DateValidatorConfig {
  allowFutureDates?: string | boolean;
}

export const DateValidator: FormFieldValidator = {
  validate: (field: FormField, value: unknown, config?: unknown) => {
    const resolvedConfig = (config ?? {}) as DateValidatorConfig;
    const now = new Date();
    const errors = !value ? FieldValidator.validate(field, value) : [];
    if (errors.length) {
      return errors;
    }
    if (value instanceof Date && !isTrue(resolvedConfig.allowFutureDates)) {
      return value.getTime() > now.getTime()
        ? [
            {
              resultType: 'error',
              errCode: 'value.invalid',
              message: translateValidationMessage('futureDatesNotAllowed', 'Future dates not allowed'),
            },
          ]
        : [];
    }
    return [];
  },
};
