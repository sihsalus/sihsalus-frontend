import { calculateBodyMassIndex, getMuacColorCode } from './vitals-biometrics-form.utils';

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
