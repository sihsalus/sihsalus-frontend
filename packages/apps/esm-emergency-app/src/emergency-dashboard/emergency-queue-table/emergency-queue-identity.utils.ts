import { type EmergencyQueueEntry } from '../../resources/emergency.resource';
import type { Config } from '../../config-schema';

const IDENTIFICATION_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  partial: 'Parcial',
  confirmed: 'Confirmado',
  merged: 'Fusionado',
};

type IdentificationAttributeValue = string | { uuid?: string; display?: string } | undefined;
type IdentificationStatusCode = keyof typeof IDENTIFICATION_STATUS_LABELS;

function getStatusByConceptUuid(
  config: Pick<Config['patientRegistration'], 'identificationStatusConcepts'>,
  conceptUuid: string,
): IdentificationStatusCode | null {
  const normalizedConceptUuid = conceptUuid.toLocaleLowerCase();
  const conceptMap: Record<string, IdentificationStatusCode> = {};

  if (config.identificationStatusConcepts.pendingUuid) {
    conceptMap[config.identificationStatusConcepts.pendingUuid.toLocaleLowerCase()] = 'pending';
  }
  if (config.identificationStatusConcepts.partialUuid) {
    conceptMap[config.identificationStatusConcepts.partialUuid.toLocaleLowerCase()] = 'partial';
  }
  if (config.identificationStatusConcepts.confirmedUuid) {
    conceptMap[config.identificationStatusConcepts.confirmedUuid.toLocaleLowerCase()] = 'confirmed';
  }
  if (config.identificationStatusConcepts.mergedUuid) {
    conceptMap[config.identificationStatusConcepts.mergedUuid.toLocaleLowerCase()] = 'merged';
  }

  return conceptMap[normalizedConceptUuid] ?? null;
}

function getPersonAttributeValue(queueEntry: EmergencyQueueEntry, pattern: RegExp) {
  const attribute = queueEntry.patient.person?.attributes?.find((attribute) =>
    pattern.test(attribute.attributeType?.display ?? ''),
  );
  return attribute?.value;
}

function getAttributeValue(queueEntry: EmergencyQueueEntry, pattern: RegExp) {
  const value = getPersonAttributeValue(queueEntry, pattern);

  if (typeof value === 'string') {
    return value;
  }

  return value?.display ?? value?.uuid ?? '';
}

function getPersonAttributeConceptUuid(
  config: Pick<Config['patientRegistration'], 'identificationStatusConcepts'> | undefined,
  rawValue: IdentificationAttributeValue,
) {
  if (!config) {
    return '';
  }

  if (typeof rawValue === 'string') {
    const statusCode = getStatusByConceptUuid(config, rawValue);
    return statusCode ? IDENTIFICATION_STATUS_LABELS[statusCode] : '';
  }

  if (!rawValue?.uuid) {
    return '';
  }

  const conceptCode = getStatusByConceptUuid(config, rawValue.uuid);
  if (!conceptCode) {
    return '';
  }

  return IDENTIFICATION_STATUS_LABELS[conceptCode];
}

function getIdentifierValue(queueEntry: EmergencyQueueEntry, pattern: RegExp) {
  return (
    queueEntry.patient.identifiers?.find((identifier) => pattern.test(identifier.identifierType?.display ?? ''))
      ?.identifier ?? ''
  );
}

export function getQueueEntryMedicalRecordNumber(queueEntry: EmergencyQueueEntry) {
  return getIdentifierValue(queueEntry, /historia|clinical|openmrs|hc/i);
}

export function getQueueEntryDocumentNumber(queueEntry: EmergencyQueueEntry) {
  return getIdentifierValue(
    queueEntry,
    /dni|\bce\b|carn[eé].*extranjer|pasaporte|pass|documento|certificado de nacido vivo|cnv|\bdie\b/i,
  );
}

export function getQueueEntryIdentificationStatus(
  queueEntry: EmergencyQueueEntry,
  patientRegistrationConfig?: Pick<Config['patientRegistration'], 'identificationStatusConcepts'>,
) {
  const configuredStatus = getAttributeValue(queueEntry, /estado.*identificaci[oó]n|identification status/i);
  const configuredStatusValue = getPersonAttributeValue(queueEntry, /estado.*identificaci[oó]n|identification status/i);
  const configuredStatusByUuid = patientRegistrationConfig
    ? getPersonAttributeConceptUuid(patientRegistrationConfig, configuredStatusValue)
    : '';
  if (configuredStatusByUuid) {
    return configuredStatusByUuid;
  }

  if (configuredStatus) {
    const normalizedStatus = configuredStatus.trim().toLocaleLowerCase();
    return IDENTIFICATION_STATUS_LABELS[normalizedStatus] ?? configuredStatus;
  }

  const unknownPatient = getAttributeValue(queueEntry, /paciente no identificado|unidentified patient/i);
  return /^true$/i.test(unknownPatient) ? 'Pendiente' : 'Confirmado';
}

export function getQueueEntryResponsibleName(queueEntry: EmergencyQueueEntry) {
  return getAttributeValue(queueEntry, /nombre del acompa[nñ]ante|responsable|companion name/i);
}

export function getQueueEntryCommunicationCondition(queueEntry: EmergencyQueueEntry) {
  const condition = getAttributeValue(queueEntry, /condici[oó]n.*comunicaci[oó]n|communication condition/i);
  const conditionLabels: Record<string, string> = {
    communicates: 'Puede comunicarse',
    unconscious: 'Inconsciente',
    comatose: 'Comatoso',
    disoriented: 'Desorientado',
    non_verbal: 'No verbal',
    minor_without_data: 'Menor sin datos',
    other: 'Otro',
  };

  return conditionLabels[condition] ?? condition;
}
