import {
  calculateBodyMassIndex,
  getAgeInDays,
  getMuacColorCode,
  isConditionalFieldVisible,
  validateClinicalNumberInput,
} from './vitals-biometrics-form.utils';

describe('vitals biometrics form utils', () => {
  it('calculates BMI when weight and height are positive', () => {
    expect(calculateBodyMassIndex(62, 180)).toBe(19.1);
  });

  it('returns undefined when BMI cannot be calculated', () => {
    expect(calculateBodyMassIndex(0, 180)).toBeUndefined();
    expect(calculateBodyMassIndex(62, 0)).toBeUndefined();
  });

  it('classifies adult MUAC values without overlapping red and yellow ranges', () => {
    const setColorCode = vi.fn();

    getMuacColorCode(19, 19.5, setColorCode);
    expect(setColorCode).toHaveBeenLastCalledWith('red');

    getMuacColorCode(19, 19.6, setColorCode);
    expect(setColorCode).toHaveBeenLastCalledWith('yellow');
  });
});

describe('validateClinicalNumberInput', () => {
  it('rejects scientific notation, negative values and non-numeric text', () => {
    expect(validateClinicalNumberInput('1e100').isInvalidFormat).toBe(true);
    expect(validateClinicalNumberInput('-1').isInvalidFormat).toBe(true);
    expect(validateClinicalNumberInput('+1').isInvalidFormat).toBe(true);
    expect(validateClinicalNumberInput('1,2').isInvalidFormat).toBe(true);
    expect(validateClinicalNumberInput('12@').isInvalidFormat).toBe(true);
    expect(validateClinicalNumberInput('abc').isInvalidFormat).toBe(true);
  });

  it('rejects decimals for integer-only clinical fields', () => {
    expect(validateClinicalNumberInput('120.5', { integer: true }).isInvalidFormat).toBe(true);
    expect(validateClinicalNumberInput('120.0', { integer: true }).isInvalidFormat).toBe(true);
    expect(validateClinicalNumberInput('120', { integer: true }).parsedValue).toBe(120);
  });

  it('marks values outside configured clinical ranges', () => {
    expect(validateClinicalNumberInput('251', { min: 0, max: 250 }).isOutOfRange).toBe(true);
    expect(validateClinicalNumberInput('80', { min: 0, max: 250 }).isInvalid).toBe(false);
  });
});

describe('getAgeInDays', () => {
  it('computes whole days between birth date and the reference date', () => {
    expect(getAgeInDays('2024-01-01', new Date('2024-01-31T12:00:00Z'))).toBe(30);
  });

  it('returns null for missing or invalid birth dates', () => {
    expect(getAgeInDays(undefined)).toBeNull();
    expect(getAgeInDays('not-a-date')).toBeNull();
  });
});

describe('isConditionalFieldVisible', () => {
  const headRule = { enabled: true, minAgeDays: 0, maxAgeDays: 4380, unit: 'cm' };
  const chestRule = { enabled: true, minAgeDays: 0, maxAgeDays: 365, unit: 'cm' };

  it('shows the field when the patient age falls within the configured range', () => {
    expect(isConditionalFieldVisible('headCircumference', headRule, 30)).toBe(true);
    expect(isConditionalFieldVisible('headCircumference', headRule, 4380)).toBe(true);
    expect(isConditionalFieldVisible('chestCircumference', chestRule, 200)).toBe(true);
  });

  it('hides the field for patients outside the age range', () => {
    expect(isConditionalFieldVisible('headCircumference', headRule, 4381)).toBe(false);
    expect(isConditionalFieldVisible('chestCircumference', chestRule, 366)).toBe(false);
  });

  it('hides the field when disabled by config or the age is unknown', () => {
    expect(isConditionalFieldVisible('headCircumference', { ...headRule, enabled: false }, 30)).toBe(false);
    expect(isConditionalFieldVisible('headCircumference', headRule, null)).toBe(false);
  });

  it('honors consumer overrides, with hideFields taking precedence', () => {
    expect(isConditionalFieldVisible('headCircumference', headRule, 9000, { showFields: ['headCircumference'] })).toBe(
      true,
    );
    expect(isConditionalFieldVisible('headCircumference', headRule, null, { showFields: ['headCircumference'] })).toBe(
      true,
    );
    expect(
      isConditionalFieldVisible('headCircumference', headRule, 30, {
        showFields: ['headCircumference'],
        hideFields: ['headCircumference'],
      }),
    ).toBe(false);
  });
});
