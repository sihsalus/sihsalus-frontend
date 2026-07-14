import type { Config } from '../config-schema';
import { buildNationalityAttribute, isCompletedPeruDni } from './patient-nationality';
import type { QuickRegistrationFormData } from './patient-search-registration.validation';

export type PersonAttributeValue = string | { uuid: string };

export interface PersonAttributePayload {
  attributeType: string;
  value: PersonAttributeValue;
}

function addOptionalAttribute(
  attributes: Array<PersonAttributePayload>,
  attributeTypeUuid: string | null | undefined,
  value: PersonAttributeValue | undefined,
) {
  if (attributeTypeUuid && value) {
    attributes.push({ attributeType: attributeTypeUuid, value });
  }
}

function getIdentificationStatusAttributeValue(
  config: Pick<Config['patientRegistration'], 'identificationStatusConcepts'>,
  identificationStatus: string,
) {
  const statusConceptUuid = {
    pending: config.identificationStatusConcepts.pendingUuid,
    partial: config.identificationStatusConcepts.partialUuid,
    confirmed: config.identificationStatusConcepts.confirmedUuid,
    merged: config.identificationStatusConcepts.mergedUuid,
  }[identificationStatus];

  return statusConceptUuid ?? identificationStatus;
}

export function buildEmergencyPatientAttributes(
  data: QuickRegistrationFormData,
  config: Config['patientRegistration'],
  allowedNationalityConceptUuids?: ReadonlySet<string>,
): Array<PersonAttributePayload> {
  const attributes: Array<PersonAttributePayload> = [];
  const shouldInferPeruFromDni =
    !data.isUnknown &&
    !data.nationality?.trim() &&
    data.identifierType === config.defaultIdentifierTypeUuid &&
    isCompletedPeruDni(data.identifier);
  const effectiveNationality = shouldInferPeruFromDni ? config.peruNationalityConceptUuid : data.nationality;

  if (data.isUnknown) {
    attributes.push({
      attributeType: config.unknownPatientAttributeTypeUuid,
      value: 'true',
    });
  }
  if (!data.isUnknown && data.insuranceType) {
    attributes.push({
      attributeType: config.insuranceTypeAttributeTypeUuid,
      value: data.insuranceType,
    });
  }

  const nationalityAttribute = buildNationalityAttribute({
    allowedConceptUuids: allowedNationalityConceptUuids,
    attributeTypeUuid: config.nationalityAttributeTypeUuid,
    isUnknown: Boolean(data.isUnknown),
    nationality: effectiveNationality,
  });
  if (nationalityAttribute) {
    attributes.push(nationalityAttribute);
  }

  if (!data.isUnknown && data.insuranceCode) {
    attributes.push({
      attributeType: config.insuranceCodeAttributeTypeUuid,
      value: data.insuranceCode,
    });
  }
  if (data.companionName) {
    attributes.push({
      attributeType: config.companionNameAttributeTypeUuid,
      value: data.companionName,
    });
  }
  if (data.companionAge) {
    attributes.push({
      attributeType: config.companionAgeAttributeTypeUuid,
      value: data.companionAge,
    });
  }
  if (data.companionRelationship) {
    attributes.push({
      attributeType: config.companionRelationshipAttributeTypeUuid,
      value: data.companionRelationship,
    });
  }
  addOptionalAttribute(attributes, config.communicationConditionAttributeTypeUuid, data.communicationCondition);
  addOptionalAttribute(
    attributes,
    config.identificationStatusAttributeTypeUuid,
    data.identificationStatus ? getIdentificationStatusAttributeValue(config, data.identificationStatus) : undefined,
  );
  addOptionalAttribute(attributes, config.responsibleTypeAttributeTypeUuid, data.responsibleType);

  return attributes;
}
