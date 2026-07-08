import dayjs from 'dayjs';

import { type PatientIdentifier } from '../patient-registration.types';
import {
  getDocumentTypeDefinitionByConcept,
  isValidDocumentNumber,
  normalizeDocumentNumber,
  personDocumentNumberAttributeTypeUuid,
  personDocumentTypeAttributeTypeUuid,
} from './identity-documents';
import { type PersonForPromotion } from './identity-search.resource';

const genderCodeToFormValue: Record<string, string> = {
  M: 'male',
  F: 'female',
  O: 'other',
  U: 'unknown',
};

/**
 * REST returns birthdate as an ISO datetime in UTC (e.g. `1986-01-01T00:00:00.000+0000`).
 * Parsing that with `new Date(...)` shifts the calendar day back in timezones behind
 * UTC (Peru is UTC-5), so only the date part is used to build a local date.
 */
function parseBirthdateAsLocalDate(birthdate: string) {
  const [year, month, day] = birthdate.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
}

type SetFieldValue = (field: string, value: unknown, shouldValidate?: boolean) => void;
type SetFieldTouched = (field: string, isTouched?: boolean, shouldValidate?: boolean) => void;

export function getPreferredName(person: PersonForPromotion) {
  return person.names?.find((name) => name.preferred) ?? person.names?.[0];
}

export function getPreferredAddress(person: PersonForPromotion) {
  return person.addresses?.find((address) => address.preferred) ?? person.addresses?.[0];
}

export function getPersonDocument(person: PersonForPromotion) {
  const documentTypeValue = person.attributes?.find(
    (attribute) => attribute.attributeType.uuid === personDocumentTypeAttributeTypeUuid,
  )?.value;
  const documentNumberValue = person.attributes?.find(
    (attribute) => attribute.attributeType.uuid === personDocumentNumberAttributeTypeUuid,
  )?.value;

  return {
    documentTypeConceptUuid: typeof documentTypeValue === 'object' ? documentTypeValue?.uuid : undefined,
    documentNumber: typeof documentNumberValue === 'string' ? documentNumberValue : undefined,
  };
}

/**
 * Hydrates the registration form in place with an existing person so submitting
 * promotes that person instead of creating a new patient. Field-by-field updates (as
 * opposed to resetting Formik's initial values) preserve whatever the operator already
 * typed in unrelated fields, e.g. the document number in the identifier input.
 *
 * Setting `patientUuid` to the person UUID is what guarantees the promoted patient
 * keeps the same UUID; no new v4() is generated anywhere in this flow.
 */
export function applyPersonToRegistrationForm(
  person: PersonForPromotion,
  setFieldValue: SetFieldValue,
  setFieldTouched: SetFieldTouched,
) {
  const preferredName = getPreferredName(person);
  const birthdateEstimated = !!person.birthdateEstimated;
  const yearsEstimated =
    birthdateEstimated && person.birthdate ? Math.floor(dayjs().diff(person.birthdate, 'month') / 12) : 0;
  const monthsEstimated = birthdateEstimated && person.birthdate ? dayjs().diff(person.birthdate, 'month') % 12 : 0;

  const fieldValues: Array<[string, unknown]> = [
    ['patientUuid', person.uuid],
    ['personUuidToPromote', person.uuid],
    ['givenName', preferredName?.givenName ?? ''],
    ['middleName', preferredName?.middleName ?? ''],
    ['familyName', preferredName?.familyName ?? ''],
    ['familyName2', preferredName?.familyName2 ?? ''],
    ['gender', genderCodeToFormValue[person.gender ?? ''] ?? ''],
    ['birthdate', person.birthdate ? parseBirthdateAsLocalDate(person.birthdate) : null],
    ['birthdateEstimated', birthdateEstimated],
    ['yearsEstimated', yearsEstimated],
    ['monthsEstimated', monthsEstimated],
  ];

  person.attributes?.forEach((attribute) => {
    const value =
      attribute.attributeType.format === 'org.openmrs.Concept' && typeof attribute.value === 'object'
        ? attribute.value?.uuid
        : attribute.value;

    if (value !== undefined && value !== null) {
      fieldValues.push([`attributes.${attribute.attributeType.uuid}`, value]);
    }
  });

  const preferredAddress = getPreferredAddress(person);
  if (preferredAddress) {
    Object.entries(preferredAddress)
      .filter(([field, value]) => field !== 'uuid' && field !== 'preferred' && typeof value === 'string' && value)
      .forEach(([field, value]) => {
        fieldValues.push([`address.${field}`, value]);
      });
  }

  fieldValues.forEach(([field, value]) => {
    setFieldValue(field, value, false);
    setFieldTouched(field, true, false);
  });
}

/**
 * Clears the promotion state, handing the form a fresh UUID so submitting creates a
 * new patient again. Values the operator typed (or that were hydrated) are kept.
 */
export function clearPromotionSelection(freshPatientUuid: string, setFieldValue: SetFieldValue) {
  setFieldValue('personUuidToPromote', undefined, false);
  setFieldValue('patientUuid', freshPatientUuid, false);
}

/**
 * Maps the person's primary civil document (person attributes) to a patient identifier
 * during promotion. Skips the document when the form already provides an identifier of
 * the same type (the operator typically searched by that same number) and when the
 * number does not pass the PatientIdentifierType regex — the backend would reject the
 * whole promotion otherwise, and the number remains available as a person attribute.
 */
export function buildDocumentIdentifierForPromotion(
  person: PersonForPromotion,
  identifiersInPayload: Array<PatientIdentifier>,
  location: string,
): PatientIdentifier | null {
  const { documentTypeConceptUuid, documentNumber } = getPersonDocument(person);
  const definition = getDocumentTypeDefinitionByConcept(documentTypeConceptUuid);

  if (!definition?.patientIdentifierTypeUuid || !documentNumber) {
    return null;
  }

  const normalizedNumber = normalizeDocumentNumber(documentNumber, definition);

  if (!isValidDocumentNumber(normalizedNumber, definition)) {
    console.warn(
      `The person's document number does not match the format expected for its type; ` +
        `it will stay as a person attribute and no patient identifier will be created for it.`,
    );
    return null;
  }

  const alreadyInPayload = identifiersInPayload.some(
    (identifier) => identifier.identifierType === definition.patientIdentifierTypeUuid,
  );

  if (alreadyInPayload) {
    return null;
  }

  return {
    identifier: normalizedNumber,
    identifierType: definition.patientIdentifierTypeUuid,
    location,
    preferred: false,
  };
}
