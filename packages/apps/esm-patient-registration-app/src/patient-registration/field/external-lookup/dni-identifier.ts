import { getDocumentTypeDefinitionByIdentifierType } from '../../identity/identity-documents';
import type { PatientIdentifierType, PatientIdentifierValue } from '../../patient-registration.types';
import { peruDniPattern } from '../../peru-identifier-validation';
import {
  peruDniPatientIdentifierTypeUuid,
  peruTemporaryAffiliationPatientIdentifierTypeUuid,
} from '../../peru-registration-config';

export const dniPattern = peruDniPattern;

/** Returns every populated identifier accepted as the patient's primary identity reference. */
export function getDocumentIdentifierEntries(
  identifiers: Record<string, PatientIdentifierValue> = {},
  identifierTypes: Array<PatientIdentifierType> = [],
) {
  return Object.entries(identifiers).filter(([fieldName, identifier]) => {
    if (!identifier?.identifierValue?.trim()) {
      return false;
    }

    const identifierType = identifierTypes.find(
      (type) => type.fieldName === fieldName || type.uuid === identifier.identifierTypeUuid,
    );
    const identifierTypeUuid = identifier.identifierTypeUuid ?? identifierType?.uuid;

    return (
      identifierTypeUuid === peruTemporaryAffiliationPatientIdentifierTypeUuid ||
      !!getDocumentTypeDefinitionByIdentifierType(identifierTypeUuid)
    );
  });
}

/** First populated civil document, used by the interactive identity lookup. */
export function getDocumentIdentifierEntry(
  identifiers: Record<string, PatientIdentifierValue> = {},
  identifierTypes: Array<PatientIdentifierType> = [],
) {
  return getDocumentIdentifierEntries(identifiers, identifierTypes)[0];
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
