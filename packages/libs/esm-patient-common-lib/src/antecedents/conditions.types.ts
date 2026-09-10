import type { AntecedentTypeCode } from './antecedent-types';

/** OpenMRS REST v=full. Retain the actual source rather than reconstructing it from display fields. */
export interface OpenmrsCondition {
  uuid: string;
  patient: { uuid: string; [key: string]: unknown };
  condition: {
    coded?: { uuid: string; display?: string; [key: string]: unknown } | null;
    nonCoded?: string | null;
    specificName?: { uuid: string; display?: string; [key: string]: unknown } | null;
    [key: string]: unknown;
  };
  clinicalStatus: string;
  verificationStatus?: string | null;
  onsetDate?: string | null;
  endDate?: string | null;
  additionalDetail?: string | null;
  auditInfo?: { dateCreated?: string; [key: string]: unknown };
  previousVersion?: { uuid: string; [key: string]: unknown } | null;
  voided: boolean;
  [key: string]: unknown;
}

export interface Condition {
  id: string;
  clinicalStatus: string;
  conceptId: string;
  display: string;
  recordedDate?: string;
  onsetDateTime?: string;
  abatementDateTime?: string;
  antecedentType?: AntecedentTypeCode;
  categoryText?: string;
  noteText?: string;
  nonCodedText?: string;
  source: OpenmrsCondition;
}

export interface CodedCondition {
  display: string;
  uuid: string;
}

export interface FormFields {
  clinicalStatus: string;
  conceptId: string;
  display: string;
  patientId: string;
  providerUuid: string;
  onsetDateTime?: string | null;
  abatementDateTime?: string | null;
  recordedDate?: string;
  antecedentType?: AntecedentTypeCode | string;
  /** Legacy form alias; normalized at the shared boundary. */
  category?: string;
  note?: string;
  nonCodedText?: string;
  originalCondition?: OpenmrsCondition;
}
