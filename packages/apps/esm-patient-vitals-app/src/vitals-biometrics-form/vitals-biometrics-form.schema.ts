import { z } from 'zod';

import {
  NUMERIC_MEASUREMENT_INPUT_LIMITS,
  type NumericMeasurementInputId,
} from './vitals-biometrics-form.utils';

const glasgowFieldKeys = ['glasgowEyeOpening', 'glasgowVerbalResponse', 'glasgowMotorResponse'] as const;

function numericMeasurementSchema(field: NumericMeasurementInputId) {
  const { min, max } = NUMERIC_MEASUREMENT_INPUT_LIMITS[field];
  const schema = z.number().finite({ message: 'Measurement must be finite' }).min(min, {
    message: 'Measurement is below its hard input limit',
  });

  return max === null ? schema : schema.max(max, { message: 'Measurement exceeds its hard input limit' });
}

/**
 * Runtime contract shared by the form resolver and the REST mutation boundary.
 * OpenMRS reference ranges are intentionally handled separately as warnings;
 * this schema only rejects unambiguous representation and unit violations.
 */
export const VitalsAndBiometricFormSchema = z
  .object({
    systolicBloodPressure: numericMeasurementSchema('systolicBloodPressure'),
    diastolicBloodPressure: numericMeasurementSchema('diastolicBloodPressure'),
    respiratoryRate: numericMeasurementSchema('respiratoryRate'),
    oxygenSaturation: numericMeasurementSchema('oxygenSaturation'),
    pulse: numericMeasurementSchema('pulse'),
    temperature: numericMeasurementSchema('temperature'),
    generalPatientNote: z.string(),
    weight: numericMeasurementSchema('weight'),
    height: numericMeasurementSchema('height'),
    midUpperArmCircumference: numericMeasurementSchema('midUpperArmCircumference'),
    abdominalCircumference: numericMeasurementSchema('abdominalCircumference'),
    headCircumference: numericMeasurementSchema('headCircumference'),
    chestCircumference: numericMeasurementSchema('chestCircumference'),
    glasgowEyeOpening: z.string(),
    glasgowVerbalResponse: z.string(),
    glasgowMotorResponse: z.string(),
    glasgowTotal: numericMeasurementSchema('glasgowTotal'),
    computedBodyMassIndex: numericMeasurementSchema('computedBodyMassIndex'),
  })
  .partial()
  .refine(
    (fields) => {
      const completedGlasgowFields = glasgowFieldKeys.filter((field) => fields[field] != null);
      return completedGlasgowFields.length === 0 || completedGlasgowFields.length === glasgowFieldKeys.length;
    },
    {
      message: 'Please complete all Glasgow coma scale fields',
      path: ['glasgowComaScale'],
    },
  )
  .refine((fields) => (fields.systolicBloodPressure == null) === (fields.diastolicBloodPressure == null), {
    message: 'Blood pressure requires both systolic and diastolic values',
    path: ['bloodPressureIncomplete'],
  })
  .refine(
    (fields) =>
      fields.systolicBloodPressure == null ||
      fields.diastolicBloodPressure == null ||
      fields.systolicBloodPressure >= fields.diastolicBloodPressure,
    {
      message: 'Systolic blood pressure cannot be lower than diastolic blood pressure',
      path: ['bloodPressureInverted'],
    },
  )
  .refine(
    (fields) => {
      // A note alone must not create an encounter; require at least one user-recorded measurement.
      const {
        generalPatientNote: _note,
        computedBodyMassIndex: _bmi,
        glasgowTotal: _glasgowTotal,
        ...measurements
      } = fields;
      return Object.values(measurements).some((value) => value != null && value !== '');
    },
    {
      message: 'Please record at least one measurement',
      path: ['oneFieldRequired'],
    },
  );

export type VitalsBiometricsFormData = z.infer<typeof VitalsAndBiometricFormSchema>;
