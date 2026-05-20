import { type LayoutType } from '@openmrs/esm-framework/src/internal';
import dayjs from 'dayjs';
import { ConceptFalse, ConceptTrue } from '../constants';
import type {
  FHIRObsResource,
  FormField,
  FormPage,
  FormSchema,
  FormSection,
  OpenmrsObs,
  RenderType,
  SessionMode,
} from '../types';
import { isEmpty } from '../validators/form-validator';
import { parseToLocalDateTime } from './common-utils';
import { type EvaluateReturnType, type ExpressionContext, type FormNode } from './expression-runner';

interface ExpressionRunner {
  (
    expression: string | undefined,
    node: FormNode,
    allFields: FormField[],
    allValues: Record<string, unknown>,
    context: ExpressionContext,
  ): EvaluateReturnType;
}

function isFieldNode(node: FormNode): node is FormNode & { type: 'field'; value: FormField } {
  return node.type === 'field';
}

function isPageNode(node: FormNode): node is FormNode & { type: 'page'; value: FormPage } {
  return node.type === 'page';
}

function isSectionNode(node: FormNode): node is FormNode & { type: 'section'; value: FormSection } {
  return node.type === 'section';
}

interface ConceptReferenceTerm {
  conceptSource?: { name?: string };
  code?: string;
}

interface ConceptMapping {
  conceptReferenceTerm?: ConceptReferenceTerm;
}

interface ConceptAnswer {
  display?: string;
  uuid?: string;
}

interface ConceptWithMappings {
  uuid: string;
  display?: string;
  conceptClass?: { display?: string };
  answers?: Array<ConceptAnswer>;
  conceptMappings?: Array<ConceptMapping>;
}

export function shouldUseInlineLayout(
  renderingType: 'single-line' | 'multiline' | 'automatic',
  layoutType: LayoutType,
  workspaceLayout: 'minimized' | 'maximized',
  sessionMode: SessionMode,
): boolean {
  if (sessionMode === 'embedded-view') {
    return true;
  }
  if (renderingType === 'automatic') {
    return workspaceLayout === 'maximized' && layoutType.endsWith('desktop');
  }
  return renderingType === 'single-line';
}

export function evaluateConditionalAnswered(field: FormField, allFields: FormField[]): void {
  const conditionalValidator = field.validators?.find((validator) => validator.type === 'conditionalAnswered');
  const referencedFieldId = conditionalValidator?.referenceQuestionId;
  if (!referencedFieldId) {
    return;
  }

  const referencedField = allFields.find((candidate) => candidate.id === referencedFieldId);
  if (referencedField) {
    referencedField.fieldDependents ??= new Set();
    referencedField.fieldDependents.add(field.id);
  }
}

export function evaluateFieldReadonlyProp(
  field: FormField,
  sectionReadonly: string | boolean,
  pageReadonly: string | boolean,
  formReadonly: string | boolean,
): void {
  if (!isEmpty(field.readonly)) {
    return;
  }
  field.readonly = !isEmpty(sectionReadonly) || !isEmpty(pageReadonly) || formReadonly;
}

export function findPagesWithErrors(pages: Set<FormPage>, errorFields: FormField[]): string[] {
  const pagesWithErrors: string[] = [];
  const allFormPages = [...pages];
  if (errorFields?.length) {
    //Find pages each of the errors belong to
    errorFields.forEach((field) => {
      allFormPages.forEach((page) => {
        const errorPage = page.sections.find((section) => section.questions.find((question) => question === field));
        if (errorPage && !pagesWithErrors.includes(page.label)) {
          pagesWithErrors.push(page.label);
        }
      });
    });
  }
  return pagesWithErrors;
}

export function evalConditionalRequired(
  field: FormField,
  allFields: FormField[],
  formValues: Record<string, unknown>,
): boolean {
  if (typeof field.required !== 'object') {
    return false;
  }
  const { referenceQuestionAnswers, referenceQuestionId } = field.required;
  const referencedField = allFields.find((candidate) => candidate.id === referenceQuestionId);
  if (referencedField) {
    referencedField.fieldDependents ??= new Set();
    referencedField.fieldDependents.add(field.id);
    const referencedValue = formValues[referenceQuestionId];
    return typeof referencedValue === 'string' ? (referenceQuestionAnswers?.includes(referencedValue) ?? false) : false;
  }
  return false;
}

export function evaluateDisabled(
  node: FormNode,
  allFields: FormField[],
  allValues: Record<string, unknown>,
  sessionMode: SessionMode,
  patient: fhir.Patient,
  expressionRunnerFn: ExpressionRunner,
): boolean {
  const disableExpression =
    isFieldNode(node) && typeof node.value.disabled === 'object' && node.value.disabled
      ? node.value.disabled.disableWhenExpression
      : undefined;
  const isDisabled = expressionRunnerFn(disableExpression, node, allFields, allValues, {
    mode: sessionMode,
    patient,
  });
  return Boolean(isDisabled);
}

export function evaluateHide(
  node: FormNode,
  allFields: FormField[],
  allValues: Record<string, unknown>,
  sessionMode: SessionMode,
  patient: fhir.Patient,
  expressionRunnerFn: ExpressionRunner,
  updateFormFieldFn: (field: FormField) => void | null,
): void {
  const hideExpression = node.value.hide?.hideWhenExpression;
  const isHidden = Boolean(
    expressionRunnerFn(hideExpression, node, allFields, allValues, {
      mode: sessionMode,
      patient,
    }),
  );
  node.value.isHidden = isHidden;
  if (isFieldNode(node)) {
    node.value.questions?.forEach((question) => {
      question.isParentHidden = isHidden;
    });
  }
  if (isPageNode(node)) {
    node.value.sections.forEach((section) => {
      section.isParentHidden = isHidden;
      cascadeVisibilityToChildFields(isHidden, section, allFields, updateFormFieldFn);
    });
  }
  if (isSectionNode(node)) {
    cascadeVisibilityToChildFields(isHidden, node.value, allFields, updateFormFieldFn);
  }
}

function cascadeVisibilityToChildFields(
  visibility: boolean,
  section: FormSection,
  allFields: Array<FormField>,
  updateFormFieldFn: (field: FormField) => void,
): void {
  const candidateIds = section.questions.map((q) => q.id);
  allFields
    .filter((field) => candidateIds.includes(field.id))
    .forEach((field) => {
      field.isParentHidden = visibility;
      if (field.questionOptions.rendering === 'group') {
        field.questions?.forEach((member) => {
          member.isParentHidden = visibility;
        });
      }
      updateFormFieldFn?.(field);
    });
}

/**
 * Given a reference to a concept (either the uuid, or the source and reference term, ie "CIEL:1234") and a set of concepts, return matching concept, if any
 *
 * @param reference a uuid or source/term mapping, ie "3cd6f86c-26fe-102b-80cb-0017a47871b2" or "CIEL:1234"
 * @param concepts
 */
export function findConceptByReference(
  reference: string,
  concepts?: Array<ConceptWithMappings>,
): ConceptWithMappings | undefined {
  if (reference?.includes(':')) {
    // handle mapping
    const [source, code] = reference.split(':');

    return concepts?.find((concept) => {
      return concept?.conceptMappings?.find((mapping) => {
        return (
          mapping?.conceptReferenceTerm?.conceptSource?.name?.toUpperCase() === source.toUpperCase() &&
          mapping?.conceptReferenceTerm?.code?.toUpperCase() === code.toUpperCase()
        );
      });
    });
  } else {
    // handle uuid
    return concepts?.find((concept) => {
      return concept.uuid === reference;
    });
  }
}

export function scrollIntoView(viewId: string, shouldFocus: boolean = false): void {
  const currentElement = document.getElementById(viewId);
  currentElement?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
    inline: 'center',
  });

  if (shouldFocus) {
    currentElement?.focus();
  }
}

export const extractObsValueAndDisplay = (
  field: FormField,
  obs: OpenmrsObs | FHIRObsResource | string | number | null,
): { value: unknown; display: string | null } => {
  const rendering = field.questionOptions.rendering;
  if (obs == null) {
    return { value: null, display: null };
  }
  if (typeof obs === 'string' || typeof obs === 'number') {
    return { value: obs, display: String(obs) };
  }
  const omrsObs: Partial<OpenmrsObs> | null = isFHIRObsResource(obs) ? mapFHIRObsToOpenMRS(obs, rendering) : obs;
  if (!omrsObs) {
    return { value: null, display: null };
  }
  if (typeof omrsObs.value === 'string' || typeof omrsObs.value === 'number') {
    if (rendering === 'date' || rendering === 'datetime') {
      const dateObj = parseToLocalDateTime(String(omrsObs.value));
      return { value: dateObj, display: dayjs(dateObj).format('YYYY-MM-DD HH:mm') };
    }
    return { value: omrsObs.value, display: String(omrsObs.value) };
  } else if (['toggle', 'checkbox'].includes(rendering)) {
    const obsValue = isObsValueWithUuid(omrsObs.value) ? omrsObs.value : null;
    return {
      value: obsValue?.uuid ?? null,
      display: obsValue?.name?.name ?? null,
    };
  } else {
    const conceptUuid = isObsValueWithUuid(omrsObs.value) ? omrsObs.value.uuid : null;
    const matchingAnswer = field.questionOptions.answers?.find((option) => option.concept === conceptUuid);
    return {
      value: conceptUuid,
      display: typeof matchingAnswer?.label === 'string' ? matchingAnswer.label : null,
    };
  }
};

/**
 * Checks if a given form page has visible content.
 *
 * A page is considered to have visible content if:
 * - The page itself is not hidden.
 * - At least one section within the page is visible.
 * - At least one question within each section is visible.
 */
export function isPageContentVisible(page: FormPage): boolean {
  if (page.isHidden) {
    return false;
  }
  return (
    page.sections?.some((section) => {
      return !section.isHidden && section.questions?.some((question) => !question.isHidden);
    }) ?? false
  );
}

function mapFHIRObsToOpenMRS(fhirObs: FHIRObsResource, rendering: RenderType): Partial<OpenmrsObs> | null {
  try {
    return {
      obsDatetime: fhirObs.effectiveDateTime,
      uuid: fhirObs.id,
      concept: {
        uuid: fhirObs.code.coding[0]?.code,
        display: fhirObs.code.coding[0]?.display,
      },
      value: extractFHIRObsValue(fhirObs, rendering),
    };
  } catch (error) {
    console.error('Error converting FHIR Obs to OpenMRS modelling', error);
    return null;
  }
}

function extractFHIRObsValue(fhirObs: FHIRObsResource, rendering: RenderType): unknown {
  switch (rendering) {
    case 'toggle':
      return fhirObs.valueBoolean ? { uuid: ConceptTrue } : { uuid: ConceptFalse };

    case 'date':
    case 'datetime':
      return fhirObs.valueDateTime;

    case 'number':
      return fhirObs.valueQuantity?.value ?? null;

    case 'radio':
    case 'checkbox':
    case 'select':
    case 'content-switcher':
      return fhirObs.valueCodeableConcept?.coding[0]
        ? {
            uuid: fhirObs.valueCodeableConcept.coding[0].code,
            name: { name: fhirObs.valueCodeableConcept.coding[0].display },
          }
        : null;

    default:
      return fhirObs.valueString;
  }
}

function isFHIRObsResource(obs: OpenmrsObs | FHIRObsResource): obs is FHIRObsResource {
  return 'resourceType' in obs && obs.resourceType === 'Observation';
}

function isObsValueWithUuid(value: unknown): value is { uuid?: string; name?: { name?: string } } {
  return typeof value === 'object' && value !== null;
}

/**
 * Find formField section
 * @param formJson FormSchema
 * @param field FormField
 */
export function findFieldSection(formJson: FormSchema, field: FormField): FormSection | undefined {
  const page = formJson.pages.find((page) => field.meta?.pageId === page.id);
  return page?.sections.find((section) => section.questions.find((question) => question.id === field.id));
}
