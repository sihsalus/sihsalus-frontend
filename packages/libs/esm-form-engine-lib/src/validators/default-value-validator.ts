import dayjs from 'dayjs';
import { codedTypes } from '../constants';
import { type FormField, type FormFieldValidator } from '../types';
import { isEmpty } from './form-validator';

export const DefaultValueValidator: FormFieldValidator = {
  validate: (field: FormField, value: unknown) => {
    if (!isEmpty(value) && codedTypes.includes(field.questionOptions.rendering)) {
      const valuesArray = Array.isArray(value) ? value : [value];
      // check whether value exists in answers
      if (
        !valuesArray.every((val) =>
          field.questionOptions.answers?.find((answer) => answer.concept === val || answer.value === val),
        )
      ) {
        return [
          { resultType: 'error', errCode: 'invalid.defaultValue', message: 'Value not found in coded answers list' },
        ];
      }
    }
    if (!isEmpty(value) && field.questionOptions.rendering === 'date') {
      // Check if value is a valid date value
      if (
        !(value instanceof Date || typeof value === 'string' || typeof value === 'number') ||
        !dayjs(value).isValid()
      ) {
        return [
          {
            resultType: 'error',
            errCode: 'invalid.defaultValue',
            message: `Invalid date value: '${describeValue(value)}'`,
          },
        ];
      }
    }
    if (!isEmpty(value) && field.questionOptions.rendering === 'number') {
      if (typeof value !== 'number' || Number.isNaN(value)) {
        return [
          {
            resultType: 'error',
            errCode: 'invalid.defaultValue',
            message: `Invalid numerical  value: '${describeValue(value)}'`,
          },
        ];
      }
    }
    return [];
  },
};

function describeValue(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return 'unsupported';
}
