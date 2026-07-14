import { type OpenmrsResource } from '@openmrs/esm-framework/src/internal';
import type { AttachmentFieldValue, PatientIdentifier } from './domain';
import {
  type Attachment,
  type Diagnosis,
  type DiagnosisPayload,
  type OpenmrsEncounter,
  type OpenmrsObs,
  type Order,
  type PersonAttribute,
  type ProgramState,
} from './domain';

export interface FormFieldSubmissionValue extends Record<string, unknown> {
  uuid?: string;
  obsDatetime?: string | Date;
  comment?: string;
}

export type FormFieldValue =
  | FormFieldSubmissionValue
  | AttachmentFieldValue
  | Diagnosis
  | DiagnosisPayload
  | OpenmrsObs
  | Order
  | PatientIdentifier
  | PersonAttribute
  | string
  | number
  | boolean
  | Date
  | null
  | Array<
      | string
      | number
      | boolean
      | Date
      | FormFieldSubmissionValue
      | AttachmentFieldValue
      | Attachment
      | OpenmrsObs
      | Order
    >;

export interface FormSchema {
  name: string;
  pages: Array<FormPage>;
  processor: string;
  uuid: string;
  referencedForms: Array<ReferencedForm>;
  encounterType: string;
  encounter?: string | OpenmrsEncounter;
  defaultEncounterDatetime?: string | Date;
  allowUnspecifiedAll?: boolean;
  defaultPage?: string;
  readonly?: string | boolean;
  inlineRendering?: 'single-line' | 'multiline' | 'automatic';
  markdown?: MarkdownConfig;
  availableIntents?: Array<FormIntentConfig | string>;
  postSubmissionActions?: Array<{ actionId: string; enabled?: string; config?: Record<string, unknown> }>;
  formOptions?: {
    usePreviousValueDisabled: boolean;
  };
  version?: string;
  translations?: Record<string, string>;
  meta?: {
    programs?: {
      hasProgramFields?: boolean;
      uuid?: string;
      isEnrollment?: boolean;
      discontinuationDateQuestionId?: string;
      [anythingElse: string]: unknown;
    };
  };
}

export interface FormPage {
  label: string;
  isHidden?: boolean;
  hide?: HideProps;
  sections: Array<FormSection>;
  isSubform?: boolean;
  inlineRendering?: 'single-line' | 'multiline' | 'automatic';
  readonly?: string | boolean;
  behaviours?: Array<PageOrSectionBehaviour>;
  markdown?: MarkdownConfig;
  subform?: {
    name?: string;
    package?: string;
    behaviours?: Array<SubformBehaviour>;
    form: Omit<FormSchema, 'postSubmissionActions'>;
  };
  id?: string;
}

export interface FormSection {
  hide?: HideProps;
  label: string;
  isExpanded: string;
  isHidden?: boolean;
  isParentHidden?: boolean;
  questions: Array<FormField>;
  inlineRendering?: 'single-line' | 'multiline' | 'automatic';
  readonly?: string | boolean;
  behaviours?: Array<PageOrSectionBehaviour>;
  markdown?: MarkdownConfig;
  reference?: FormReference;
}

export interface FormField {
  label?: string;
  type: string;
  questionOptions: FormQuestionOptions;
  datePickerFormat?: 'both' | 'calendar' | 'timer';
  id: string;
  questions?: Array<FormField>;
  value?: FormFieldValue;
  hide?: HideProps;
  isHidden?: boolean;
  isParentHidden?: boolean;
  fieldDependents?: Set<string>;
  pageDependents?: Set<string>;
  sectionDependents?: Set<string>;
  isRequired?: boolean;
  required?: string | boolean | RequiredFieldProps;
  unspecified?: boolean;
  isDisabled?: boolean;
  disabled?: boolean | Omit<DisableProps, 'isDisabled'>;
  readonly?: string | boolean;
  isReadonly?: boolean;
  inlineRendering?: 'single-line' | 'multiline' | 'automatic';
  validators?: Array<FormFieldValidatorDefinition>;
  behaviours?: Array<QuestionBehaviour>;
  questionInfo?: string;
  historicalExpression?: string;
  constrainMaxWidth?: boolean;
  hideSteppers?: boolean;
  /** @deprecated */
  inlineMultiCheckbox?: boolean;
  meta?: QuestionMetaProps;
}

export interface HideProps {
  hideWhenExpression: string;
}

export interface DisableProps {
  disableWhenExpression?: string;
  isDisabled?: boolean;
}

export interface RequiredFieldProps {
  type: string;
  message?: string;
  referenceQuestionId: string;
  referenceQuestionAnswers: Array<string>;
}

export interface RepeatOptions {
  addText?: string;
  limit?: string;
  limitExpression?: string;
}

export interface QuestionMetaProps {
  concept?: OpenmrsResource;
  initialValue?: {
    omrsObject:
      | OpenmrsObs
      | OpenmrsResource
      | Diagnosis
      | DiagnosisPayload
      | ProgramState
      | Order
      | string
      | Date
      | null
      | Array<OpenmrsObs | OpenmrsResource | Diagnosis | DiagnosisPayload | ProgramState | Order>;
    refinedValue?: FormFieldValue;
  };
  submission?: {
    voidedValue?: FormFieldValue;
    newValue?: FormFieldValue;
    unspecified?: boolean;
    errors?: Array<unknown>;
    warnings?: Array<unknown>;
  };
  repeat?: {
    isClone?: boolean;
    wasDeleted?: boolean;
  };
  groupId?: string;
  pageId?: string;
  [anythingElse: string]: unknown;
}

export interface FormQuestionOptions {
  extensionId?: string;
  extensionSlotName?: string;
  rendering: RenderType;
  concept?: string;
  /**
   * max and min are used to validate number field values
   */
  max?: string;
  min?: string;
  /**
   * specifies the increment or decrement step for number field values
   */
  step?: number;
  /**
   * @description
   * Indicates whether the field is transient.
   * - Transient fields are ignored on form submission.
   * - If set to __true__, the field is omitted from the O3 Form in `embedded-view` mode.
   * @default false
   */
  isTransient?: boolean;
  /**
   * maxLength and maxLength are used to validate text field length
   */
  maxLength?: string;
  minLength?: string;
  showDate?: string;
  shownDateOptions?: { validators?: Array<FormFieldValidatorDefinition>; hide?: { hideWhenExpression: string } };
  answers?: Array<QuestionAnswerOption>;
  weeksList?: string;
  locationTag?: string;
  disallowDecimals?: boolean;
  rows?: number;
  toggleOptions?: { labelTrue: string; labelFalse: string };
  repeatOptions?: RepeatOptions;
  defaultValue?: FormFieldValue;
  calculate?: {
    calculateExpression: string;
  };
  isDateTime?: { labelTrue: boolean; labelFalse: boolean };
  enablePreviousValue?: boolean;
  allowedFileTypes?: Array<string>;
  allowMultiple?: boolean;
  datasource?: { name: string; config?: Record<string, unknown> };
  /**
   * Determines if the ui-select-extended rendering is searchable
   */
  isSearchable?: boolean;
  /**
   * Determines if the checkbox rendering is searchable
   */
  isCheckboxSearchable?: boolean;
  workspaceName?: string;
  workspaceProps?: Record<string, unknown>;
  buttonLabel?: string;
  identifierType?: string;
  attributeType?: string;
  orderSettingUuid?: string;
  orderType?: string;
  selectableOrders?: Array<Record<string, unknown>>;
  programUuid?: string;
  workflowUuid?: string;
  showComment?: boolean;
  comment?: string;
  orientation?: 'vertical' | 'horizontal';
  shownCommentOptions?: { validators?: Array<FormFieldValidatorDefinition>; hide?: { hideWhenExpression: string } };
  diagnosis?: {
    rank?: number;
    isConfirmed?: boolean;
    conceptClasses?: Array<string>;
    conceptSet?: string;
  };
}

export interface QuestionAnswerOption {
  hide?: HideProps;
  disable?: DisableProps;
  label?: string;
  concept?: string;
  [key: string]: unknown;
}

export interface FormIntentConfig {
  intent: string;
  defaultPage?: string;
}

export interface BehaviourIntentBase {
  intent: string;
}

export interface PageOrSectionBehaviour extends BehaviourIntentBase {
  hide?: HideProps;
  readonly?: string | boolean;
}

export interface SubformBehaviour extends BehaviourIntentBase {
  readonly?: string | boolean;
  subform_intent?: string;
}

export interface QuestionBehaviour extends BehaviourIntentBase {
  defaultValue?: FormFieldValue;
  hide?: HideProps | boolean;
  readonly?: string | boolean;
  [key: string]: unknown;
}

export interface MarkdownBehaviour extends BehaviourIntentBase {
  [key: string]: unknown;
}

export interface MarkdownConfig {
  behaviours?: Array<MarkdownBehaviour>;
  [key: string]: unknown;
}

export interface FormFieldValidatorDefinition {
  type: string;
  message?: string;
  referenceQuestionId?: string;
  referenceQuestionAnswers?: Array<string>;
  allowFutureDates?: string | boolean;
  [key: string]: unknown;
}

export type RenderType =
  | 'checkbox'
  | 'checkbox-searchable'
  | 'content-switcher'
  | 'date'
  | 'datetime'
  | 'drug'
  | 'encounter-location'
  | 'encounter-provider'
  | 'encounter-role'
  | 'fixed-value'
  | 'file'
  | 'group'
  | 'number'
  | 'problem'
  | 'radio'
  | 'repeating'
  | 'select'
  | 'text'
  | 'textarea'
  | 'toggle'
  | 'ui-select-extended'
  | 'workspace-launcher'
  | 'markdown'
  | 'extension-widget'
  | 'select-concept-answers';

export interface FormReference {
  form: string;
  page: string;
  section: string;
  excludeQuestions?: Array<string>;
}

export interface ReferencedForm {
  formName: string;
  alias: string;
}

export type FormExpanded = boolean | undefined;
