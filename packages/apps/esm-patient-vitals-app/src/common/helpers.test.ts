import { assessValue } from './helpers';

describe('assessValue', () => {
  it('treats zero as a valid value when evaluating ranges', () => {
    expect(
      assessValue(0, {
        hiNormal: 10,
        hiAbsolute: 20,
        hiCritical: 15,
        lowNormal: 1,
        lowAbsolute: 0,
        lowCritical: 0,
      }),
    ).toBe('critically_low');
  });

  it('never marks a value inside the normal range as critical', () => {
    // SpO2-style range where the critical threshold overlaps the normal maximum
    const spo2Range = {
      hiNormal: 100,
      hiAbsolute: 100,
      hiCritical: 100,
      lowNormal: 95,
      lowAbsolute: 0,
      lowCritical: 90,
    };

    expect(assessValue(100, spo2Range)).toBe('normal');
    expect(assessValue(96, spo2Range)).toBe('normal');
    expect(assessValue(92, spo2Range)).toBe('low');
    expect(assessValue(90, spo2Range)).toBe('critically_low');
  });

  it('still marks values at or above a critical threshold outside the normal range', () => {
    const temperatureRange = {
      hiNormal: 37.5,
      hiAbsolute: 43,
      hiCritical: 40,
      lowNormal: 36,
      lowAbsolute: 25,
      lowCritical: 35,
    };

    expect(assessValue(40, temperatureRange)).toBe('critically_high');
    expect(assessValue(38, temperatureRange)).toBe('high');
    expect(assessValue(37, temperatureRange)).toBe('normal');
  });
});
