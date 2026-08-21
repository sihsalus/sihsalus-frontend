import { type Encounter, type Visit } from '@openmrs/esm-framework';
import { type DefaultWorkspaceProps, type Workspace2DefinitionProps } from '@openmrs/esm-styleguide';

import { type HtmlFormEntryForm } from '../types';

export interface FormEntryEncounterResource {
  uuid: string;
  display?: string;
}

export interface FormEntryEncounterObservation extends FormEntryEncounterResource {
  concept?: FormEntryEncounterResource | { uuid?: string; display?: string } | string;
  obsDatetime?: string | Date;
  obsGroup?: FormEntryEncounterObservation;
  groupMembers?: Array<FormEntryEncounterObservation>;
  comment?: string;
  location?: FormEntryEncounterResource;
  order?: FormEntryEncounterResource;
  encounter?: FormEntryEncounterResource;
  voided?: boolean;
  value?: unknown;
  formFieldPath?: string;
  formFieldNamespace?: string;
  status?: string;
  interpretation?: string;
}

export interface FormEntryEncounterOrder {
  concept: string;
  orderer: string;
  uuid?: string;
  formFieldPath?: string;
  type?: string;
  action?: string;
  urgency?: string;
  dateActivated?: string;
  careSetting?: string;
  groupMembers?: Array<FormEntryEncounterOrder>;
  encounter?: string;
  patient?: string;
  orderNumber?: string;
  voided?: boolean;
}

interface FormEntryEncounterForm extends FormEntryEncounterResource {
  dataType?: string;
  valueReference?: string;
}

interface FormEntryEncounterDiagnosisPayload {
  patient: string;
  condition: null;
  diagnosis: {
    coded: string;
  };
  certainty: string;
  rank: number;
  formFieldNamespace?: string;
  formFieldPath?: string;
  uuid?: string;
  encounter?: string;
}

interface FormEntryEncounterDiagnosis {
  encounter: string;
  patient: string;
  diagnosis: {
    coded: {
      uuid: string;
    };
  };
  certainty: string;
  rank: number;
  display: string;
  voided: boolean;
  uuid: string;
  formFieldNamespace?: string;
  formFieldPath?: string;
}

/**
 * Structural encounter draft exchanged with form-entry callbacks.
 *
 * This contract intentionally lives outside the form engine so consumers can
 * customize encounter payloads without coupling patient-common to a renderer.
 */
export interface FormEntryEncounter {
  uuid?: string;
  encounterDatetime?: string | Date;
  patient?: FormEntryEncounterResource | string;
  location?: FormEntryEncounterResource | string;
  encounterType?: FormEntryEncounterResource | string;
  obs?: Array<FormEntryEncounterObservation>;
  orders?: Array<FormEntryEncounterOrder>;
  voided?: boolean;
  visit?: FormEntryEncounterResource | string;
  encounterProviders?: Array<{
    provider: FormEntryEncounterResource | string;
    encounterRole: FormEntryEncounterResource | string;
  }>;
  form?: FormEntryEncounterForm;
  diagnoses?: Array<FormEntryEncounterDiagnosis | FormEntryEncounterDiagnosisPayload>;
}

export interface FormEntryProps {
  encounterUuid?: string;
  visitUuid?: string;
  formUuid: string;
  visitTypeUuid?: string;
  visitStartDatetime?: string;
  visitStopDatetime?: string;
  htmlForm?: HtmlFormEntryForm;
  preFilledQuestions?: Record<string, string | number | Date | boolean | Array<string>>;
  additionalProps?: Record<string, unknown>;
}

export interface FormRendererProps {
  additionalProps?: Record<string, unknown>;
  encounterUuid?: string;
  formUuid: string;
  patientUuid: string;
  patient: fhir.Patient;
  visit?: Visit;
  visitUuid?: string;
  hideControls?: boolean;
  hidePatientBanner?: boolean;
  handlePostResponse?: (encounter?: Encounter) => void;
  handleEncounterCreate?: (
    encounter: FormEntryEncounter,
  ) => FormEntryEncounter | void | Promise<FormEntryEncounter | void>;
  onBeforeEncounterSave?: (encounter: FormEntryEncounter) => void | Promise<void>;
  handleOnValidate?: (valid: boolean) => void;
  showDiscardSubmitButtons?: boolean;
  preFilledQuestions?: Record<string, string | number | Date | boolean | Array<string>>;
  launchChildWorkspace?: Workspace2DefinitionProps['launchChildWorkspace'];
  closeWorkspace?: DefaultWorkspaceProps['closeWorkspace'];
  closeWorkspaceWithSavedChanges?: () => void;
  setHasUnsavedChanges?(hasUnsavedChanges: boolean): void;
}
