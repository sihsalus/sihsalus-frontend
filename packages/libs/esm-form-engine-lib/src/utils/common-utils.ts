import { type OpenmrsResource } from '@openmrs/esm-framework/src/internal';
import { type FormatDateOptions, formatDate } from '@openmrs/esm-utils';
import dayjs from 'dayjs';
import {
  type AttachmentFieldValue,
  type FormField,
  type FormFieldSubmissionValue,
  type FormFieldValue,
  type FormSchema,
  type OpenmrsObs,
  type PatientIdentifier,
  type PatientProgramPayload,
  type RenderType,
  type ValidationResult,
} from '../types';
import { isEmpty } from '../validators/form-validator';

export function flattenObsList(obsList: OpenmrsObs[]): OpenmrsObs[] {
  const flattenedList: OpenmrsObs[] = [];

  function flatten(obs: OpenmrsObs): void {
    flattenedList.push(obs);
    if (obs.groupMembers?.length) {
      obs.groupMembers.forEach((groupMember) => {
        flatten(groupMember);
      });
    }
  }
  obsList.forEach((obs) => {
    flatten(obs);
  });

  return flattenedList;
}

export function hasRendering(field: FormField, rendering: RenderType): boolean {
  return field.questionOptions.rendering === rendering;
}

export function clearSubmission(field: FormField): void {
  if (!field.meta?.submission) {
    field.meta = { ...(field.meta || {}), submission: {} };
  }
  field.meta.submission = {
    ...field.meta.submission,
    voidedValue: null,
    newValue: null,
  };
}

export function gracefullySetSubmission(
  field: FormField,
  newValue: FormFieldValue | undefined,
  voidedValue: FormFieldValue | undefined,
): FormFieldValue | undefined {
  if (!field.meta?.submission) {
    field.meta = { ...(field.meta || {}), submission: {} };
  }
  if (!isEmpty(newValue)) {
    field.meta.submission.newValue = newValue;
  }
  if (!isEmpty(voidedValue)) {
    field.meta.submission.voidedValue = voidedValue;
  }
  return field.meta.submission.newValue;
}

export function hasSubmission(field: FormField): boolean {
  return !!field.meta.submission?.newValue || !!field.meta.submission?.voidedValue;
}

export function isViewMode(sessionMode: string): boolean {
  return sessionMode === 'view' || sessionMode === 'embedded-view';
}

export function parseToLocalDateTime(dateString: string): Date {
  const dateObj = dayjs(dateString).toDate();
  if (Number.isNaN(dateObj.getTime())) {
    return new Date(NaN);
  }

  try {
    const timePart = dateString.split('T')[1];
    if (timePart) {
      const localTimeTokens = timePart.split(':');
      dateObj.setHours(parseInt(localTimeTokens[0], 10), parseInt(localTimeTokens[1], 10), 0);
    }
  } catch (e) {
    console.error(e);
  }
  return dateObj;
}

export function formatDateAsDisplayString(field: FormField, date: Date): string {
  const options: Partial<FormatDateOptions> = { noToday: true };
  if (field.datePickerFormat === 'calendar') {
    options.time = false;
  } else {
    options.time = true;
  }
  return formatDate(date, options);
}

/**
 * Creates a new copy of `formJson` with updated references at the page and section levels.
 * This ensures React re-renders properly by providing new references for nested arrays.
 */
export function updateFormSectionReferences(formJson: FormSchema): FormSchema {
  formJson.pages = formJson.pages.map((page) => {
    page.sections = Array.from(page.sections);
    return page;
  });
  return { ...formJson };
}

/**
 * Converts a px value to a rem value
 * @param px - The px value to convert
 * @param fontSize - The font size to use for the conversion
 * @returns The rem value
 */
export function pxToRem(px: number, fontSize: number = 16): number {
  return px / fontSize;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isStringValue(value: unknown): value is string {
  return typeof value === 'string';
}

export function isStringOrNumber(value: unknown): value is string | number {
  return typeof value === 'string' || typeof value === 'number';
}

export function isDateValue(value: unknown): value is Date {
  return value instanceof Date;
}

export function isOpenmrsResourceLike(value: unknown): value is OpenmrsResource {
  return isPlainObject(value) && typeof value.uuid === 'string';
}

export function getResourceUuid(resource: unknown): string | undefined {
  return isOpenmrsResourceLike(resource) ? resource.uuid : isStringValue(resource) ? resource : undefined;
}

export function isFormFieldSubmissionValue(value: unknown): value is FormFieldSubmissionValue {
  return isPlainObject(value);
}

export function isOpenmrsObsLike(value: unknown): value is Partial<OpenmrsObs> {
  return isPlainObject(value);
}

export function isPatientIdentifierValue(value: unknown): value is PatientIdentifier {
  return isPlainObject(value) && typeof value.identifier === 'string';
}

export function isPatientProgramStateValue(
  value: unknown,
): value is NonNullable<PatientProgramPayload['states']>[number] {
  return isPlainObject(value);
}

export function isAttachmentFieldValue(value: unknown): value is AttachmentFieldValue {
  return (
    isPlainObject(value) &&
    typeof value.fileName === 'string' &&
    typeof value.base64Content === 'string' &&
    typeof value.formFieldNamespace === 'string' &&
    typeof value.formFieldPath === 'string'
  );
}

export function isAttachmentFieldValueArray(value: unknown): value is AttachmentFieldValue[] {
  return Array.isArray(value) && value.every(isAttachmentFieldValue);
}

export function isValidationResult(value: unknown): value is ValidationResult {
  return (
    isPlainObject(value) &&
    (value.resultType === 'error' || value.resultType === 'warning') &&
    typeof value.message === 'string'
  );
}

export function isValidationResultArray(value: unknown): value is ValidationResult[] {
  return Array.isArray(value) && value.every(isValidationResult);
}
