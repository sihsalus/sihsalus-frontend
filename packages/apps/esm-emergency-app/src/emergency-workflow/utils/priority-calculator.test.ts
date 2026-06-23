import {
  calculateTriagePriority,
  scoreConsciousness,
  scoreHeartRate,
  scoreOxygenSaturation,
  scoreRespiratoryRate,
  scoreSystolicBp,
  scoreTemperature,
  type TriageVitals,
  toRiskBand,
} from './priority-calculator';

/** A patient whose every vital sign is squarely within the NEWS2 normal range. */
const normalVitals: TriageVitals = {
  respiratoryRate: 16,
  oxygenSaturation: 98,
  systolicBp: 120,
  heartRate: 70,
  temperature: 37,
  consciousness: 'A',
};

describe('NEWS2 per-parameter scoring', () => {
  it('scores respiratory rate by band', () => {
    expect(scoreRespiratoryRate(8)).toBe(3);
    expect(scoreRespiratoryRate(9)).toBe(1);
    expect(scoreRespiratoryRate(11)).toBe(1);
    expect(scoreRespiratoryRate(12)).toBe(0);
    expect(scoreRespiratoryRate(20)).toBe(0);
    expect(scoreRespiratoryRate(21)).toBe(2);
    expect(scoreRespiratoryRate(24)).toBe(2);
    expect(scoreRespiratoryRate(25)).toBe(3);
  });

  it('scores oxygen saturation by band', () => {
    expect(scoreOxygenSaturation(91)).toBe(3);
    expect(scoreOxygenSaturation(92)).toBe(2);
    expect(scoreOxygenSaturation(93)).toBe(2);
    expect(scoreOxygenSaturation(94)).toBe(1);
    expect(scoreOxygenSaturation(95)).toBe(1);
    expect(scoreOxygenSaturation(96)).toBe(0);
    expect(scoreOxygenSaturation(100)).toBe(0);
  });

  it('scores systolic blood pressure by band', () => {
    expect(scoreSystolicBp(90)).toBe(3);
    expect(scoreSystolicBp(91)).toBe(2);
    expect(scoreSystolicBp(100)).toBe(2);
    expect(scoreSystolicBp(101)).toBe(1);
    expect(scoreSystolicBp(110)).toBe(1);
    expect(scoreSystolicBp(111)).toBe(0);
    expect(scoreSystolicBp(219)).toBe(0);
    expect(scoreSystolicBp(220)).toBe(3);
  });

  it('scores heart rate by band', () => {
    expect(scoreHeartRate(40)).toBe(3);
    expect(scoreHeartRate(41)).toBe(1);
    expect(scoreHeartRate(50)).toBe(1);
    expect(scoreHeartRate(51)).toBe(0);
    expect(scoreHeartRate(90)).toBe(0);
    expect(scoreHeartRate(91)).toBe(1);
    expect(scoreHeartRate(110)).toBe(1);
    expect(scoreHeartRate(111)).toBe(2);
    expect(scoreHeartRate(130)).toBe(2);
    expect(scoreHeartRate(131)).toBe(3);
  });

  it('scores temperature by band', () => {
    expect(scoreTemperature(35)).toBe(3);
    expect(scoreTemperature(35.1)).toBe(1);
    expect(scoreTemperature(36)).toBe(1);
    expect(scoreTemperature(36.1)).toBe(0);
    expect(scoreTemperature(38)).toBe(0);
    expect(scoreTemperature(38.1)).toBe(1);
    expect(scoreTemperature(39)).toBe(1);
    expect(scoreTemperature(39.1)).toBe(2);
  });

  it('scores consciousness: alert is 0, everything else is 3', () => {
    expect(scoreConsciousness('A')).toBe(0);
    expect(scoreConsciousness('C')).toBe(3);
    expect(scoreConsciousness('V')).toBe(3);
    expect(scoreConsciousness('P')).toBe(3);
    expect(scoreConsciousness('U')).toBe(3);
  });
});

describe('toRiskBand', () => {
  it('maps aggregate scores to NEWS2 risk bands', () => {
    expect(toRiskBand(0, false)).toBe('low');
    expect(toRiskBand(4, false)).toBe('low');
    expect(toRiskBand(2, true)).toBe('low-medium');
    expect(toRiskBand(5, false)).toBe('medium');
    expect(toRiskBand(6, false)).toBe('medium');
    expect(toRiskBand(7, false)).toBe('high');
  });
});

describe('calculateTriagePriority', () => {
  it('assigns Priority IV when all vitals are normal (score 0)', () => {
    const result = calculateTriagePriority(normalVitals);
    expect(result.news2Score).toBe(0);
    expect(result.riskBand).toBe('low');
    expect(result.hasRedFlag).toBe(false);
    expect(result.priority).toBe('IV');
  });

  it('assigns Priority III for a minor, non-critical deviation', () => {
    // Temperature 38.5 °C → 1 point, nothing else abnormal.
    const result = calculateTriagePriority({ ...normalVitals, temperature: 38.5 });
    expect(result.news2Score).toBe(1);
    expect(result.priority).toBe('III');
  });

  it('escalates to Priority II when a single parameter scores 3 (red flag)', () => {
    // Respiratory rate 26 → 3 points (total 3, low-medium band).
    const result = calculateTriagePriority({ ...normalVitals, respiratoryRate: 26 });
    expect(result.hasRedFlag).toBe(true);
    expect(result.riskBand).toBe('low-medium');
    expect(result.priority).toBe('II');
  });

  it('assigns Priority II for a medium NEWS2 band (5–6)', () => {
    // RR 22 (2) + SpO2 93 (2) + HR 105 (1) = 5, no single param scores 3.
    const result = calculateTriagePriority({
      ...normalVitals,
      respiratoryRate: 22,
      oxygenSaturation: 93,
      heartRate: 105,
    });
    expect(result.news2Score).toBe(5);
    expect(result.hasRedFlag).toBe(false);
    expect(result.riskBand).toBe('medium');
    expect(result.priority).toBe('II');
  });

  it('assigns Priority I for a high NEWS2 band (≥7)', () => {
    // RR 26 (3) + SpO2 90 (3) + HR 132 (3) = 9.
    const result = calculateTriagePriority({
      ...normalVitals,
      respiratoryRate: 26,
      oxygenSaturation: 90,
      heartRate: 132,
    });
    expect(result.news2Score).toBeGreaterThanOrEqual(7);
    expect(result.riskBand).toBe('high');
    expect(result.priority).toBe('I');
  });

  it('adds 2 points when the patient is on supplemental oxygen', () => {
    const onAir = calculateTriagePriority({ ...normalVitals, oxygenSaturation: 94 });
    const onOxygen = calculateTriagePriority({ ...normalVitals, oxygenSaturation: 94, onSupplementalOxygen: true });
    expect(onOxygen.news2Score).toBe(onAir.news2Score + 2);
  });

  describe('consciousness overrides (comatose / unidentified patient flow)', () => {
    it('forces Priority I when the Glasgow Coma Scale is ≤ 8', () => {
      const result = calculateTriagePriority({ ...normalVitals, glasgowComaScale: 6 });
      expect(result.priority).toBe('I');
    });

    it('forces Priority I when the patient is unresponsive (ACVPU = U)', () => {
      const result = calculateTriagePriority({ ...normalVitals, consciousness: 'U' });
      expect(result.priority).toBe('I');
    });

    it('escalates to at least Priority II for impaired consciousness (ACVPU = V/P/C)', () => {
      for (const acvpu of ['C', 'V', 'P'] as const) {
        expect(calculateTriagePriority({ ...normalVitals, consciousness: acvpu }).priority).toBe('II');
      }
    });

    it('escalates to Priority II for a moderately depressed GCS (9–12)', () => {
      const result = calculateTriagePriority({ ...normalVitals, glasgowComaScale: 11 });
      expect(result.priority).toBe('II');
    });

    it('does not escalate for a normal GCS (13–15)', () => {
      const result = calculateTriagePriority({ ...normalVitals, glasgowComaScale: 15 });
      expect(result.priority).toBe('IV');
    });
  });

  it('only includes provided parameters in the breakdown', () => {
    const result = calculateTriagePriority({ heartRate: 70, temperature: 37 });
    expect(Object.keys(result.breakdown).sort()).toEqual(['heartRate', 'temperature']);
  });
});
