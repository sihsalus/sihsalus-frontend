/**
 * Emergency Workflow Utilities
 *
 * Utility functions for the emergency workflow:
 * - Priority calculation based on vital signs (NEWS2 → Peruvian triage priority)
 * - Triage completeness validation
 */

export {
  type Acvpu,
  calculateTriagePriority,
  type RiskBand,
  scoreConsciousness,
  scoreHeartRate,
  scoreOxygenSaturation,
  scoreRespiratoryRate,
  scoreSystolicBp,
  scoreTemperature,
  type TriagePriority,
  type TriagePriorityResult,
  type TriageVitals,
  toRiskBand,
} from './priority-calculator';
export {
  REQUIRED_TRIAGE_VITALS,
  type RequiredTriageVital,
  type TriageValidationResult,
  validateTriageComplete,
} from './triage-validator';
