/**
 * Triage completeness validator.
 *
 * The Peruvian "Norma Técnica de Salud de los Servicios de Emergencia" requires
 * vital signs to be captured before a patient can be assigned a formal priority
 * and moved out of the triage queue. This module checks that the minimum set of
 * vital signs needed to compute a {@link TriagePriority} is present.
 */

import type { TriageVitals } from './priority-calculator';

/** Vital signs that must be captured for a triage to be considered complete. */
export const REQUIRED_TRIAGE_VITALS = [
  'respiratoryRate',
  'oxygenSaturation',
  'systolicBp',
  'heartRate',
  'temperature',
] as const satisfies ReadonlyArray<keyof TriageVitals>;

export type RequiredTriageVital = (typeof REQUIRED_TRIAGE_VITALS)[number];

/** Result of a triage completeness check. */
export interface TriageValidationResult {
  /** Whether every required vital sign has a usable value. */
  isComplete: boolean;
  /** Required vital signs that are missing or not a finite number. */
  missingFields: RequiredTriageVital[];
}

function hasUsableValue(value: number | undefined): boolean {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Validates that a triage captured every required vital sign.
 *
 * Returns the list of missing fields so the UI can prompt the nurse to complete
 * the triage before assigning a priority or releasing the patient from the queue.
 */
export function validateTriageComplete(vitals: TriageVitals): TriageValidationResult {
  const missingFields = REQUIRED_TRIAGE_VITALS.filter((field) => !hasUsableValue(vitals[field]));
  return { isComplete: missingFields.length === 0, missingFields };
}
