import { translateFrom } from '@openmrs/esm-framework';
import { parsePlainDecimalInput } from '@openmrs/esm-utils';
import { formEngineAppName } from '../globals';
import { type FormField, type FormFieldValidator, type ValidationResult } from '../types';
import { isTrue } from '../utils/boolean-utils';
import { isPlainObject, isStringOrNumber } from '../utils/common-utils';
export const fieldRequiredErrCode = 'field.required';
export const fieldOutOfBoundErrCode = 'field.outOfBound';

/** Resolve once for the input and submission validator; schema limits can only narrow the catalog. */
export function getNumericFieldConstraints(field: FormField) {
  const concept: Record<string, unknown> = isPlainObject(field.meta?.concept) ? field.meta.concept : {};
  const lower = [field.questionOptions.min, concept.lowAbsolute]
    .filter(isStringOrNumber)
    .map(parsePlainDecimalInput)
    .filter((value): value is number => value !== undefined);
  const upper = [field.questionOptions.max, concept.hiAbsolute]
    .filter(isStringOrNumber)
    .map(parsePlainDecimalInput)
    .filter((value): value is number => value !== undefined);
  const min = lower.length ? Math.max(...lower) : undefined;
  const max = upper.length ? Math.min(...upper) : undefined;
  return {
    min,
    max,
    integer: isTrue(field.questionOptions.disallowDecimals ?? false) || concept.allowDecimal === false,
    nonNegative: min !== undefined && min >= 0,
  };
}

export const FieldValidator: FormFieldValidator = {
  validate: (field: FormField, value: unknown): ValidationResult[] => {
    if (field.meta?.submission?.unspecified) {
      return [];
    }
    if (isEmpty(value) && field.isRequired) {
      if (typeof field.required === 'object' && field.required.type === 'conditionalRequired' && field.isRequired) {
        return addError(
          fieldRequiredErrCode,
          field.required.message ?? translateValidationMessage('fieldMandatory', 'Field is mandatory'),
        );
      } else if (field.isRequired) {
        return addError(fieldRequiredErrCode, translateValidationMessage('fieldMandatory', 'Field is mandatory'));
      }
    }
    if (field.questionOptions.rendering === 'text' || field.questionOptions.rendering === 'textarea') {
      const minLength = field.questionOptions.minLength;
      const maxLength = field.questionOptions.maxLength;
      const inputLength = typeof value === 'string' ? value.length : undefined;

      return textInputLengthValidator(minLength, maxLength, inputLength) ?? [];
    }
    if (field.questionOptions.rendering === 'number') {
      const { min, max, integer: disallowDecimals } = getNumericFieldConstraints(field);
      if (isEmpty(value)) return [];
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return addError(
          fieldOutOfBoundErrCode,
          translateValidationMessage('valueMustBeNumber', 'Value must be a number'),
        );
      }
      if (disallowDecimals && !Number.isInteger(value)) {
        return addError(
          fieldOutOfBoundErrCode,
          translateValidationMessage('decimalValuesNotAllowed', 'Decimal values are not allowed for this field'),
        );
      }
      if (min !== undefined || max !== undefined) {
        return numberInputRangeValidator(min ?? Number.NaN, max ?? Number.NaN, value);
      }
    }
    return [];
  },
};

export function numberInputRangeValidator(min: number, max: number, inputValue: number): ValidationResult[] {
  if (!Number.isNaN(min) && inputValue < min) {
    return addError(
      fieldOutOfBoundErrCode,
      translateValidationMessage('valueMustBeGreaterThanOrEqualTo', 'Value must be greater than or equal to {{min}}', {
        min,
      }),
    );
  }

  if (!Number.isNaN(max) && inputValue > max) {
    return addError(
      fieldOutOfBoundErrCode,
      translateValidationMessage('valueMustBeLessThanOrEqualTo', 'Value must be less than or equal to {{max}}', {
        max,
      }),
    );
  }

  return [];
}

export function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null || value === '') {
    return true;
  }
  if (typeof value === 'string' && !value?.trim()) {
    return true;
  }
  if (Array.isArray(value) && !value.length) {
    return true;
  }
  return false;
}

export function textInputLengthValidator(
  minLength: string | undefined,
  maxLength: string | undefined,
  inputLength: number | undefined,
): ValidationResult[] | undefined {
  const minLen = Number(minLength);
  const maxLen = Number(maxLength);

  if (typeof inputLength === 'number' && !Number.isNaN(inputLength)) {
    if (minLen && maxLen && inputLength >= minLen && inputLength <= maxLen) {
      return [];
    }

    if (minLen && inputLength < minLen) {
      return addError(
        fieldOutOfBoundErrCode,
        translateValidationMessage('lengthAtLeastCharacters', 'Length should be at least {{min}} characters', {
          min: minLen,
        }),
      );
    }

    if (maxLen && inputLength > maxLen) {
      return addError(
        fieldOutOfBoundErrCode,
        translateValidationMessage('lengthMustNotExceedCharacters', 'Length should not exceed {{max}} characters', {
          max: maxLen,
        }),
      );
    }

    if (maxLen && minLen && inputLength < minLen && inputLength > maxLen) {
      return addError(
        fieldOutOfBoundErrCode,
        translateValidationMessage(
          'lengthBetweenCharacters',
          'Length should be between {{min}} and {{max}} characters',
          {
            max: maxLen,
            min: minLen,
          },
        ),
      );
    }
  }
}

export function addError(errorCode: string, message: string): ValidationResult[] {
  return [
    {
      resultType: 'error',
      errCode: errorCode,
      message: message,
    },
  ];
}

export function translateValidationMessage(
  key: string,
  defaultValue: string,
  options?: Record<string, unknown>,
): string {
  return translateFrom(formEngineAppName, key, defaultValue, options);
}
