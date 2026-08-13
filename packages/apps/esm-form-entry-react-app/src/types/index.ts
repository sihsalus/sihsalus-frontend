import {
  type DefaultWorkspaceProps,
  type Encounter as FrameworkEncounter,
  type OpenmrsResource as FrameworkOpenmrsResource,
  type Visit,
} from '@openmrs/esm-framework';
import { type FormRendererProps as CanonicalFormWidgetProps } from '@openmrs/esm-patient-common-lib';
import { type OpenmrsEncounter, type PreFilledQuestions } from '@sihsalus/esm-form-engine-lib';

/**
 * Config interface matching the Angular app's configSchema exactly.
 */
export interface FormEntryReactConfig {
  /** @deprecated use customDataSources instead */
  dataSources: {
    /** @deprecated should be converted to customDataSource */
    monthlySchedule: boolean;
  };
  customDataSources: Array<{
    name: string;
    moduleName: string;
    moduleExport: string;
  }>;
  appointmentsResourceUrl: string;
  customEncounterDatetime: boolean;
}

/**
 * Legacy props passed to the form-widget-slot extension by older callers.
 * This matches the historical Angular-era contract and is adapted internally.
 */
export interface LegacyFormWidgetProps extends DefaultWorkspaceProps {
  formUuid: string;
  patientUuid: string;
  patient: fhir.Patient;
  view: string;
  visitUuid: string;
  visitTypeUuid?: string;
  visitStartDatetime: string;
  visitStopDatetime?: string;
  encounterUuid?: string;
  isOffline: boolean;
  additionalProps?: Record<string, unknown>;
  preFilledQuestions?: PreFilledQuestions;
  hideControls?: boolean;
  hidePatientBanner?: boolean;
  showDiscardSubmitButtons?: boolean;
  handlePostResponse?: (encounter?: FrameworkEncounter) => void;
  handleEncounterCreate?: (encounter: OpenmrsEncounter) => OpenmrsEncounter | void | Promise<OpenmrsEncounter | void>;
  onBeforeEncounterSave?: (encounter: OpenmrsEncounter) => void | Promise<void>;
  handleOnValidate?: (valid: boolean) => void;
  clinicalFormsWorkspaceName?: string;
}

/**
 * Canonical props passed to the form-widget-slot extension by v12-style callers.
 */
export interface CanonicalFormWidgetState extends CanonicalFormWidgetProps {
  clinicalFormsWorkspaceName?: string;
}

export type FormWidgetProps = CanonicalFormWidgetState | LegacyFormWidgetProps;

export interface NormalizedFormWidgetProps extends CanonicalFormWidgetState {
  visit?: Visit;
  visitStartDatetime?: string;
  visitStopDatetime?: string;
}

/**
 * Form state values for the global ampath-form-state store.
 */
export type FormState =
  | 'initial'
  | 'loading'
  | 'loadingError'
  | 'ready'
  | 'readyWithValidationErrors'
  | 'submitting'
  | 'submitted'
  | 'submissionError';

/** REST API types ported from the Angular app */

export interface OpenmrsResource extends FrameworkOpenmrsResource {
  links?: Array<{ rel: string; uri: string }>;
}

export interface Observation {
  uuid: string;
  concept: {
    uuid: string;
    display: string;
    conceptClass: { uuid: string; display: string };
  };
  display: string;
  groupMembers: null | Array<{
    uuid: string;
    concept: { uuid: string; display: string };
    value: { uuid: string; display: string };
  }>;
  value: unknown;
  obsDatetime: string;
}

export interface Order {
  uuid: string;
  dateActivated: string;
  dose: number;
  doseUnits: OpenmrsResource;
  orderNumber: number;
  display: string;
  drug: { uuid: string; name: string; strength: string };
  duration: number;
  durationUnits: OpenmrsResource;
  frequency: OpenmrsResource;
  numRefills: number;
  orderer: { uuid: string; person: { uuid: string; display: string } };
  orderType: OpenmrsResource;
  route: OpenmrsResource;
  auditInfo: { dateVoided: string };
}

export interface Diagnosis {
  uuid: string;
  display: string;
  diagnosis: { coded?: { uuid: string; display?: string }; nonCoded?: string };
  certainty: string;
  rank: number;
}

export interface Encounter {
  uuid: string;
  encounterDatetime: string;
  encounterProviders: Array<{
    uuid: string;
    display: string;
    encounterRole: OpenmrsResource;
    provider: { uuid: string; person: { uuid: string; display: string } };
  }>;
  encounterType: OpenmrsResource;
  visit?: { uuid: string; startDatetime: string; stopDatetime?: string };
  obs: Array<Observation>;
  orders: Array<Order>;
  diagnoses: Array<Diagnosis>;
  patient: OpenmrsResource;
  location: OpenmrsResource;
}

export interface EncounterCreate {
  uuid?: string;
  encounterDatetime: string;
  patient: string;
  encounterType: string;
  location: string;
  encounterProviders?: Array<{ uuid?: string; person: string; provider: string }>;
  obs?: Array<unknown>;
  orders?: Array<unknown>;
  diagnoses?: Array<unknown>;
  form?: string;
  visit?: string;
}

export interface PersonUpdate {
  uuid?: string;
  attributes: Array<{ attributeType: string; value: string }>;
}
