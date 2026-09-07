import { getDefaultsFromConfigSchema, useConfig } from '@openmrs/esm-framework';
import { renderHook } from '@testing-library/react';
import { type ConfigObject, configSchema } from '../config-schema';
import { durationToDays, useCreateMedicationOrderFormSchema } from './drug-order-form.resource';

vi.mock('../api', () => ({
  useRequireOutpatientQuantity: () => ({ requireOutpatientQuantity: true }),
}));

const durationUnitsDaysMap = configSchema.durationUnitsDaysMap._default;

describe('single-dose schema', () => {
  const onceUuid = '11111111-1111-4111-8111-111111111111';
  const validSingleDose = {
    drug: {
      uuid: 'synthetic-drug',
      concept: { uuid: 'synthetic-concept' },
      dosageForm: null,
      strength: null,
      display: 'Synthetic drug',
    },
    urgency: 'STAT',
    isFreeTextDosage: false,
    freeTextDosage: '',
    dosage: 2,
    unit: { valueCoded: 'synthetic-tablet', value: 'Tablet' },
    route: { valueCoded: 'synthetic-oral', value: 'Oral' },
    frequency: {
      valueCoded: onceUuid,
      value: 'One administration',
      frequencyPerDay: null,
    },
    asNeeded: false,
    asNeededCondition: '',
    duration: null,
    durationUnit: null,
    pillsDispensed: 2,
    quantityUnits: { valueCoded: 'synthetic-tablet', value: 'Tablet' },
    numRefills: 0,
    indication: 'Synthetic indication',
    patientInstructions: '',
    startDate: new Date(),
  };

  beforeEach(() => {
    vi.mocked(useConfig).mockReturnValue({
      ...(getDefaultsFromConfigSchema(configSchema) as ConfigObject),
      singleDoseFrequencyUuid: onceUuid,
    });
  });

  it('accepts structured single-dose prescribing without treatment duration', () => {
    const { result } = renderHook(useCreateMedicationOrderFormSchema);
    expect(result.current.safeParse(validSingleDose).success).toBe(true);
  });

  it.each([
    { path: 'asNeeded', value: true },
    { path: 'asNeededCondition', value: 'Repeat if necessary' },
    { path: 'numRefills', value: 1 },
    { path: 'duration', value: 7 },
    {
      path: 'durationUnit',
      value: { valueCoded: 'synthetic-days', value: 'Days' },
    },
    { path: 'isFreeTextDosage', value: true },
  ])('rejects conflicting single-dose field $path', ({ path, value }) => {
    const { result } = renderHook(useCreateMedicationOrderFormSchema);
    const parsed = result.current.safeParse({
      ...validSingleDose,
      freeTextDosage: 'Synthetic instructions',
      [path]: value,
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((issue) => issue.message.includes('A single dose requires'))).toBe(true);
    }
  });

  it('still requires duration for a daily STAT order even when frequencyPerDay is one', () => {
    const { result } = renderHook(useCreateMedicationOrderFormSchema);
    const parsed = result.current.safeParse({
      ...validSingleDose,
      frequency: {
        valueCoded: 'synthetic-daily',
        value: 'Once daily',
        frequencyPerDay: 1,
      },
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.map((issue) => issue.path[0])).toEqual(
        expect.arrayContaining(['duration', 'durationUnit']),
      );
    }
  });

  it('rejects an immediate single-dose draft left open from a previous day', () => {
    const { result } = renderHook(useCreateMedicationOrderFormSchema);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const parsed = result.current.safeParse({ ...validSingleDose, startDate: yesterday });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues).toEqual(expect.arrayContaining([expect.objectContaining({ path: ['startDate'] })]));
    }
  });

  it('does not identify one administration by display name', () => {
    const { result } = renderHook(useCreateMedicationOrderFormSchema);
    expect(
      result.current.safeParse({
        ...validSingleDose,
        frequency: {
          ...validSingleDose.frequency,
          valueCoded: 'different-frequency',
        },
      }).success,
    ).toBe(false);
  });
});

describe('durationToDays', () => {
  it('converts days correctly', () => {
    expect(durationToDays(7, '1072AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', durationUnitsDaysMap)).toBe(7);
  });

  it('converts weeks correctly', () => {
    expect(durationToDays(2, '1073AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', durationUnitsDaysMap)).toBe(14);
  });

  it('converts months correctly', () => {
    expect(durationToDays(3, '1074AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', durationUnitsDaysMap)).toBe(90);
  });

  it('converts years correctly', () => {
    expect(durationToDays(1, '1734AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', durationUnitsDaysMap)).toBe(365);
  });

  it('returns null when duration is null', () => {
    expect(durationToDays(null, '1072AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', durationUnitsDaysMap)).toBeNull();
  });

  it('returns null when duration unit UUID is null', () => {
    expect(durationToDays(7, null, durationUnitsDaysMap)).toBeNull();
  });

  it('returns null for an unknown duration unit UUID', () => {
    expect(durationToDays(7, 'unknown-uuid', durationUnitsDaysMap)).toBeNull();
  });

  it('returns 0 when duration is 0', () => {
    expect(durationToDays(0, '1072AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', durationUnitsDaysMap)).toBe(0);
  });
});
