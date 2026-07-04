import {
  peruCarnetExtranjeriaPatientIdentifierTypeUuid,
  peruDiePatientIdentifierTypeUuid,
  peruDniPatientIdentifierTypeUuid,
  peruPassportPatientIdentifierTypeUuid,
} from '../peru-registration-config';

// UUID/values must match the person attribute types and concept sets defined in
// sihsalus-content (configuration/backend_configuration/personattributetypes and
// the OCL concept sets referenced there). Keep these in sync when those change.
export const personDocumentTypeAttributeTypeUuid = '6f5c0b8a-9e91-4d41-9a8c-8b0f3c2e7a11';
export const personDocumentNumberAttributeTypeUuid = 'c0d1a2b3-4e5f-4a6b-9c7d-8e9f0a1b2c3d';
export const personIdentityVerificationStatusAttributeTypeUuid = 'a7e3f8c1-2d4b-4f9a-8c6e-1b2d3f4a5c6e';
export const personIdentityVerificationSourceAttributeTypeUuid = 'e2a9c7b1-5d6f-4c8a-9b3e-7f1d2a0c6e5b';
export const personIdentityVerifiedAtAttributeTypeUuid = '4a9e2c7f-6d1b-4b8a-9f3e-2c5d7a0b1e6f';
export const personIdentityVerificationObservationAttributeTypeUuid = 'd3e5b4d9-93c2-461e-822e-3cecd64b1842';

// Members of the concept set "Tipo de Documento de Identidad" (0ee5c6c4-16d0-5952-b3b3-d3a098e184fa).
export const documentTypeConceptUuids = {
  dni: 'f859ef8a-a7ca-5f74-b775-e19be71f5ba8',
  foreignResidentCard: 'a0dd88f1-d1b6-4829-8a89-c7849b7c9a59',
  passport: '1a7979b9-13a1-59b2-8c0a-761317539a8e',
  foreignIdentityDocument: '2019911c-f20a-4ae8-b8fe-d3feabe8272b',
  liveBirthCertificate: '030d9d03-c4e6-4917-89cb-f4b136247905',
  undocumented: '68d48b11-f25c-4fa3-97da-b024c2faf364',
} as const;

// Members of the concept set "Estado de Verificación de Identidad" (eae30f8f-02f7-497a-a9e6-5b6516301a6d).
export const identityVerificationStatusConceptUuids = {
  unverified: '4ff1586e-2186-4820-bc98-2535ddfbcb33',
  verifiedByReniec: '01c97f73-9e7d-420c-bd08-3ba82e8cc825',
  verifiedManually: '3f00a2b4-8de8-45d0-bf03-5d785f44df08',
  conflict: '67dd2ba3-b9d5-4338-8151-7cf0617b8e0a',
  undocumented: '48e7cf4d-8f2f-41a3-9b8d-5b28d1a17352',
} as const;

// Members of the concept set "Fuente de Verificación de Identidad" (95ae0627-f7bd-4819-83f1-98638b3bbaef).
export const identityVerificationSourceConceptUuids = {
  reniec: 'c5bf6928-2c1a-4ba0-8ba3-0f2114706c39',
  migrations: 'a3750b25-2e78-42e8-9ac3-c6b99f571459',
  physicalDocument: '84c5137f-78cb-4bb2-9c4d-f75ed9a6f185',
  bulkLoad: 'ddf88f81-df74-49c8-98ef-03284e5424e1',
  verbalDeclaration: '4c1afbf7-c99e-4cc8-a469-590b4a4c09f8',
  manual: '8c1e7ba7-5951-4f96-91ef-cc6772361535',
  none: 'b37b0f7a-0554-4ff1-a615-01b5dcf7cbd1',
} as const;

export interface DocumentTypeDefinition {
  documentTypeConceptUuid: string;
  /** Patient identifier type the document maps to when the person is promoted to patient. */
  patientIdentifierTypeUuid: string | null;
  /**
   * Mirrors the validator configured on the matching PatientIdentifierType so the same
   * rule can be enforced before the value reaches the backend as a person attribute.
   */
  validationRegex: RegExp | null;
  alphanumeric: boolean;
}

const cnvPatientIdentifierTypeUuid = '8d79403a-c2cc-11de-8d13-0010c6dffd0f';

export const documentTypeDefinitions: Array<DocumentTypeDefinition> = [
  {
    documentTypeConceptUuid: documentTypeConceptUuids.dni,
    patientIdentifierTypeUuid: peruDniPatientIdentifierTypeUuid,
    validationRegex: /^[0-9]{8}$/,
    alphanumeric: false,
  },
  {
    documentTypeConceptUuid: documentTypeConceptUuids.foreignResidentCard,
    patientIdentifierTypeUuid: peruCarnetExtranjeriaPatientIdentifierTypeUuid,
    validationRegex: /^[A-Za-z0-9]{6,12}$/,
    alphanumeric: true,
  },
  {
    documentTypeConceptUuid: documentTypeConceptUuids.passport,
    patientIdentifierTypeUuid: peruPassportPatientIdentifierTypeUuid,
    validationRegex: /^[A-Za-z0-9]{6,9}$/,
    alphanumeric: true,
  },
  {
    documentTypeConceptUuid: documentTypeConceptUuids.foreignIdentityDocument,
    patientIdentifierTypeUuid: peruDiePatientIdentifierTypeUuid,
    validationRegex: null,
    alphanumeric: true,
  },
  {
    documentTypeConceptUuid: documentTypeConceptUuids.liveBirthCertificate,
    patientIdentifierTypeUuid: cnvPatientIdentifierTypeUuid,
    validationRegex: /^[0-9]{12}$/,
    alphanumeric: false,
  },
  {
    documentTypeConceptUuid: documentTypeConceptUuids.undocumented,
    patientIdentifierTypeUuid: null,
    validationRegex: null,
    alphanumeric: false,
  },
];

export function getDocumentTypeDefinitionByConcept(documentTypeConceptUuid?: string) {
  if (!documentTypeConceptUuid) {
    return undefined;
  }

  return documentTypeDefinitions.find(
    (definition) => definition.documentTypeConceptUuid === documentTypeConceptUuid,
  );
}

export function getDocumentTypeDefinitionByIdentifierType(patientIdentifierTypeUuid?: string) {
  if (!patientIdentifierTypeUuid) {
    return undefined;
  }

  return documentTypeDefinitions.find(
    (definition) => definition.patientIdentifierTypeUuid === patientIdentifierTypeUuid,
  );
}

/**
 * Documents are persisted without spaces or dashes and upper-cased for alphanumeric
 * document types, so local search and duplicate detection match regardless of how the
 * number was typed.
 */
export function normalizeDocumentNumber(value: string, definition?: DocumentTypeDefinition) {
  const stripped = value.replace(/[\s-]+/g, '');
  return definition?.alphanumeric || !definition ? stripped.toUpperCase() : stripped;
}

export function isValidDocumentNumber(normalizedValue: string, definition?: DocumentTypeDefinition) {
  if (!normalizedValue) {
    return false;
  }

  if (!definition?.validationRegex) {
    return true;
  }

  return definition.validationRegex.test(normalizedValue);
}
