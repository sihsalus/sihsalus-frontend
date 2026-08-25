import {
  calculateBodyMassIndex,
  calculateGlasgowComaScaleTotal,
  getAgeInCompletedMonths,
  getAgeInDays,
  getMuacColorCode,
  isConditionalFieldVisible,
  isMuacApplicableAge,
  isPediatricWeightAboveWhoReference,
  mergeReferenceRanges,
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

  it('classifies MUAC only for children up to 59 months', () => {
    const setColorCode = vi.fn();

    getMuacColorCode(24, 11.5, setColorCode);
    expect(setColorCode).toHaveBeenLastCalledWith('red');

    getMuacColorCode(24, 12, setColorCode);
    expect(setColorCode).toHaveBeenLastCalledWith('yellow');

    getMuacColorCode(24, 12.5, setColorCode);
    expect(setColorCode).toHaveBeenLastCalledWith('green');

    getMuacColorCode(60, 12, setColorCode);
    expect(setColorCode).toHaveBeenLastCalledWith('');
  });

  it('calculates Glasgow coma scale total only when all components are present', () => {
    expect(calculateGlasgowComaScaleTotal(4, 5, 6)).toBe(15);
    expect(calculateGlasgowComaScaleTotal(1, 1, 1)).toBe(3);
    expect(calculateGlasgowComaScaleTotal(4, undefined, 6)).toBeUndefined();
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

describe('mergeReferenceRanges', () => {
  it('fills missing patient limits with the general concept ranges', () => {
    expect(
      mergeReferenceRanges(
        { lowNormal: 36, hiNormal: 37.5, lowAbsolute: 30, hiAbsolute: 45 },
        { lowNormal: undefined, hiNormal: undefined, lowAbsolute: 35, hiAbsolute: 42 },
      ),
    ).toEqual({
      lowNormal: 36,
      hiNormal: 37.5,
      lowAbsolute: 35,
      hiAbsolute: 42,
      lowCritical: undefined,
      hiCritical: undefined,
    });
  });

  it('prefers the patient-specific normal range when available', () => {
    expect(
      mergeReferenceRanges(
        { lowNormal: 36, hiNormal: 37.5 },
        { lowNormal: 36.5, hiNormal: 37.2 },
      ),
    ).toMatchObject({ lowNormal: 36.5, hiNormal: 37.2 });
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

describe('MUAC age applicability', () => {
  const asOf = new Date(2026, 7, 17, 12);

  it('uses completed calendar months at the 59-to-60-month boundary', () => {
    expect(getAgeInCompletedMonths('2021-09-17', asOf)).toBe(59);
    expect(isMuacApplicableAge('2021-09-17', asOf)).toBe(true);
    expect(getAgeInCompletedMonths('2021-08-17', asOf)).toBe(60);
    expect(isMuacApplicableAge('2021-08-17', asOf)).toBe(false);
  });

  it('rejects missing, invalid and future birth dates', () => {
    expect(isMuacApplicableAge(undefined, asOf)).toBe(false);
    expect(isMuacApplicableAge('invalid', asOf)).toBe(false);
    expect(isMuacApplicableAge('2026-09-17', asOf)).toBe(false);
  });
});

describe('pediatric weight review warning', () => {
  it('flags an extreme infant weight without classifying it as a diagnosis', () => {
    expect(isPediatricWeightAboveWhoReference(90, 6, 'male')).toBe(true);
    expect(isPediatricWeightAboveWhoReference(9, 6, 'male')).toBe(false);
  });

  it('uses a conservative reference when sex is unavailable and does not apply to adults', () => {
    expect(isPediatricWeightAboveWhoReference(14, 12, undefined)).toBe(true);
    expect(isPediatricWeightAboveWhoReference(90, 60, 'female')).toBe(false);
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
