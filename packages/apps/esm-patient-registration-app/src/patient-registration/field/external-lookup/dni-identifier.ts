import { getDocumentTypeDefinitionByIdentifierType } from '../../identity/identity-documents';
import type { PatientIdentifierType, PatientIdentifierValue } from '../../patient-registration.types';
import { peruDniPatientIdentifierTypeUuid } from '../../peru-registration-config';

export const dniPattern = /^\d{8}$/;

/**
 * First identifier field holding a civil document number (DNI, CE, passport, DIE, CNV),
 * so identity lookups can run for foreigners too, not only for DNI holders.
 */
export function getDocumentIdentifierEntry(
  identifiers: Record<string, PatientIdentifierValue> = {},
  identifierTypes: Array<PatientIdentifierType> = [],
) {
  return Object.entries(identifiers).find(([fieldName, identifier]) => {
    if (!identifier?.identifierValue?.trim()) {
      return false;
    }

    const identifierType = identifierTypes.find(
      (type) => type.fieldName === fieldName || type.uuid === identifier.identifierTypeUuid,
    );
    const identifierTypeUuid = identifier.identifierTypeUuid ?? identifierType?.uuid;

    return !!getDocumentTypeDefinitionByIdentifierType(identifierTypeUuid);
  });
}

export function getDniIdentifier(
  identifiers: Record<string, PatientIdentifierValue> = {},
  identifierTypes: Array<PatientIdentifierType> = [],
) {
  return Object.entries(identifiers).find(([fieldName, identifier]) => {
    const identifierType = identifierTypes.find(
      (type) => type.fieldName === fieldName || type.uuid === identifier.identifierTypeUuid,
    );

    return (
      fieldName === 'dni' ||
      identifier.identifierTypeUuid === peruDniPatientIdentifierTypeUuid ||
      identifier.identifierName?.toLowerCase() === 'dni' ||
      identifierType?.uuid === peruDniPatientIdentifierTypeUuid ||
      identifierType?.name?.toLowerCase() === 'dni'
    );
  });
}
