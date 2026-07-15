export const registrationErrorCodes = {
  clinicalConfigurationMissing: 'REGISTRATION_CLINICAL_CONFIGURATION_MISSING',
  duplicatePatientDocument: 'REGISTRATION_DUPLICATE_PATIENT_DOCUMENT',
  duplicatePersonDocument: 'REGISTRATION_DUPLICATE_PERSON_DOCUMENT',
  identifierLocationRequired: 'REGISTRATION_IDENTIFIER_LOCATION_REQUIRED',
  identifierRetryDeleteUnavailable: 'REGISTRATION_IDENTIFIER_RETRY_DELETE_UNAVAILABLE',
  identifierRetryUpdateUnavailable: 'REGISTRATION_IDENTIFIER_RETRY_UPDATE_UNAVAILABLE',
  identityVerificationMismatch: 'REGISTRATION_IDENTITY_VERIFICATION_MISMATCH',
  partialCreateIdentifierChanged: 'REGISTRATION_PARTIAL_CREATE_IDENTIFIER_CHANGED',
  partialSavePatientChanged: 'REGISTRATION_PARTIAL_SAVE_PATIENT_CHANGED',
  promotionAlreadyPatient: 'REGISTRATION_PROMOTION_ALREADY_PATIENT',
  promotionDocumentMismatch: 'REGISTRATION_PROMOTION_DOCUMENT_MISMATCH',
  promotionOffline: 'REGISTRATION_PROMOTION_OFFLINE',
  relationshipPersonRequired: 'REGISTRATION_RELATIONSHIP_PERSON_REQUIRED',
  relationshipRetryChanged: 'REGISTRATION_RELATIONSHIP_RETRY_CHANGED',
  relationshipUpdateInvalid: 'REGISTRATION_RELATIONSHIP_UPDATE_INVALID',
  responsiblePersonCreationFailed: 'REGISTRATION_RESPONSIBLE_PERSON_CREATION_FAILED',
} as const;

export type RegistrationErrorCode = (typeof registrationErrorCodes)[keyof typeof registrationErrorCodes];

interface RegistrationDomainErrorOptions {
  existingPatientUuid?: string;
  technicalDetails?: unknown;
}

export class RegistrationDomainError extends Error {
  readonly code: RegistrationErrorCode;
  readonly existingPatientUuid?: string;
  readonly technicalDetails?: unknown;

  constructor(code: RegistrationErrorCode, technicalMessage: string, options: RegistrationDomainErrorOptions = {}) {
    super(technicalMessage);
    this.name = 'RegistrationDomainError';
    this.code = code;
    this.existingPatientUuid = options.existingPatientUuid;
    this.technicalDetails = options.technicalDetails;
  }
}

const knownRegistrationErrorCodes = new Set<RegistrationErrorCode>(Object.values(registrationErrorCodes));

export function isRegistrationDomainError(error: unknown): error is RegistrationDomainError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    knownRegistrationErrorCodes.has((error as { code: RegistrationErrorCode }).code)
  );
}

export function getExistingPatientUuid(error: unknown): string | undefined {
  if (
    !isRegistrationDomainError(error) ||
    error.code !== registrationErrorCodes.duplicatePatientDocument ||
    typeof error.existingPatientUuid !== 'string'
  ) {
    return undefined;
  }

  return error.existingPatientUuid;
}
