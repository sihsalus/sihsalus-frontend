import { type OpenmrsResource } from '@openmrs/esm-framework/src/internal';
import dayjs from 'dayjs';
import { assignedDiagnosesIds } from '../../adapters/encounter-diagnosis-adapter';
import { assignedObsIds, constructObs, voidObs } from '../../adapters/obs-adapter';
import { assignedOrderIds } from '../../adapters/orders-adapter';
import {
  createAttachment,
  findPatientsByIdentifier,
  savePatientIdentifier,
  savePersonAttribute,
  saveProgramEnrollment,
} from '../../api';
import { cloneRepeatField } from '../../components/repeat/helpers';
import { ConceptTrue } from '../../constants';
import { type FormContextProps } from '../../provider/form-provider';
import {
  type Diagnosis,
  type DiagnosisPayload,
  type FormField,
  type FormProcessorContextProps,
  type OpenmrsEncounter,
  type OpenmrsObs,
  type Order,
  type PatientIdentifier,
  type PatientProgram,
  type PatientProgramPayload,
  type PersonAttribute,
} from '../../types';
import {
  getResourceUuid,
  hasRendering,
  hasSubmission,
  isAttachmentFieldValueArray,
  isDateValue,
  isOpenmrsObsLike,
  isPatientIdentifierValue,
  isPatientProgramStateValue,
  isPlainObject,
  isStringValue,
} from '../../utils/common-utils';
import { DefaultValueValidator } from '../../validators/default-value-validator';

export async function prepareEncounter(
  context: FormContextProps,
  encounterDate: Date | undefined,
  encounterRole: string,
  encounterProvider: string,
  location: string,
): Promise<OpenmrsEncounter> {
  const { patient, formJson, domainObjectValue: encounter, formFields, visit, deletedFields } = context;
  const allFormFields = [...formFields, ...deletedFields];
  const obsForSubmission: OpenmrsObs[] = [];
  prepareObs(obsForSubmission, allFormFields);
  const ordersForSubmission: Order[] = prepareOrders(allFormFields);
  const diagnosesForSubmission: Array<Diagnosis | DiagnosisPayload> = prepareDiagnosis(allFormFields);

  let encounterForSubmission: OpenmrsEncounter = {};

  if (encounter) {
    Object.assign(encounterForSubmission, encounter);
    // update encounter providers
    const hasCurrentProvider =
      (encounterForSubmission.encounterProviders ?? []).findIndex(
        (encProvider) => getResourceUuid(encProvider.provider) === encounterProvider,
      ) !== -1;
    if (!hasCurrentProvider) {
      encounterForSubmission.encounterProviders = [
        ...(encounterForSubmission.encounterProviders ?? []),
        {
          provider: encounterProvider,
          encounterRole,
        },
      ];
    }
    // TODO: Question: Should we be editing the location, form and visit here?
    if (encounterDate) {
      encounterForSubmission.encounterDatetime = encounterDate;
    }
    encounterForSubmission.location = location;
    encounterForSubmission.form = {
      uuid: formJson.uuid,
    };
    if (visit) {
      encounterForSubmission.visit = visit.uuid;
    }
    encounterForSubmission.obs = obsForSubmission;
    encounterForSubmission.orders = ordersForSubmission;
    encounterForSubmission.diagnoses = diagnosesForSubmission;
  } else {
    encounterForSubmission = {
      patient: patient.id,
      location: location,
      encounterType: formJson.encounterType,
      encounterProviders: [
        {
          provider: encounterProvider,
          encounterRole,
        },
      ],
      obs: obsForSubmission,
      form: {
        uuid: formJson.uuid,
      },
      visit: visit?.uuid,
      orders: ordersForSubmission,
      diagnoses: diagnosesForSubmission,
    };
    if (encounterDate) {
      encounterForSubmission.encounterDatetime = encounterDate;
    }
  }
  if (context.handleEncounterCreate) {
    const updatedEncounter = await context.handleEncounterCreate(encounterForSubmission);
    if (updatedEncounter) {
      return updatedEncounter;
    }
  }

  return encounterForSubmission;
}

export function preparePatientIdentifiers(fields: FormField[], _encounterLocation: string): PatientIdentifier[] {
  return fields
    .filter((field) => field.type === 'patientIdentifier' && hasSubmission(field))
    .map((field) => field.meta.submission.newValue)
    .filter(isPatientIdentifierValue);
}

export function savePatientIdentifiers(patient: fhir.Patient, identifiers: PatientIdentifier[]): Promise<unknown>[] {
  return identifiers.map((patientIdentifier) => {
    return savePatientIdentifier(patientIdentifier, patient.id);
  });
}

export function preparePersonAttributes(fields: FormField[]): PersonAttribute[] {
  return fields
    .filter((field) => field.type === 'personAttribute' && hasSubmission(field))
    .map((field) => field.meta.submission.newValue)
    .filter(isPersonAttributeValue);
}

export function savePersonAttributes(patient: fhir.Patient, attributes: PersonAttribute[]): Promise<unknown>[] {
  return attributes.map((personAttribute) => {
    return savePersonAttribute(personAttribute, patient.id);
  });
}

export async function hasDuplicatePatientIdentifiers(
  patient: fhir.Patient,
  identifiers: PatientIdentifier[],
): Promise<boolean> {
  const identifierEntries = identifiers
    .map((identifier) => ({
      identifier: identifier.identifier.trim(),
      identifierType: identifier.identifierType,
    }))
    .filter((identifier) => identifier.identifier.length > 0);

  if (!identifierEntries.length) {
    return false;
  }

  const patientUuid = patient.id;
  const seenIdentifiers = new Set<string>();

  for (const identifierEntry of identifierEntries) {
    const entryKey = getPatientIdentifierKey(identifierEntry.identifier, identifierEntry.identifierType);
    if (seenIdentifiers.has(entryKey)) {
      return true;
    }

    seenIdentifiers.add(entryKey);
  }

  try {
    const matchedPatients = await Promise.all(
      identifierEntries.map(async (identifierEntry) => {
        const candidates = await findPatientsByIdentifier(identifierEntry.identifier);

        return candidates.some(
          (candidate) =>
            candidate.uuid !== patientUuid &&
            candidate.identifiers?.some(
              (candidateIdentifier) =>
                candidateIdentifier.identifier === identifierEntry.identifier &&
                (!identifierEntry.identifierType ||
                  candidateIdentifier.identifierType?.uuid === identifierEntry.identifierType),
            ),
        );
      }),
    );

    return matchedPatients.some(Boolean);
  } catch (error) {
    console.warn('Failed to check duplicate patient identifiers before submission.', error);
    return false;
  }
}

function isPersonAttributeValue(value: unknown): value is PersonAttribute {
  return (
    isPlainObject(value) &&
    typeof value.value === 'string' &&
    typeof value.attributeType === 'string' &&
    (!('uuid' in value) || typeof value.uuid === 'string' || value.uuid === undefined)
  );
}

export function preparePatientPrograms(
  fields: FormField[],
  patient: fhir.Patient,
  currentPatientPrograms: Array<PatientProgram>,
): Array<PatientProgramPayload> {
  const programStateFields = fields.filter((field) => field.type === 'programState' && hasSubmission(field));
  const programMap = new Map<string, PatientProgramPayload>();
  programStateFields.forEach((field) => {
    const programUuid = field.questionOptions.programUuid;
    const newState = field.meta.submission.newValue;
    if (!programUuid || !isPatientProgramStateValue(newState)) {
      return;
    }
    const existingProgramEnrollment = currentPatientPrograms.find((program) => program.program.uuid === programUuid);

    if (existingProgramEnrollment) {
      if (programMap.has(programUuid)) {
        programMap.get(programUuid).states.push(newState);
      } else {
        programMap.set(programUuid, {
          uuid: existingProgramEnrollment.uuid,
          states: [newState],
        });
      }
    } else {
      if (programMap.has(programUuid)) {
        programMap.get(programUuid).states.push(newState);
      } else {
        programMap.set(programUuid, {
          patient: patient.id,
          program: programUuid,
          states: [newState],
          dateEnrolled: dayjs().format(),
        });
      }
    }
  });
  return Array.from(programMap.values());
}

export function savePatientPrograms(patientPrograms: PatientProgramPayload[]): Promise<unknown[]> {
  const ac = new AbortController();
  return Promise.all(patientPrograms.map((programPayload) => saveProgramEnrollment(programPayload, ac)));
}

export function saveAttachments(
  fields: FormField[],
  encounter: OpenmrsEncounter,
  _abortController: AbortController,
): [] | Promise<unknown[]> {
  const complexFields = fields?.filter((field) => field?.questionOptions.rendering === 'file' && hasSubmission(field));

  if (!complexFields?.length) {
    return [];
  }

  const allPromises = complexFields.flatMap((field) => {
    const patientUuid = typeof encounter?.patient === 'string' ? encounter?.patient : encounter?.patient?.uuid;
    const attachments = isAttachmentFieldValueArray(field.meta.submission.newValue)
      ? field.meta.submission.newValue
      : [];
    return attachments.map((attachment) => createAttachment(patientUuid, encounter.uuid, attachment));
  });

  return Promise.all(allPromises);
}

export function getMutableSessionProps(context: FormContextProps): {
  encounterRole?: string;
  encounterProvider: string;
  encounterDate?: Date;
  encounterLocation: string;
} {
  const {
    formFields,
    formJson,
    location,
    currentProvider,
    customDependencies,
    domainObjectValue: encounter,
    sessionDate,
    visit,
  } = context;
  const defaultEncounterRole = isPlainObject(customDependencies.defaultEncounterRole)
    ? customDependencies.defaultEncounterRole
    : undefined;
  const encounterRoleValue = formFields.find((field) => field.type === 'encounterRole')?.meta.submission?.newValue;
  const encounterProviderValue = formFields.find((field) => field.type === 'encounterProvider')?.meta.submission
    ?.newValue;
  const encounterDateValue = formFields.find((field) => field.type === 'encounterDatetime')?.meta.submission?.newValue;
  const encounterLocationValue = formFields.find((field) => field.type === 'encounterLocation')?.meta.submission
    ?.newValue;
  const existingEncounterDatetime =
    encounter && isDateValue(encounter.encounterDatetime)
      ? encounter.encounterDatetime
      : typeof encounter?.encounterDatetime === 'string'
        ? new Date(encounter.encounterDatetime)
        : undefined;
  const defaultEncounterDatetime = isDateValue(formJson.defaultEncounterDatetime)
    ? formJson.defaultEncounterDatetime
    : isStringValue(formJson.defaultEncounterDatetime) && dayjs(formJson.defaultEncounterDatetime).isValid()
      ? dayjs(formJson.defaultEncounterDatetime).toDate()
      : undefined;
  const defaultEncounterDate = visit?.stopDatetime ? sessionDate : undefined;
  return {
    encounterRole: isStringValue(encounterRoleValue) ? encounterRoleValue : getResourceUuid(defaultEncounterRole),
    encounterProvider: isStringValue(encounterProviderValue) ? encounterProviderValue : currentProvider.uuid,
    encounterDate: isDateValue(encounterDateValue)
      ? encounterDateValue
      : (existingEncounterDatetime ?? defaultEncounterDatetime ?? defaultEncounterDate),
    encounterLocation: isStringValue(encounterLocationValue)
      ? encounterLocationValue
      : (getResourceUuid(encounter?.location) ?? location.uuid),
  };
}

function getPatientIdentifierKey(identifier: string, identifierType?: string): string {
  return `${identifierType ?? ''}::${identifier}`;
}

// Helpers

function prepareObs(obsForSubmission: OpenmrsObs[], fields: FormField[]): void {
  fields
    .filter((field) => hasSubmittableObs(field))
    .forEach((field) => {
      processObsField(obsForSubmission, field);
    });
}

function processObsField(obsForSubmission: OpenmrsObs[], field: FormField): void {
  if ((field.isHidden || field.isParentHidden) && field.meta.initialValue.omrsObject) {
    const valuesArray = Array.isArray(field.meta.initialValue.omrsObject)
      ? field.meta.initialValue.omrsObject
      : [field.meta.initialValue.omrsObject];
    addObsToList(
      obsForSubmission,
      valuesArray.filter(isOpenmrsObsLike).map((obs) => voidObs(obs as OpenmrsObs)),
    );
    return;
  }

  if (field.type === 'obsGroup') {
    processObsGroup(obsForSubmission, field);
    return;
  }

  // new attachments will be processed later
  if (!hasRendering(field, 'file')) {
    addObsToList(obsForSubmission, field.meta.submission.newValue);
  }
  addObsToList(obsForSubmission, field.meta.submission.voidedValue);
}

function processObsGroup(obsForSubmission: OpenmrsObs[], groupField: FormField): void {
  if (groupField.meta.submission?.voidedValue) {
    addObsToList(obsForSubmission, groupField.meta.submission.voidedValue);
    return;
  }

  const obsGroup = constructObs(groupField, null);
  if (groupField.meta.initialValue?.omrsObject) {
    obsGroup.uuid = (groupField.meta.initialValue.omrsObject as OpenmrsResource).uuid;
  }

  groupField.questions.forEach((nestedField) => {
    if (nestedField.type === 'obsGroup') {
      const nestedObsGroup: OpenmrsObs[] = [];
      processObsGroup(nestedObsGroup, nestedField);
      addObsToList(obsGroup.groupMembers, nestedObsGroup);
    } else if (hasSubmission(nestedField)) {
      addObsToList(obsGroup.groupMembers, nestedField.meta.submission.newValue);
      addObsToList(obsGroup.groupMembers, nestedField.meta.submission.voidedValue);
    }
  });

  if (obsGroup.groupMembers?.length || obsGroup.voided) {
    addObsToList(obsForSubmission, obsGroup);
  }
}

function prepareOrders(fields: FormField[]): Order[] {
  return fields
    .filter((field) => field.type === 'testOrder' && hasSubmission(field))
    .flatMap((field) => [field.meta.submission.newValue, field.meta.submission.voidedValue])
    .filter((order): order is Order => isOrderValue(order));
}

function addObsToList(obsList: Array<Partial<OpenmrsObs>>, obs: unknown): void {
  if (!obs) {
    return;
  }
  if (Array.isArray(obs)) {
    obsList.push(...obs.filter(isOpenmrsObsLike));
  } else if (isOpenmrsObsLike(obs)) {
    obsList.push(obs);
  }
}

function hasSubmittableObs(field: FormField): boolean {
  const {
    questionOptions: { isTransient },
    type,
  } = field;

  if (isTransient || !['obs', 'obsGroup'].includes(type) || field.meta.groupId) {
    return false;
  }
  if ((field.isHidden || field.isParentHidden) && field.meta.initialValue?.omrsObject) {
    return true;
  }
  return !field.isHidden && !field.isParentHidden && (type === 'obsGroup' || hasSubmission(field));
}

export function inferInitialValueFromDefaultFieldValue(field: FormField): FormField['questionOptions']['defaultValue'] {
  if (field.questionOptions.rendering === 'toggle' && typeof field.questionOptions.defaultValue !== 'boolean') {
    return field.questionOptions.defaultValue === ConceptTrue;
  }

  // validate default value
  const errors = DefaultValueValidator.validate(field, field.questionOptions.defaultValue);
  if (errors.length) {
    const defaultValue = field.questionOptions.defaultValue;
    const defaultValueText = formatDefaultValueForLog(defaultValue);
    console.error(`Default value validation errors for field "${field.id}" with value "${defaultValueText}":`, errors);
    return null;
  }
  return field.questionOptions.defaultValue;
}

export async function hydrateRepeatField(
  field: FormField,
  encounter: OpenmrsEncounter,
  initialValues: Record<string, unknown>,
  context: FormProcessorContextProps,
): Promise<FormField[]> {
  let counter = 1;
  const { formFieldAdapters } = context;
  const unMappedGroups = encounter.obs.filter(
    (obs) =>
      getResourceUuid(obs.concept) === field.questionOptions.concept &&
      obs.uuid !== (field.meta.initialValue?.omrsObject as OpenmrsResource)?.uuid &&
      !assignedObsIds.includes(obs.uuid),
  );
  const unMappedOrders = encounter.orders.filter((order) => {
    const availableOrderables = field.questionOptions.answers?.map((answer) => answer.concept) || [];
    const orderConceptUuid = getResourceUuid(order.concept);
    return (
      typeof orderConceptUuid === 'string' &&
      availableOrderables.includes(orderConceptUuid) &&
      !assignedOrderIds.includes(order.uuid ?? '')
    );
  });
  if (field.type === 'testOrder') {
    return Promise.all(
      unMappedOrders
        .filter((order) => !order.voided)
        .map(async (order) => {
          const clone = cloneRepeatField(field, order, counter++);
          initialValues[clone.id] = await formFieldAdapters[field.type].getInitialValue(
            clone,
            { orders: [order] } as unknown as OpenmrsResource,
            context,
          );
          return clone;
        }),
    );
  }

  const unMappedDiagnoses = encounter.diagnoses.filter((diagnosis) => {
    const codedUuid = getDiagnosisCodedUuid(diagnosis);
    return (
      !isDiagnosisPayload(diagnosis) &&
      !diagnosis.voided &&
      typeof codedUuid === 'string' &&
      !assignedDiagnosesIds.includes(codedUuid) &&
      diagnosis.formFieldPath.startsWith(`rfe-forms-${field.id}_`)
    );
  });

  if (field.type === 'diagnosis') {
    return Promise.all(
      unMappedDiagnoses.map(async (diagnosis) => {
        const idSuffix = parseInt(diagnosis.formFieldPath.split('_')[1], 10);
        const clone = cloneRepeatField(field, diagnosis, idSuffix);
        initialValues[clone.id] = await formFieldAdapters[field.type].getInitialValue(
          clone,
          { diagnoses: [diagnosis] } as unknown as OpenmrsResource,
          context,
        );
        const codedUuid = getDiagnosisCodedUuid(diagnosis);
        if (typeof codedUuid === 'string' && !assignedDiagnosesIds.includes(codedUuid)) {
          assignedDiagnosesIds.push(codedUuid);
        }

        return clone;
      }),
    );
  }
  // handle obs groups
  return Promise.all(
    unMappedGroups.map(async (group) => {
      const clone = cloneRepeatField(field, group, counter++);
      await Promise.all(
        clone.questions.map(async (childField) => {
          initialValues[childField.id] = await formFieldAdapters[field.type].getInitialValue(
            childField,
            { obs: [group] } as unknown as OpenmrsResource,
            context,
          );
        }),
      );
      assignedObsIds.push(group.uuid);
      return [clone, ...clone.questions];
    }),
  ).then((results) => results.flat());
}

function prepareDiagnosis(fields: FormField[]): Array<Diagnosis | DiagnosisPayload> {
  const diagnoses = fields
    .filter((field) => field.type === 'diagnosis' && hasSubmission(field))
    .map((field) => field.meta.submission.newValue || field.meta.submission.voidedValue)
    .filter((diagnosis): diagnosis is Diagnosis | DiagnosisPayload => isDiagnosisValue(diagnosis));

  return diagnoses;
}

function isDiagnosisValue(value: unknown): value is Diagnosis | DiagnosisPayload {
  if (typeof value !== 'object' || value === null || !('diagnosis' in value)) {
    return false;
  }
  const diagnosis = value.diagnosis;
  return typeof diagnosis === 'object' && diagnosis !== null && 'coded' in diagnosis;
}

function isDiagnosisPayload(value: Diagnosis | DiagnosisPayload): value is DiagnosisPayload {
  return !('voided' in value);
}

function isOrderValue(value: unknown): value is Order {
  return typeof value === 'object' && value !== null && 'concept' in value;
}

function getDiagnosisCodedUuid(diagnosis: Diagnosis | DiagnosisPayload): string | undefined {
  const coded = diagnosis.diagnosis?.coded;
  return typeof coded === 'string' ? coded : coded?.uuid;
}

function formatDefaultValueForLog(defaultValue: FormField['questionOptions']['defaultValue']): string {
  if (defaultValue == null) {
    return defaultValue === null ? 'null' : 'undefined';
  }
  if (typeof defaultValue === 'string') {
    return defaultValue;
  }
  if (typeof defaultValue === 'number') {
    return defaultValue.toString();
  }
  if (typeof defaultValue === 'boolean') {
    return defaultValue ? 'true' : 'false';
  }
  return '[complex value]';
}
