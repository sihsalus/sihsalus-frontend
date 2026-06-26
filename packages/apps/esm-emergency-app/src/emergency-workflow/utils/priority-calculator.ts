/**
 * Triage priority calculator.
 *
 * Derives the formal Peruvian emergency triage priority (I–IV) from the vital
 * signs captured during triage. The aggregate deterioration score follows the
 * National Early Warning Score 2 (NEWS2, Royal College of Physicians, 2017),
 * which publishes explicit per-parameter thresholds. The NEWS2 risk bands are
 * then mapped to the four priority levels of the Peruvian "Norma Técnica de
 * Salud de los Servicios de Emergencia":
 *
 *   - Prioridad I   — gravedad súbita extrema / resucitación
 *   - Prioridad II  — urgencia mayor
 *   - Prioridad III — urgencia menor
 *   - Prioridad IV  — patología aguda común
 *
 * The Glasgow Coma Scale and the ACVPU level of consciousness (captured for
 * unconscious / comatose patients via the `emergency-triage` vitals profile)
 * override the aggregate score when consciousness is compromised, since a
 * depressed GCS implies an airway-at-risk emergency.
 *
 * Source: Royal College of Physicians, National Early Warning Score (NEWS) 2,
 * 2017 — https://www.rcp.ac.uk/improving-care/resources/national-early-warning-score-news-2/
 */

/** Peruvian emergency triage priority levels. */
export type TriagePriority = 'I' | 'II' | 'III' | 'IV';

/** Level of consciousness on the ACVPU scale (Alert, Confusion, Voice, Pain, Unresponsive). */
export type Acvpu = 'A' | 'C' | 'V' | 'P' | 'U';

/** NEWS2 aggregate clinical-risk band. */
export type RiskBand = 'low' | 'low-medium' | 'medium' | 'high';

/** Vital signs used to compute the triage priority. All fields are optional so the
 * calculator can run on a partially-captured triage; use {@link validateTriageComplete}
 * to enforce completeness. */
export interface TriageVitals {
  /** Breaths per minute. */
  respiratoryRate?: number;
  /** Peripheral oxygen saturation, percent (SpO2 — NEWS2 Scale 1). */
  oxygenSaturation?: number;
  /** Whether the patient is receiving supplemental oxygen (adds 2 to the NEWS2 score). */
  onSupplementalOxygen?: boolean;
  /** Systolic blood pressure, mmHg. */
  systolicBp?: number;
  /** Heart rate / pulse, beats per minute. */
  heartRate?: number;
  /** Temperature, degrees Celsius. */
  temperature?: number;
  /** Level of consciousness on the ACVPU scale. Treated as alert when omitted. */
  consciousness?: Acvpu;
  /** Glasgow Coma Scale total (3–15), captured for unresponsive patients. */
  glasgowComaScale?: number;
}

/** Result of a triage priority computation. */
export interface TriagePriorityResult {
  /** Computed Peruvian triage priority. */
  priority: TriagePriority;
  /** Aggregate NEWS2 score across the provided parameters. */
  news2Score: number;
  /** NEWS2 clinical-risk band. */
  riskBand: RiskBand;
  /** Per-parameter NEWS2 sub-scores (only for parameters that were provided). */
  breakdown: Partial<Record<keyof TriageVitals, number>>;
  /** Whether any single parameter scored the NEWS2 maximum of 3. */
  hasRedFlag: boolean;
}

/** NEWS2 sub-score for respiratory rate (breaths/min). */
export function scoreRespiratoryRate(rate: number): number {
  if (rate <= 8) return 3;
  if (rate <= 11) return 1;
  if (rate <= 20) return 0;
  if (rate <= 24) return 2;
  return 3;
}

/** NEWS2 sub-score for oxygen saturation (SpO2 Scale 1, %). */
export function scoreOxygenSaturation(spo2: number): number {
  if (spo2 <= 91) return 3;
  if (spo2 <= 93) return 2;
  if (spo2 <= 95) return 1;
  return 0;
}

/** NEWS2 sub-score for systolic blood pressure (mmHg). */
export function scoreSystolicBp(systolic: number): number {
  if (systolic <= 90) return 3;
  if (systolic <= 100) return 2;
  if (systolic <= 110) return 1;
  if (systolic <= 219) return 0;
  return 3;
}

/** NEWS2 sub-score for heart rate / pulse (beats/min). */
export function scoreHeartRate(rate: number): number {
  if (rate <= 40) return 3;
  if (rate <= 50) return 1;
  if (rate <= 90) return 0;
  if (rate <= 110) return 1;
  if (rate <= 130) return 2;
  return 3;
}

/** NEWS2 sub-score for temperature (°C). */
export function scoreTemperature(celsius: number): number {
  if (celsius <= 35.0) return 3;
  if (celsius <= 36.0) return 1;
  if (celsius <= 38.0) return 0;
  if (celsius <= 39.0) return 1;
  return 2;
}

/** NEWS2 sub-score for the ACVPU level of consciousness. Anything other than alert scores 3. */
export function scoreConsciousness(acvpu: Acvpu): number {
  return acvpu === 'A' ? 0 : 3;
}

/** Maps a NEWS2 aggregate score (and single-parameter red flag) to its clinical-risk band. */
export function toRiskBand(news2Score: number, hasRedFlag: boolean): RiskBand {
  if (news2Score >= 7) return 'high';
  if (news2Score >= 5) return 'medium';
  if (hasRedFlag) return 'low-medium';
  return 'low';
}

/**
 * Computes the suggested triage priority from a set of vital signs.
 *
 * The result is advisory: the triage nurse remains responsible for the final
 * priority. Consciousness emergencies (GCS ≤ 8 or ACVPU = Unresponsive) always
 * resolve to Priority I regardless of the aggregate score.
 */
export function calculateTriagePriority(vitals: TriageVitals): TriagePriorityResult {
  const breakdown: Partial<Record<keyof TriageVitals, number>> = {};

  if (vitals.respiratoryRate != null) breakdown.respiratoryRate = scoreRespiratoryRate(vitals.respiratoryRate);
  if (vitals.oxygenSaturation != null) breakdown.oxygenSaturation = scoreOxygenSaturation(vitals.oxygenSaturation);
  if (vitals.systolicBp != null) breakdown.systolicBp = scoreSystolicBp(vitals.systolicBp);
  if (vitals.heartRate != null) breakdown.heartRate = scoreHeartRate(vitals.heartRate);
  if (vitals.temperature != null) breakdown.temperature = scoreTemperature(vitals.temperature);
  if (vitals.consciousness != null) breakdown.consciousness = scoreConsciousness(vitals.consciousness);

  const subScores = Object.values(breakdown);
  let news2Score = subScores.reduce((total, score) => total + (score ?? 0), 0);
  if (vitals.onSupplementalOxygen) news2Score += 2;

  const hasRedFlag = subScores.some((score) => score === 3);
  const riskBand = toRiskBand(news2Score, hasRedFlag);
  const priority = derivePriority({
    riskBand,
    hasRedFlag,
    news2Score,
    glasgowComaScale: vitals.glasgowComaScale,
    consciousness: vitals.consciousness,
  });

  return { priority, news2Score, riskBand, breakdown, hasRedFlag };
}

interface PriorityInput {
  riskBand: RiskBand;
  hasRedFlag: boolean;
  news2Score: number;
  glasgowComaScale?: number;
  consciousness?: Acvpu;
}

function derivePriority({
  riskBand,
  hasRedFlag,
  news2Score,
  glasgowComaScale,
  consciousness,
}: PriorityInput): TriagePriority {
  // Consciousness emergencies override the aggregate score (airway at risk).
  if (glasgowComaScale != null && glasgowComaScale <= 8) return 'I';
  if (consciousness === 'U') return 'I';
  if (riskBand === 'high') return 'I';

  // Moderate deterioration, a single critical parameter, or impaired consciousness.
  const impairedConsciousness = consciousness === 'C' || consciousness === 'V' || consciousness === 'P';
  if (
    riskBand === 'medium' ||
    hasRedFlag ||
    impairedConsciousness ||
    (glasgowComaScale != null && glasgowComaScale <= 12)
  ) {
    return 'II';
  }

  // Any deviation from normal that is not critical.
  if (news2Score >= 1) return 'III';

  // All parameters within normal range.
  return 'IV';
}
