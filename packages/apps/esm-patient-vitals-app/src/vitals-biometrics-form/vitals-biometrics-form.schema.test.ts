import { numericMeasurementInputIds } from './vitals-biometrics-form.utils';
import { VitalsAndBiometricFormSchema } from './vitals-biometrics-form.schema';

const validMeasurements = {
  systolicBloodPressure: 120,
  diastolicBloodPressure: 80,
  respiratoryRate: 16,
  oxygenSaturation: 98,
  pulse: 70,
  temperature: 37,
  weight: 60,
  height: 170,
  midUpperArmCircumference: 25,
  abdominalCircumference: 80,
  headCircumference: 50,
  chestCircumference: 85,
  glasgowTotal: 15,
  computedBodyMassIndex: 20.8,
};

function expectMeasurementRejected(field: (typeof numericMeasurementInputIds)[number], value: number) {
  const result = VitalsAndBiometricFormSchema.safeParse({ ...validMeasurements, [field]: value });

  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: [field],
        }),
      ]),
    );
  }
}

describe('VitalsAndBiometricFormSchema numeric measurement contract', () => {
  it.each(numericMeasurementInputIds)('rejects non-finite %s values', (field) => {
    expectMeasurementRejected(field, Number.NaN);
    expectMeasurementRejected(field, Number.POSITIVE_INFINITY);
    expectMeasurementRejected(field, Number.NEGATIVE_INFINITY);
  });

  it.each(numericMeasurementInputIds)('rejects values below the hard lower bound for %s', (field) => {
    expectMeasurementRejected(field, field === 'glasgowTotal' ? 2 : -0.1);
  });

  it('accepts zero for user-entered measurements, including circumferences', () => {
    const result = VitalsAndBiometricFormSchema.safeParse({
      systolicBloodPressure: 0,
      diastolicBloodPressure: 0,
      respiratoryRate: 0,
      oxygenSaturation: 0,
      pulse: 0,
      temperature: 0,
      weight: 0,
      height: 0,
      midUpperArmCircumference: 0,
      abdominalCircumference: 0,
      headCircumference: 0,
      chestCircumference: 0,
    });

    expect(result.success).toBe(true);
  });

  it('enforces only hard maxima defined by the measurement contract', () => {
    expect(
      VitalsAndBiometricFormSchema.safeParse({ ...validMeasurements, oxygenSaturation: 100, glasgowTotal: 15 }).success,
    ).toBe(true);
    expectMeasurementRejected('oxygenSaturation', 100.1);
    expectMeasurementRejected('glasgowTotal', 15.1);

    expect(
      VitalsAndBiometricFormSchema.safeParse({ ...validMeasurements, weight: Number.MAX_VALUE }).success,
    ).toBe(true);
  });
});
