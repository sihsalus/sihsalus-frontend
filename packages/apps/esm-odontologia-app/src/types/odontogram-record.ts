import type { OdontogramData } from '../odontogram/types/odontogram';

/**
 * Domain types for the two-level odontogram model:
 *  - OdontogramBase   → records clinical findings (hallazgos)
 *  - OdontogramAttention → records clinical solutions (soluciones) per consultation
 */

export type OdontogramRecordType = 'base' | 'attention';

/**
 * Lightweight record representing a saved odontogram encounter.
 * Used to build the selector list in the dashboard.
 * Full OdontogramData is loaded on demand when the user opens the workspace.
 */
export interface OdontogramRecord {
  /** OpenMRS encounter UUID */
  encounterUuid: string;
  /** Whether this is the base odontogram or an attention odontogram */
  type: OdontogramRecordType;
  /** ISO datetime of the encounter */
  date: string;
  /** Display label, e.g. "Odontograma base" or "Atención – 14 abr 2026" */
  label: string;
  /** Full diagram snapshot saved by the custom UI through the AMPATH form contract. */
  data?: OdontogramData | null;
  /** Explicit parent base when the attention record was created from a base odontogram. */
  parentBaseEncounterUuid?: string | null;
}

/**
 * A base odontogram grouped together with all its linked attention odontograms.
 * Attentions are linked by chronological proximity: an attention belongs to the
 * most recent base that precedes it in time.
 */
export interface OdontogramBaseGroup {
  base: OdontogramRecord;
  attentions: OdontogramRecord[];
}
