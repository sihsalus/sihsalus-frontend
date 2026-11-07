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
  it('rejects values outside concept absolute bounds even when the schema allows them', () => {
    const field = {
      id: 'temperature',
      type: 'obs',
      questionOptions: { rendering: 'number', min: '0', max: '60' },
      meta: { concept: { uuid: 'temperature', lowAbsolute: 25, hiAbsolute: 45, allowDecimal: true } },
    } as FormField;
    expect(FieldValidator.validate(field, 24)).toHaveLength(1);
    expect(FieldValidator.validate(field, 46)).toHaveLength(1);
    expect(FieldValidator.validate(field, 36.5)).toEqual([]);
    expect(FieldValidator.validate(field, undefined)).toEqual([]);
    for (const value of [NaN, Infinity, -Infinity]) {
      expect(FieldValidator.validate(field, value)).toHaveLength(1);
    }
  });

  it('does not infer zero bounds from empty or missing metadata', () => {
    const field = {
      id: 'measurement',
      type: 'obs',
      questionOptions: { rendering: 'number', min: '', max: '' },
      meta: { concept: { uuid: 'measurement', lowAbsolute: null, hiAbsolute: null } },
    } as FormField;
    expect(FieldValidator.validate(field, 36.5)).toEqual([]);
  });

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

  it('rejects textarea content that exceeds its configured character limit', () => {
    const field = {
      questionOptions: { rendering: 'textarea', maxLength: '5' },
    } as FormField;

    expect(FieldValidator.validate(field, '12345')).toEqual([]);
    expect(FieldValidator.validate(field, '123456')).toEqual([
      expect.objectContaining({ errCode: 'field.outOfBound' }),
    ]);
  });

  it('validates the requested 255-unit narrative limit without altering Unicode or historical text', () => {
    const field = { questionOptions: { rendering: 'textarea', maxLength: '255' } } as FormField;
    for (const length of [254, 255, 256, 1000]) {
      const text = 'á\n😀' + 'x'.repeat(length - 4);
      const original = text;
      expect(text.length).toBe(length);
      expect(FieldValidator.validate(field, text)).toHaveLength(length > 255 ? 1 : 0);
      expect(text).toBe(original);
    }
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

  it.each([
    [undefined, undefined, false],
    [false, undefined, false],
    [false, true, false],
    [false, false, true],
    [true, true, true],
    [true, false, true],
    [true, undefined, true],
  ])(
    'validates decimals with form restriction %s and concept allowance %s',
    (disallowDecimals, allowDecimal, rejects) => {
      const field = {
        id: 'hemoglobin',
        type: 'obs',
        questionOptions: { rendering: 'number', min: '3', max: '25', disallowDecimals },
        meta: { concept: allowDecimal === undefined ? undefined : { uuid: 'synthetic-numeric-concept', allowDecimal } },
      } as FormField;

      expect(FieldValidator.validate(field, 11.5)).toHaveLength(rejects ? 1 : 0);
      expect(FieldValidator.validate(field, 11)).toEqual([]);
      expect(FieldValidator.validate(field, undefined)).toEqual([]);
      expect(FieldValidator.validate(field, 30)).toHaveLength(1);
    },
  );

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
