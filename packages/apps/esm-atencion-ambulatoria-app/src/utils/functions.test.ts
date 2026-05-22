import {
  assessValue,
  type ConceptMetadata,
  calculateBodyMassIndex,
  formatAMPM,
  generatePlaceholder,
  getGender,
  getReferenceRangesForConcept,
  interpretBloodPressure,
} from './functions';

describe('consulta ambulatoria utils/functions', () => {
  const metadata: Array<ConceptMetadata> = [
    {
      uuid: 'systolic',
      display: 'Systolic',
      hiNormal: 140,
      hiAbsolute: null,
      hiCritical: 180,
      lowNormal: 90,
      lowAbsolute: null,
      lowCritical: 70,
      units: 'mmHg',
    },
    {
      uuid: 'diastolic',
      display: 'Diastolic',
      hiNormal: 90,
      hiAbsolute: null,
      hiCritical: 120,
      lowNormal: 60,
      lowAbsolute: null,
      lowCritical: 40,
      units: 'mmHg',
    },
  ];

  const t = (_key: string, fallback: string) => fallback;

  it('formats time, computes BMI, and maps gender labels', () => {
    expect(formatAMPM(new Date(2025, 0, 1, 0, 5))).toBe('12:05 AM');
    expect(formatAMPM(new Date(2025, 0, 1, 13, 9))).toBe('1:09 PM');
    expect(calculateBodyMassIndex(70, 175)).toBe(22.9);
    expect(calculateBodyMassIndex(0, 175)).toBeNull();
    expect(getGender('M', t)).toBe('Male');
    expect(getGender('U', t)).toBe('Unknown');
    expect(getGender('X', t)).toBe('X');
  });

  it('interprets reference ranges, blood pressure, and placeholders', () => {
    expect(getReferenceRangesForConcept('systolic', metadata)).toEqual(metadata[0]);
    expect(getReferenceRangesForConcept('missing', metadata)).toBeUndefined();
    expect(assessValue(181, metadata[0])).toBe('critically_high');
    expect(assessValue(89, metadata[0])).toBe('low');
    expect(generatePlaceholder('BMI')).toBe('');
    expect(generatePlaceholder('Temperature')).toBe('--.-');
    expect(generatePlaceholder('Pulse')).toBe('---');
    expect(generatePlaceholder('Other')).toBe('--');

    expect(
      interpretBloodPressure(
        120,
        121,
        { systolicBloodPressureUuid: 'systolic', diastolicBloodPressureUuid: 'diastolic' },
        metadata,
      ),
    ).toBe('critically_high');

    expect(
      interpretBloodPressure(
        120,
        80,
        { systolicBloodPressureUuid: 'systolic', diastolicBloodPressureUuid: 'diastolic' },
        metadata,
      ),
    ).toBe('normal');
  });
});
