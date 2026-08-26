import {
  getDocumentTypeDefinitionByIdentifierType,
  isValidDocumentNumber,
  normalizeDocumentNumber,
} from '../../identity/identity-documents';
import type { PatientIdentifierType, PatientIdentifierValue } from '../../patient-registration.types';
import { getPeruIdentifierRule, peruDniPattern } from '../../peru-identifier-validation';
import {
  peruDniPatientIdentifierTypeUuid,
  peruTemporaryAffiliationPatientIdentifierTypeUuid,
} from '../../peru-registration-config';

export const dniPattern = peruDniPattern;

function resolveIdentifierType(
  fieldName: string,
  identifier: PatientIdentifierValue,
  identifierTypes: Array<PatientIdentifierType>,
) {
  return identifierTypes.find((type) => type.fieldName === fieldName || type.uuid === identifier.identifierTypeUuid);
}

/**
 * Normalizes every identifier used as an identity reference with the same rule
 * as its input. In particular, temporary SIS affiliations keep their canonical
 * `E-########` separator; the civil-document fallback intentionally removes
 * separators instead.
 */
export function normalizeIdentityIdentifier(
  value: string,
  identifierTypeUuid?: string,
  identifierName?: string,
  identifierType?: PatientIdentifierType,
) {
  const rule = getPeruIdentifierRule(
    identifierType ?? (identifierTypeUuid ? { uuid: identifierTypeUuid, name: identifierName ?? '' } : null),
    identifierTypeUuid ? { identifierTypeUuid, identifierName: identifierName ?? '' } : null,
  );

  if (rule) {
    return rule.sanitize(value.trim());
  }

  return normalizeDocumentNumber(value, getDocumentTypeDefinitionByIdentifierType(identifierTypeUuid));
}

export function isValidIdentityIdentifier(
  normalizedValue: string,
  identifierTypeUuid?: string,
  identifierName?: string,
  identifierType?: PatientIdentifierType,
) {
  const rule = getPeruIdentifierRule(
    identifierType ?? (identifierTypeUuid ? { uuid: identifierTypeUuid, name: identifierName ?? '' } : null),
    identifierTypeUuid ? { identifierTypeUuid, identifierName: identifierName ?? '' } : null,
  );

  return rule
    ? rule.pattern.test(normalizedValue)
    : isValidDocumentNumber(normalizedValue, getDocumentTypeDefinitionByIdentifierType(identifierTypeUuid));
}

/** Returns every populated identifier accepted as the patient's primary identity reference. */
export function getDocumentIdentifierEntries(
  identifiers: Record<string, PatientIdentifierValue> = {},
  identifierTypes: Array<PatientIdentifierType> = [],
) {
  return Object.entries(identifiers).filter(([fieldName, identifier]) => {
    if (!identifier?.identifierValue?.trim()) {
      return false;
    }

    const identifierType = resolveIdentifierType(fieldName, identifier, identifierTypes);
    const identifierTypeUuid = identifier.identifierTypeUuid ?? identifierType?.uuid;

    return (
      identifierTypeUuid === peruTemporaryAffiliationPatientIdentifierTypeUuid ||
      !!getDocumentTypeDefinitionByIdentifierType(identifierTypeUuid)
    );
  });
}

export function getTemporaryAffiliationIdentifierEntry(
  identifiers: Record<string, PatientIdentifierValue> = {},
  identifierTypes: Array<PatientIdentifierType> = [],
) {
  return Object.entries(identifiers).find(([fieldName, identifier]) => {
    const identifierType = resolveIdentifierType(fieldName, identifier, identifierTypes);
    return (
      (identifier.identifierTypeUuid ?? identifierType?.uuid) === peruTemporaryAffiliationPatientIdentifierTypeUuid
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
