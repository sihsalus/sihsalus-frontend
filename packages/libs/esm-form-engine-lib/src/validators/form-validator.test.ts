import { translateFrom } from '@openmrs/esm-framework';
import { formEngineAppName } from '../globals';
import { type FormField } from '../types';
import { DateValidator } from './date-validator';
import { DefaultValueValidator } from './default-value-validator';
import { FieldValidator, numberInputRangeValidator } from './form-validator';

vi.mock('@openmrs/esm-framework', () => ({
  translateFrom: vi.fn(
    (_moduleName: string, _key: string, defaultValue: string, options?: Record<string, unknown>): string =>
      Object.entries(options ?? {}).reduce(
        (message, [key, value]) => message.replaceAll(`{{${key}}}`, String(value)),
        defaultValue,
      ),
  ),
}));

const mockTranslateFrom = vi.mocked(translateFrom);

describe('form validators', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('translates required field validation messages', () => {
    const field = {
      isRequired: true,
      questionOptions: {
        rendering: 'text',
      },
    } as FormField;

    const result = FieldValidator.validate(field, '');

    expect(result).toEqual([{ resultType: 'error', errCode: 'field.required', message: 'Field is mandatory' }]);
    expect(mockTranslateFrom).toHaveBeenCalledWith(
      formEngineAppName,
      'fieldMandatory',
      'Field is mandatory',
      undefined,
    );
  });

  it('translates inclusive numeric upper-bound validation messages', () => {
    const result = numberInputRangeValidator(Number.NaN, 10, 1000);

    expect(result).toEqual([
      {
        resultType: 'error',
        errCode: 'field.outOfBound',
        message: 'Value must be less than or equal to 10',
      },
    ]);
    expect(mockTranslateFrom).toHaveBeenCalledWith(
      formEngineAppName,
      'valueMustBeLessThanOrEqualTo',
      'Value must be less than or equal to {{max}}',
      { max: 10 },
    );
  });

  it('translates future date validation messages', () => {
    const field = {
      questionOptions: {
        rendering: 'date',
      },
    } as FormField;
    const result = DateValidator.validate(field, new Date('2999-01-01T00:00:00.000Z'));

    expect(result).toEqual([{ resultType: 'error', errCode: 'value.invalid', message: 'Future dates not allowed' }]);
    expect(mockTranslateFrom).toHaveBeenCalledWith(
      formEngineAppName,
      'futureDatesNotAllowed',
      'Future dates not allowed',
      undefined,
    );
  });

  it('translates invalid default value messages', () => {
    const field = {
      questionOptions: {
        rendering: 'number',
      },
    } as FormField;
    const result = DefaultValueValidator.validate(field, 'abc');

    expect(result).toEqual([
      {
        resultType: 'error',
        errCode: 'invalid.defaultValue',
        message: "Invalid numerical value: 'abc'",
      },
    ]);
    expect(mockTranslateFrom).toHaveBeenCalledWith(
      formEngineAppName,
      'invalidNumericalValue',
      "Invalid numerical value: '{{value}}'",
      { value: 'abc' },
    );
  });
});
