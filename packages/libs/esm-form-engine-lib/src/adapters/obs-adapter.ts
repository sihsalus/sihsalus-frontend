import { attachmentUrl, getAttachmentByUuid, type OpenmrsResource } from '@openmrs/esm-framework/src/internal';
import dayjs from 'dayjs';
import { ConceptTrue, codedTypes } from '../constants';
import { type FormContextProps } from '../provider/form-provider';
import {
  type Attachment,
  type FormField,
  type FormFieldValue,
  type FormFieldValueAdapter,
  type FormProcessorContextProps,
  type OpenmrsEncounter,
  type OpenmrsObs,
  type ValueAndDisplay,
} from '../types';
import {
  clearSubmission,
  flattenObsList,
  formatDateAsDisplayString,
  getResourceUuid,
  gracefullySetSubmission,
  hasRendering,
  isDateValue,
  isOpenmrsResourceLike,
  isPlainObject,
  isStringValue,
  parseToLocalDateTime,
} from '../utils/common-utils';
import { isEmpty } from '../validators/form-validator';

interface FetchedAttachment {
  uuid: string;
  filename: string;
  comment?: string;
  bytesContentFamily?: string;
}

export const assignedObsIds: string[] = [];

export const ObsAdapter: FormFieldValueAdapter = {
  async getInitialValue(
    field: FormField,
    sourceObject: OpenmrsResource,
    context: FormProcessorContextProps,
  ): Promise<FormFieldValue> {
    const encounter = getEncounterFromSource(sourceObject, context.domainObjectValue);
    if (!encounter) {
      return '';
    }

    const matchingObs = findObsByFormField(flattenObsList(getEncounterObs(encounter)), assignedObsIds, field);
    if (hasRendering(field, 'file') && matchingObs.length) {
      return await resolveAttachmentsFromObs(field, matchingObs);
    }

    return extractFieldValue(field, matchingObs, true);
  },

  getPreviousValue(
    field: FormField,
    sourceObject: OpenmrsResource,
    context: FormProcessorContextProps,
  ): ValueAndDisplay | null {
    const encounter = getEncounterFromSource(sourceObject, context.previousDomainObjectValue);
    if (!encounter) {
      return null;
    }

    const value = extractFieldValue(
      field,
      findObsByFormField(flattenObsList(getEncounterObs(encounter)), assignedObsIds, field),
      true,
    );
    if (isEmpty(value)) {
      return null;
    }

    return {
      value,
      display: getDisplayText(getObsDisplayValue(field, value)),
    };
  },

  getDisplayValue: (field: FormField, value: unknown): unknown => getObsDisplayValue(field, value),

  transformFieldValue: (field: FormField, value: unknown, _context: FormContextProps): FormFieldValue | null => {
    clearSubmission(field);

    if (!field.meta.initialValue?.omrsObject && isEmpty(value)) {
      return null;
    }

    if (hasRendering(field, 'checkbox')) {
      const checkboxValues = Array.isArray(value) ? value.filter(isStringValue) : isStringValue(value) ? [value] : [];
      return handleMultiSelect(field, checkboxValues);
    }

    if (hasRendering(field, 'file')) {
      const attachments = Array.isArray(value) ? value.filter(isAttachment) : [];
      return handleAttachments(field, attachments);
    }

    if (!isEmpty(value) && hasPreviousObsValueChanged(field, value)) {
      return gracefullySetSubmission(field, editObs(field, value), undefined) ?? null;
    }

    if (
      field.meta.initialValue?.omrsObject &&
      isEmpty(value) &&
      isOpenmrsObsValue(field.meta.initialValue.omrsObject)
    ) {
      return gracefullySetSubmission(field, undefined, voidObs(field.meta.initialValue.omrsObject)) ?? null;
    }

    if (!isEmpty(value)) {
      return gracefullySetSubmission(field, constructObs(field, value), undefined) ?? null;
    }

    return null;
  },

  tearDown: (): void => {
    assignedObsIds.length = 0;
  },
};

function extractFieldValue(field: FormField, obsList: OpenmrsObs[] = [], makeFieldDirty = false): FormFieldValue {
  const rendering = field.questionOptions.rendering;
  ensureInitialValue(field);

  if (!obsList.length) {
    return '';
  }

  if (rendering === 'checkbox') {
    assignedObsIds.push(...obsList.map((obs) => obs.uuid));
    field.meta.initialValue.omrsObject = makeFieldDirty ? obsList : null;
    return obsList.map((obs) => getResourceUuid(obs.value)).filter((uuid): uuid is string => isStringValue(uuid));
  }

  const obs = obsList[0];
  if (makeFieldDirty) {
    field.meta.initialValue.omrsObject = { ...obs };
  }

  assignedObsIds.push(obs.uuid);

  if (isStringValue(obs.value) || typeof obs.value === 'number') {
    if (rendering.startsWith('date') && isStringValue(obs.value)) {
      const dateObject = parseToLocalDateTime(obs.value);
      if (makeFieldDirty && isOpenmrsObsValue(field.meta.initialValue.omrsObject)) {
        field.meta.initialValue.omrsObject.value = dayjs(dateObject).format('YYYY-MM-DD HH:mm');
      }
      return dateObject;
    }
    return obs.value;
  }

  if (rendering === 'toggle') {
    return getResourceUuid(obs.value) === ConceptTrue;
  }

  if (rendering === 'fixed-value') {
    return field['fixedValue'] as FormFieldValue;
  }

  return getResourceUuid(obs.value) ?? '';
}

export function constructObs(field: FormField, value: unknown): Partial<OpenmrsObs> | null {
  if (isEmpty(value) && field.type !== 'obsGroup') {
    return null;
  }

  const draftObs =
    field.type === 'obsGroup'
      ? { groupMembers: [] as OpenmrsObs[] }
      : {
          value: field.questionOptions.rendering.startsWith('date') ? formatDateByPickerType(field, value) : value,
        };

  return {
    ...draftObs,
    concept: field.questionOptions.concept,
    formFieldNamespace: 'rfe-forms',
    formFieldPath: `rfe-forms-${field.id}`,
  };
}

export function voidObs(obs: OpenmrsObs): Partial<OpenmrsObs> {
  return { uuid: obs.uuid, voided: true };
}

export function editObs(field: FormField, newValue: unknown): Partial<OpenmrsObs> {
  const oldObs = field.meta.initialValue?.omrsObject;
  const formattedValue = field.questionOptions.rendering.startsWith('date')
    ? formatDateByPickerType(field, newValue)
    : newValue;

  return {
    uuid: isOpenmrsResourceLike(oldObs) ? oldObs.uuid : undefined,
    value: formattedValue,
    formFieldNamespace: 'rfe-forms',
    formFieldPath: `rfe-forms-${field.id}`,
  };
}

function formatDateByPickerType(field: FormField, value: unknown): unknown {
  if (field.datePickerFormat && (isDateValue(value) || isStringValue(value) || typeof value === 'number')) {
    const dateValue = dayjs(value);
    switch (field.datePickerFormat) {
      case 'calendar':
        return dateValue.format('YYYY-MM-DD');
      case 'timer':
        return dateValue.format('HH:mm');
      case 'both':
        return dateValue.format('YYYY-MM-DD HH:mm');
      default:
        return dateValue.format('YYYY-MM-DD');
    }
  }
  return value;
}

export function hasPreviousObsValueChanged(field: FormField, newValue: unknown): boolean {
  const previousObs = field.meta.initialValue?.omrsObject;
  if (!isOpenmrsResourceLike(previousObs)) {
    return false;
  }

  if (codedTypes.includes(field.questionOptions.rendering)) {
    return getResourceUuid(previousObs.value) !== newValue;
  }

  if (hasRendering(field, 'date')) {
    return hasDayjsInput(newValue) && hasDayjsInput(previousObs.value)
      ? dayjs(newValue).diff(dayjs(previousObs.value), 'D') !== 0
      : false;
  }

  if (hasRendering(field, 'datetime') || field.datePickerFormat === 'both') {
    return hasDayjsInput(newValue) && hasDayjsInput(previousObs.value)
      ? dayjs(newValue).diff(dayjs(previousObs.value), 'minute') !== 0
      : false;
  }

  if (hasRendering(field, 'toggle')) {
    return (getResourceUuid(previousObs.value) === ConceptTrue) !== newValue;
  }

  return previousObs.value !== newValue;
}

function handleMultiSelect(field: FormField, values: string[] = []): FormFieldValue | null {
  const obsArray = Array.isArray(field.meta.initialValue?.omrsObject)
    ? field.meta.initialValue.omrsObject.filter(isOpenmrsObsValue)
    : [];

  if (obsArray.length && isEmpty(values)) {
    return (
      gracefullySetSubmission(
        field,
        null,
        obsArray.map((previousValue) => voidObs(previousValue)),
      ) ?? null
    );
  }

  if (obsArray.length && !isEmpty(values)) {
    const toBeVoided = obsArray.filter((obs) => !values.includes(getResourceUuid(obs.value) ?? ''));
    const toBeCreated = values.filter((candidate) => !obsArray.some((obs) => getResourceUuid(obs.value) === candidate));

    return (
      gracefullySetSubmission(
        field,
        toBeCreated.map((candidate) => constructObs(field, candidate)).filter(isOpenmrsObsDraft),
        toBeVoided.map((obs) => voidObs(obs)),
      ) ?? null
    );
  }

  return (
    gracefullySetSubmission(
      field,
      values.map((candidate) => constructObs(field, candidate)).filter(isOpenmrsObsDraft),
      undefined,
    ) ?? null
  );
}

function handleAttachments(field: FormField, attachments: Attachment[] = []): FormFieldValue | null {
  const voided = attachments
    .filter((attachment) => attachment.uuid && attachment.voided)
    .map((attachment) => ({ uuid: attachment.uuid, voided: true }));

  const newAttachments = attachments
    .filter((attachment) => !attachment.uuid)
    .map((attachment) => ({
      formFieldNamespace: 'rfe-forms',
      formFieldPath: `rfe-forms-${field.id}`,
      ...attachment,
    }));

  field.meta.submission.newValue = newAttachments;
  return gracefullySetSubmission(field, newAttachments, voided) ?? null;
}

export function findObsByFormField(obsList: OpenmrsObs[], claimedObsIds: string[], field: FormField): OpenmrsObs[] {
  const obs = obsList.filter((candidate) => {
    if (hasRendering(field, 'file') && candidate.formFieldPath === `rfe-forms-${field.id}`) {
      return true;
    }

    return (
      candidate.formFieldPath === `rfe-forms-${field.id}` &&
      getResourceUuid(candidate.concept) === field.questionOptions.concept
    );
  });

  if (!obs.length) {
    const obsByConcept = obsList.filter(
      (candidate) => getResourceUuid(candidate.concept) === field.questionOptions.concept,
    );
    return claimedObsIds.length
      ? obsByConcept.filter((candidate) => !claimedObsIds.includes(candidate.uuid))
      : obsByConcept;
  }

  return obs;
}

async function resolveAttachmentsFromObs(field: FormField, obs: OpenmrsObs[]): Promise<Attachment[]> {
  const abortController = new AbortController();
  const attachments = await Promise.all(
    obs.map(async (candidate) => {
      try {
        const response = await getAttachmentByUuid(candidate.uuid, abortController);
        return isFetchedAttachment(response.data) ? response.data : null;
      } catch (error: unknown) {
        console.error(`Failed to fetch attachment ${candidate.uuid}:`, error);
        return null;
      }
    }),
  );

  field.meta.initialValue = {
    omrsObject: obs,
  };

  return attachments.filter(isFetchedAttachment).map((attachment) => ({
    uuid: attachment.uuid,
    base64Content: `${window.openmrsBase}${attachmentUrl}/${attachment.uuid}/bytes`,
    fileName: attachment.filename,
    fileDescription: attachment.comment,
    fileType: attachment.bytesContentFamily?.toLowerCase(),
  }));
}

function getEncounterFromSource(sourceObject: unknown, fallback: unknown): OpenmrsEncounter | null {
  if (isEncounterLike(sourceObject)) {
    return sourceObject;
  }
  if (isEncounterLike(fallback)) {
    return fallback;
  }
  return null;
}

function getEncounterObs(encounter: OpenmrsEncounter): OpenmrsObs[] {
  return Array.isArray(encounter.obs) ? encounter.obs : [];
}

function getObsDisplayValue(field: FormField, value: unknown): unknown {
  const rendering = field.questionOptions.rendering;
  if (isEmpty(value)) {
    return value;
  }
  if (value instanceof Date) {
    return formatDateAsDisplayString(field, value);
  }
  if (rendering === 'checkbox' && Array.isArray(value)) {
    return value
      .map((selected) => field.questionOptions.answers?.find((option) => option.concept === selected)?.label)
      .filter((label): label is string => isStringValue(label));
  }
  if (rendering === 'toggle') {
    return value ? field.questionOptions.toggleOptions.labelTrue : field.questionOptions.toggleOptions.labelFalse;
  }
  if (codedTypes.includes(rendering)) {
    const answers = field.questionOptions.answers;
    const answer = answers?.find((option) => (option.value ?? option.concept) === value);
    return answer?.label ?? (answers?.some((option) => option.value != null) ? value : undefined);
  }
  return value;
}

function getDisplayText(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (isStringValue(item)) {
          return item;
        }
        if (typeof item === 'number' || typeof item === 'boolean') {
          return item.toString();
        }
        return '[complex value]';
      })
      .join(', ');
  }
  if (isStringValue(value)) {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value.toString();
  }
  return value == null ? '' : '[complex value]';
}

function ensureInitialValue(field: FormField): void {
  if (!field.meta) {
    field.meta = {
      initialValue: {
        omrsObject: null,
        refinedValue: null,
      },
    };
  }
}

function isEncounterLike(value: unknown): value is OpenmrsEncounter {
  return isPlainObject(value) && Array.isArray(value.obs);
}

function isAttachment(value: unknown): value is Attachment {
  return isPlainObject(value) && ('base64Content' in value || 'uuid' in value);
}

function isFetchedAttachment(value: unknown): value is FetchedAttachment {
  return isPlainObject(value) && isStringValue(value.uuid) && isStringValue(value.filename);
}

function hasDayjsInput(value: unknown): value is string | number | Date {
  return isStringValue(value) || typeof value === 'number' || value instanceof Date;
}

function isOpenmrsObsValue(value: unknown): value is OpenmrsObs {
  return isPlainObject(value) && isStringValue(value.uuid);
}

function isOpenmrsObsDraft(value: Partial<OpenmrsObs> | null): value is Partial<OpenmrsObs> {
  return value !== null;
}
