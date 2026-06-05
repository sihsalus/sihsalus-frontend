/**
 * Type definitions for the Emergency Workflow workspace.
 */

/** Steps in the emergency intake workflow (patient registration → queue confirmation). */
export enum WorkflowStep {
  /** Patient search, registration, and initial classification */
  REGISTRO = 'registro',
  /** Summary confirmation before sending patient to queue */
  CONFIRMACION = 'confirmacion',
}

/** Patient data returned from the search endpoint, used throughout the workflow. */
export interface SearchedPatient {
  uuid: string;
  display: string;
  identifiers?: Array<{
    uuid: string;
    identifier: string;
    identifierType?: {
      uuid: string;
      display: string;
    };
  }>;
  person?: {
    age?: number;
    gender?: string;
    birthdate?: string;
    birthdateEstimated?: boolean;
    display?: string;
    personName?: {
      givenName: string;
      middleName?: string;
      familyName: string;
      familyName2?: string;
      display?: string;
    };
  };
  emergencyRegistrationContext?: {
    arrivalDateTime?: string;
    communicationCondition?: string;
    identificationStatus?: string;
    responsibleType?: string;
    companionName?: string;
    companionRelationship?: string;
    administrativeNotes?: string;
  };
}

/** Pre-triage classification: 'emergency' skips triage (direct to attention), 'urgency' goes to triage queue. */
export type InitialClassification = 'emergency' | 'urgency';

/** Internal state of the emergency workflow workspace across all steps. */
export interface WorkflowState {
  currentStep: WorkflowStep;
  patientUuid?: string;
  patientData?: SearchedPatient;
  visitUuid?: string;
  priorityUuid?: string;
  queueEntryUuid?: string;
  initialClassification?: InitialClassification;
}
