import {
  assessValue,
  type ConceptMetadata,
  calculateBodyMassIndex,
  formatAMPM,
  getGender,
  getReferenceRangesForConcept,
  interpretBloodPressure,
} from './functions';

describe('maternal utils/functions', () => {
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

  it('formats 12-hour time and computes BMI safely', () => {
    expect(formatAMPM(new Date(2025, 0, 1, 0, 5))).toBe('12:05 AM');
    expect(formatAMPM(new Date(2025, 0, 1, 13, 9))).toBe('1:09 PM');
    expect(calculateBodyMassIndex(70, 175)).toBe(22.9);
    expect(calculateBodyMassIndex(0, 175)).toBeNull();
  });

  it('maps gender and resolves reference ranges', () => {
    expect(getGender('M', t)).toBe('Male');
    expect(getGender('F', t)).toBe('Female');
    expect(getGender('X', t)).toBe('X');
    expect(getReferenceRangesForConcept('systolic', metadata)).toEqual(metadata[0]);
    expect(getReferenceRangesForConcept('missing', metadata)).toBeUndefined();
  });

  it('interprets lab values and blood pressure severity correctly', () => {
    expect(assessValue(181, metadata[0])).toBe('critically_high');
    expect(assessValue(141, metadata[0])).toBe('high');
    expect(assessValue(69, metadata[0])).toBe('critically_low');
    expect(assessValue(89, metadata[0])).toBe('low');
    expect(assessValue(120, metadata[0])).toBe('normal');

    expect(
      interpretBloodPressure(
        185,
        80,
        { systolicBloodPressureUuid: 'systolic', diastolicBloodPressureUuid: 'diastolic' },
        metadata,
      ),
    ).toBe('critically_high');

    expect(
      interpretBloodPressure(
        120,
        95,
        { systolicBloodPressureUuid: 'systolic', diastolicBloodPressureUuid: 'diastolic' },
        metadata,
      ),
    ).toBe('high');

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
