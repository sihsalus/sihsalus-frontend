import { describe, expect, it } from 'vitest';
import { type FormContextProps } from '../provider/form-provider';
import { type FormField, type FormProcessorContextProps } from '../types';
import { PersonAttributeAdapter } from './person-attribute-adapter';

const attributeType = '7ef225db-94db-4e40-9dd8-fb121d9dc370';

describe('PersonAttributeAdapter', () => {
  const mockField = {
    id: 'test-person-attribute',
    type: 'personAttribute',
    questionOptions: {
      attributeType,
      rendering: 'text',
    },
    meta: {},
  } satisfies FormField;

  const mockFormContext = {
    patient: {
      id: 'test-patient-uuid',
    } as fhir.Patient,
  } satisfies Partial<FormContextProps> as FormContextProps;

  it('returns null for an empty value', () => {
    expect(PersonAttributeAdapter.transformFieldValue(mockField, '', mockFormContext)).toBeNull();
  });

  it('returns null when value matches the initial value', () => {
    const field = {
      ...mockField,
      meta: {
        submission: {},
        initialValue: {
          omrsObject: null,
          refinedValue: 'test-value',
        },
      },
    } satisfies FormField;

    expect(PersonAttributeAdapter.transformFieldValue(field, 'test-value', mockFormContext)).toBeNull();
  });

  it('transforms a new person attribute value', () => {
    const field = { ...mockField, meta: {} };

    expect(PersonAttributeAdapter.transformFieldValue(field, 'new-value', mockFormContext)).toEqual({
      value: 'new-value',
      attributeType,
      uuid: undefined,
    });
  });

  it('keeps the existing attribute uuid when updating', () => {
    const field = {
      ...mockField,
      meta: {
        submission: {},
        initialValue: {
          omrsObject: { uuid: 'existing-attribute-uuid' },
          refinedValue: 'old-value',
        },
      },
    } satisfies FormField;

    expect(PersonAttributeAdapter.transformFieldValue(field, 'updated-value', mockFormContext)).toEqual({
      value: 'updated-value',
      attributeType,
      uuid: 'existing-attribute-uuid',
    });
  });

  it('reads an initial valueString from the FHIR patient extension', () => {
    const field = { ...mockField, meta: {} };
    const context = {
      patient: {
        id: 'test-patient',
        extension: [
          {
            id: 'existing-attribute-uuid',
            url: `http://fhir.openmrs.org/ext/person-attribute/${attributeType}`,
            valueString: 'test-attribute-value',
          },
        ],
      } as fhir.Patient,
    } satisfies Partial<FormProcessorContextProps> as FormProcessorContextProps;

    expect(PersonAttributeAdapter.getInitialValue(field, null, context)).toBe('test-attribute-value');
    const meta = field.meta as FormField['meta'];
    expect(meta.initialValue.refinedValue).toBe('test-attribute-value');
    expect(meta.initialValue.omrsObject).toMatchObject({ uuid: 'existing-attribute-uuid' });
  });

  it('reads an initial valueReference from the FHIR patient extension', () => {
    const field = { ...mockField, meta: {} };
    const context = {
      patient: {
        id: 'test-patient',
        extension: [
          {
            url: `http://fhir.openmrs.org/ext/person-attribute/${attributeType}`,
            valueReference: {
              reference: 'Location/test-location-uuid',
            },
          },
        ],
      } as fhir.Patient,
    } satisfies Partial<FormProcessorContextProps> as FormProcessorContextProps;

    expect(PersonAttributeAdapter.getInitialValue(field, null, context)).toBe('Location/test-location-uuid');
  });
});
