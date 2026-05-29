import { buildBiometricMeasurements, getBiometricConceptUuids } from './biometrics-utils';

const concepts = {
  heightUuid: 'height-concept',
  weightUuid: 'weight-concept',
  headCircumferenceUuid: 'head-concept',
};

describe('biometrics-utils', () => {
  it('returns only the biometric concept UUIDs used by the growth chart', () => {
    expect(
      getBiometricConceptUuids({
        ...concepts,
        unrelatedConceptUuid: 'ignored',
      }),
    ).toEqual(['height-concept', 'weight-concept', 'head-concept']);
  });

  it('groups observations from the same encounter even when timestamps differ', () => {
    const measurements = buildBiometricMeasurements(
      [
        {
          effectiveDateTime: '2026-01-01T10:00:03.000Z',
          encounter: { reference: 'Encounter/enc-1' },
          code: { coding: [{ code: 'weight-concept' }] },
          valueQuantity: { value: 5.4 },
        },
        {
          effectiveDateTime: '2026-01-01T10:00:07.000Z',
          encounter: { reference: 'Encounter/enc-1' },
          code: { coding: [{ code: 'height-concept' }] },
          valueQuantity: { value: 58 },
        },
        {
          effectiveDateTime: '2026-01-01T10:00:09.000Z',
          encounter: { reference: 'Encounter/enc-1' },
          code: { coding: [{ code: 'head-concept' }] },
          valueQuantity: { value: 39 },
        },
      ],
      concepts,
    );

    expect(measurements).toHaveLength(1);
    expect(measurements[0].dataValues).toEqual({
      weight: '5.4',
      height: '58',
      headCircumference: '39',
    });
  });

  it('uses the matching configured code even when it is not the first coding entry', () => {
    const measurements = buildBiometricMeasurements(
      [
        {
          effectiveDateTime: '2026-02-01T10:00:00.000Z',
          code: { coding: [{ code: 'loinc-placeholder' }, { code: 'weight-concept' }] },
          valueQuantity: { value: 6.2 },
        },
        {
          effectiveDateTime: '2026-02-01T11:00:00.000Z',
          code: { coding: [{ code: 'height-concept' }] },
          valueQuantity: { value: 61 },
        },
      ],
      concepts,
    );

    expect(measurements).toHaveLength(1);
    expect(measurements[0].dataValues.weight).toBe('6.2');
    expect(measurements[0].dataValues.height).toBe('61');
  });

  it('ignores malformed or unrelated observations', () => {
    const measurements = buildBiometricMeasurements(
      [
        {
          effectiveDateTime: 'invalid-date',
          code: { coding: [{ code: 'weight-concept' }] },
          valueQuantity: { value: 6.2 },
        },
        {
          effectiveDateTime: '2026-02-01T10:00:00.000Z',
          code: { coding: [{ code: 'unrelated-concept' }] },
          valueQuantity: { value: 99 },
        },
      ],
      concepts,
    );

    expect(measurements).toEqual([]);
  });
});
