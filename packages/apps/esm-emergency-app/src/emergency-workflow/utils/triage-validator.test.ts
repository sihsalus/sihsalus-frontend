import type { TriageVitals } from './priority-calculator';
import { REQUIRED_TRIAGE_VITALS, validateTriageComplete } from './triage-validator';

const completeVitals: TriageVitals = {
  respiratoryRate: 16,
  oxygenSaturation: 98,
  systolicBp: 120,
  heartRate: 70,
  temperature: 37,
};

describe('validateTriageComplete', () => {
  it('is complete when every required vital sign is present', () => {
    const result = validateTriageComplete(completeVitals);
    expect(result.isComplete).toBe(true);
    expect(result.missingFields).toEqual([]);
  });

  it('ignores optional fields that are not required for completeness', () => {
    const result = validateTriageComplete({ ...completeVitals, consciousness: 'A', glasgowComaScale: 15 });
    expect(result.isComplete).toBe(true);
  });

  it('reports every missing required vital sign', () => {
    const result = validateTriageComplete({ heartRate: 70, temperature: 37 });
    expect(result.isComplete).toBe(false);
    expect(result.missingFields).toEqual(['respiratoryRate', 'oxygenSaturation', 'systolicBp']);
  });

  it('treats undefined, NaN and infinite values as missing', () => {
    const result = validateTriageComplete({
      ...completeVitals,
      respiratoryRate: undefined,
      oxygenSaturation: Number.NaN,
      systolicBp: Number.POSITIVE_INFINITY,
    });
    expect(result.isComplete).toBe(false);
    expect(result.missingFields).toEqual(['respiratoryRate', 'oxygenSaturation', 'systolicBp']);
  });

  it('accepts zero as a usable (if clinically extreme) value', () => {
    const result = validateTriageComplete({ ...completeVitals, heartRate: 0 });
    expect(result.missingFields).not.toContain('heartRate');
  });

  it('flags an empty triage as missing all required vitals', () => {
    const result = validateTriageComplete({});
    expect(result.isComplete).toBe(false);
    expect(result.missingFields).toEqual([...REQUIRED_TRIAGE_VITALS]);
  });
});
