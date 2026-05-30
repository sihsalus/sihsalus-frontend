import { type EmergencyQueueEntry } from '../../resources/emergency.resource';

function getAttributeValue(queueEntry: EmergencyQueueEntry, pattern: RegExp) {
  const attribute = queueEntry.patient.person?.attributes?.find((attribute) =>
    pattern.test(attribute.attributeType?.display ?? ''),
  );
  const value = attribute?.value;

  return typeof value === 'string' ? value : (value?.display ?? '');
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

export function getQueueEntryIdentificationStatus(queueEntry: EmergencyQueueEntry) {
  const configuredStatus = getAttributeValue(queueEntry, /estado.*identificaci[oó]n|identification status/i);
  if (configuredStatus) {
    const statusLabels: Record<string, string> = {
      pending: 'Pendiente',
      partial: 'Parcial',
      confirmed: 'Confirmado',
      merged: 'Fusionado',
    };

    return statusLabels[configuredStatus.trim().toLocaleLowerCase()] ?? configuredStatus;
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
