import {
  buildAntecedentTypeNote,
  getAntecedentTypeFromNote,
  getAntecedentTypeLabel,
  getConditionNoteText,
  normalizeAntecedentTypeCode,
  updateAntecedentTypeNotes,
} from './antecedent-types';
import { isSupportedConditionStatus } from './condition-status';
import type { Condition, FormFields, OpenmrsCondition } from './conditions.types';

/** Native Condition text columns in the supported OpenMRS distribution. */
export const CONDITION_TEXT_MAX_LENGTH = 255;

export function getConditionNoteMaxLength(type?: string): number {
  const marker = buildAntecedentTypeNote(type)?.[0]?.text;
  return CONDITION_TEXT_MAX_LENGTH - (marker ? marker.length + 1 : 0);
}

function assertPersistedTextLength(text: string | undefined): void {
  if (text !== undefined && text.length > CONDITION_TEXT_MAX_LENGTH) {
    throw Object.assign(new Error('The antecedent text exceeds the supported length.'), {
      code: 'CONDITION_TEXT_TOO_LONG',
    });
  }
}

const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9.-]{0,63}$/;

export function assertConditionIdentifier(value: string): void {
  if (typeof value !== 'string' || !identifierPattern.test(value)) {
    throw new Error('Invalid condition or patient identifier.');
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isDate(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    !/^\d{4}(?:-\d{2}(?:-\d{2}(?:T.+)?)?)?$/.test(value) ||
    !Number.isFinite(Date.parse(value))
  ) {
    return false;
  }
  // Date.parse normalizes impossible days such as February 30; reject them instead.
  return (
    value.length < 10 || new Date(`${value.slice(0, 10)}T00:00:00Z`).toISOString().slice(0, 10) === value.slice(0, 10)
  );
}

/** Validate consumed REST fields without removing audit or terminology metadata unknown to the view. */
export function isConditionResource(value: unknown): value is OpenmrsCondition {
  if (!isObject(value) || typeof value.uuid !== 'string' || !identifierPattern.test(value.uuid)) {
    return false;
  }
  if (
    !isObject(value.patient) ||
    typeof value.patient.uuid !== 'string' ||
    !identifierPattern.test(value.patient.uuid)
  ) {
    return false;
  }
  const description = value.condition;
  if (!isObject(description)) {
    return false;
  }
  for (const field of ['coded', 'specificName']) {
    const reference = description[field];
    if (
      reference != null &&
      (!isObject(reference) ||
        typeof reference.uuid !== 'string' ||
        !identifierPattern.test(reference.uuid) ||
        (reference.display !== undefined && typeof reference.display !== 'string'))
    ) {
      return false;
    }
  }
  return (
    typeof value.clinicalStatus === 'string' &&
    typeof value.voided === 'boolean' &&
    (value.verificationStatus == null || typeof value.verificationStatus === 'string') &&
    (description.nonCoded == null || typeof description.nonCoded === 'string') &&
    (value.additionalDetail == null || typeof value.additionalDetail === 'string') &&
    ['onsetDate', 'endDate'].every((key) => value[key] == null || isDate(value[key])) &&
    (value.auditInfo === undefined ||
      (isObject(value.auditInfo) &&
        (value.auditInfo.dateCreated === undefined || isDate(value.auditInfo.dateCreated)))) &&
    (value.previousVersion == null ||
      (isObject(value.previousVersion) &&
        typeof value.previousVersion.uuid === 'string' &&
        identifierPattern.test(value.previousVersion.uuid)))
  );
}

export function isConditionForPatient(condition: OpenmrsCondition | undefined, patientUuid: string): boolean {
  return Boolean(
    patientUuid && identifierPattern.test(patientUuid) && condition?.patient?.uuid === patientUuid && !condition.voided,
  );
}

export function mapConditionProperties(source: OpenmrsCondition): Condition {
  const notes = source.additionalDetail == null ? undefined : [{ text: source.additionalDetail }];
  const type = getAntecedentTypeFromNote(notes);
  const description = source.condition;
  const status = source.clinicalStatus.trim();
  return {
    id: source.uuid,
    clinicalStatus: status ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase() : '',
    conceptId: description.coded?.uuid ?? '',
    display:
      description.specificName?.display?.trim() ||
      description.coded?.display?.trim() ||
      description.nonCoded?.trim() ||
      '--',
    recordedDate: source.auditInfo?.dateCreated,
    onsetDateTime: source.onsetDate ?? undefined,
    abatementDateTime: source.endDate ?? undefined,
    antecedentType: type,
    categoryText: type ? getAntecedentTypeLabel(type) : undefined,
    noteText: getConditionNoteText(notes),
    nonCodedText: description.nonCoded?.trim() ? description.nonCoded : undefined,
    source,
  };
}

export function sortConditions(conditions: Array<Condition>): Array<Condition> {
  const timestamp = (date?: string) => (date && Number.isFinite(Date.parse(date)) ? Date.parse(date) : -Infinity);
  return [...conditions].sort((a, b) => {
    const left = timestamp(a.onsetDateTime);
    const right = timestamp(b.onsetDateTime);
    return left === right ? a.id.localeCompare(b.id) : left > right ? -1 : 1;
  });
}

function validateDate(date: string | null | undefined): void {
  if (date == null || date === '') {
    return;
  }
  if (!isDate(date) || !/^\d{4}-\d{2}-\d{2}/.test(date)) {
    throw new Error('Invalid condition date.');
  }
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  if (Date.parse(date) > endOfToday.getTime()) {
    throw new Error('A condition date cannot be in the future.');
  }
}

function validateFields(fields: FormFields, conditionId: string): OpenmrsCondition;
function validateFields(fields: FormFields): undefined;
function validateFields(fields: FormFields, conditionId?: string): OpenmrsCondition | undefined {
  assertConditionIdentifier(fields.patientId);
  if (!fields.providerUuid) {
    throw new Error('A clinical provider is required to record an antecedent.');
  }
  assertConditionIdentifier(fields.providerUuid);
  const status = typeof fields.clinicalStatus === 'string' ? fields.clinicalStatus.trim().toLowerCase() : '';
  if (!isSupportedConditionStatus(status)) {
    throw new Error('Invalid condition clinical status.');
  }
  const requestedType = fields.antecedentType ?? fields.category;
  if (requestedType && (typeof requestedType !== 'string' || !normalizeAntecedentTypeCode(requestedType))) {
    throw new Error('Invalid antecedent type.');
  }
  if (
    typeof fields.conceptId !== 'string' ||
    typeof fields.display !== 'string' ||
    (fields.nonCodedText !== undefined && typeof fields.nonCodedText !== 'string') ||
    (fields.note !== undefined && typeof fields.note !== 'string')
  ) {
    throw new Error('Invalid condition description.');
  }
  const original = conditionId !== undefined ? fields.originalCondition : undefined;
  if (conditionId !== undefined) {
    assertConditionIdentifier(conditionId);
    if (
      !isConditionResource(original) ||
      original.uuid !== conditionId ||
      !isConditionForPatient(original, fields.patientId)
    ) {
      throw new Error('The condition does not belong to the current patient.');
    }
    if (!isSupportedConditionStatus(original.clinicalStatus)) {
      throw new Error('This historical clinical status is not supported for editing.');
    }
    const mapped = mapConditionProperties(original);
    if (!mapped.conceptId && !mapped.nonCodedText) {
      throw new Error('This historical condition has no supported editable representation.');
    }
    if (
      fields.conceptId !== mapped.conceptId ||
      (fields.nonCodedText !== undefined && fields.nonCodedText !== mapped.nonCodedText)
    ) {
      throw new Error('Changing the concept of an existing condition is not supported.');
    }
  } else {
    const coded = fields.conceptId.trim();
    const narrative = fields.nonCodedText?.trim();
    if ((!coded || !fields.display.trim()) && !narrative) {
      throw new Error('A coded or narrative antecedent is required.');
    }
    if (coded && narrative) {
      throw new Error('A condition cannot be both coded and narrative.');
    }
    if (coded) {
      assertConditionIdentifier(coded);
    }
  }
  const originalType = original ? mapConditionProperties(original).antecedentType : undefined;
  if (
    !fields.conceptId.trim() &&
    normalizeAntecedentTypeCode(requestedType) === 'definitive-diagnosis' &&
    originalType !== 'definitive-diagnosis'
  ) {
    throw Object.assign(new Error('A definitive diagnosis requires a coded concept.'), {
      code: 'CONDITION_CODED_DIAGNOSIS_REQUIRED',
    });
  }
  validateDate(fields.onsetDateTime);
  validateDate(fields.abatementDateTime);
  const onset = fields.onsetDateTime === undefined ? original?.onsetDate : fields.onsetDateTime;
  const end = fields.abatementDateTime === undefined ? original?.endDate : fields.abatementDateTime;
  if (onset && end && Date.parse(end) < Date.parse(onset)) {
    throw new Error('The end date cannot precede the onset date.');
  }
  if (end && !['inactive', 'remission', 'resolved'].includes(status)) {
    throw new Error('An active condition cannot have an end date.');
  }
  if (
    (original?.onsetDate && fields.onsetDateTime !== undefined && !fields.onsetDateTime) ||
    (original?.endDate && fields.abatementDateTime !== undefined && !fields.abatementDateTime)
  ) {
    // A correction requires a replacement date. Erasing established clinical dates is outside this form's scope.
    throw new Error('A recorded condition date can be corrected but cannot be removed.');
  }
  return original;
}

export interface ConditionCreatePayload {
  patient: string;
  condition: { coded: string } | { nonCoded: string };
  clinicalStatus: string;
  onsetDate?: string;
  endDate?: string;
  additionalDetail?: string;
}

/** OpenMRS assigns creator/dateCreated from the authenticated session; the client never supplies audit fields. */
export function buildConditionPayload(fields: FormFields): ConditionCreatePayload {
  validateFields(fields);
  const type = normalizeAntecedentTypeCode(fields.antecedentType ?? fields.category);
  const additionalDetail = buildAntecedentTypeNote(type, fields.note)?.[0]?.text;
  assertPersistedTextLength(additionalDetail);
  assertPersistedTextLength(fields.nonCodedText?.trim());
  return {
    patient: fields.patientId,
    condition: fields.nonCodedText?.trim()
      ? { nonCoded: fields.nonCodedText.trim() }
      : { coded: fields.conceptId.trim() },
    clinicalStatus: fields.clinicalStatus.trim().toUpperCase(),
    ...(fields.onsetDateTime ? { onsetDate: fields.onsetDateTime } : {}),
    ...(fields.abatementDateTime ? { endDate: fields.abatementDateTime } : {}),
    ...(additionalDetail ? { additionalDetail } : {}),
  };
}

export interface ConditionUpdatePatch {
  clinicalStatus?: string;
  onsetDate?: string;
  endDate?: string;
  additionalDetail?: string;
}

/** Send only corrections. ConditionService retains the original revision and creates its authenticated successor. */
export function buildConditionUpdatePatch(conditionId: string, fields: FormFields): ConditionUpdatePatch {
  const original = validateFields(fields, conditionId);
  const patch: ConditionUpdatePatch = {};
  if (fields.clinicalStatus.trim().toUpperCase() !== original.clinicalStatus.trim().toUpperCase()) {
    patch.clinicalStatus = fields.clinicalStatus.trim().toUpperCase();
  }
  if (fields.onsetDateTime && fields.onsetDateTime !== original.onsetDate) {
    patch.onsetDate = fields.onsetDateTime;
  }
  if (fields.abatementDateTime && fields.abatementDateTime !== original.endDate) {
    patch.endDate = fields.abatementDateTime;
  }
  const requestedType = fields.antecedentType ?? fields.category;
  if (requestedType !== undefined || fields.note !== undefined) {
    const originalNotes = original.additionalDetail == null ? undefined : [{ text: original.additionalDetail }];
    const updated = updateAntecedentTypeNotes(
      originalNotes,
      normalizeAntecedentTypeCode(requestedType),
      fields.note,
    )?.[0]?.text;
    if (updated !== original.additionalDetail && !(updated === undefined && original.additionalDetail == null)) {
      assertPersistedTextLength(updated);
      patch.additionalDetail = updated ?? '';
    }
  }
  return patch;
}
