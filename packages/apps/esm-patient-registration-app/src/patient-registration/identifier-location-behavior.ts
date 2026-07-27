import {
  type FormValues,
  type PatientIdentifier,
  type PatientIdentifierType,
  type PatientIdentifierValue,
} from './patient-registration.types';
import { RegistrationDomainError, registrationErrorCodes } from './registration-errors';

const missingIdentifierLocationMessage =
  'No se puede registrar el identificador porque falta la UPSS de sesión requerida por su tipo.';

const unknownIdentifierLocationBehaviorMessage =
  'No se puede registrar el identificador porque su tipo no tiene una política de ubicación válida.';

function isActiveIdentifier({ identifierValue, autoGeneration, selectedSource }: PatientIdentifierValue) {
  return Boolean(identifierValue || (autoGeneration && selectedSource));
}

/**
 * Applies the OpenMRS PatientIdentifierType.locationBehavior contract. Only
 * REQUIRED and NOT_USED are documented core values; unrecognised or absent
 * metadata is rejected before a patient write so it cannot be silently mapped
 * to the wrong UPSS.
 */
export function getIdentifierLocationPayload(
  identifierTypeUuid: string | undefined,
  identifierTypes: ReadonlyArray<PatientIdentifierType>,
  currentLocation: string,
): Pick<PatientIdentifier, 'location'> | Record<string, never> {
  const identifierType = (identifierTypes ?? []).find((type) => type.uuid === identifierTypeUuid);

  switch (identifierType?.locationBehavior) {
    case 'NOT_USED':
      return {};
    case 'REQUIRED':
      if (!currentLocation?.trim()) {
        throw new RegistrationDomainError(
          registrationErrorCodes.identifierLocationRequired,
          missingIdentifierLocationMessage,
          { technicalDetails: { identifierTypeUuid } },
        );
      }
      return { location: currentLocation };
    default:
      throw new RegistrationDomainError(
        registrationErrorCodes.identifierLocationBehaviorUnknown,
        unknownIdentifierLocationBehaviorMessage,
        {
          technicalDetails: {
            identifierTypeUuid,
            locationBehavior: identifierType?.locationBehavior,
          },
        },
      );
  }
}

/** Validates all active identifier rows before offline queuing or any API write. */
export function assertIdentifierLocationPolicies(
  identifiers: FormValues['identifiers'],
  identifierTypes: ReadonlyArray<PatientIdentifierType>,
  currentLocation: string,
) {
  for (const identifier of Object.values(identifiers ?? {})) {
    if (isActiveIdentifier(identifier)) {
      getIdentifierLocationPayload(identifier.identifierTypeUuid, identifierTypes, currentLocation);
    }
  }
}

export function getActiveIdentifierEntries(identifiers: FormValues['identifiers']) {
  return Object.entries(identifiers ?? {}).filter(([, identifier]) => isActiveIdentifier(identifier));
}
