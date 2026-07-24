import { type SearchedPatient } from './types';

type MappedSearchedPatient = fhir.Patient & { id: string };

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function getNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

export function getSearchedPatientDisplayName(patient: SearchedPatient): string {
  const personName = patient.person?.personName;
  const display = getNonEmptyString(personName?.display);

  if (display) {
    return display;
  }

  const nameParts = [
    personName?.givenName,
    personName?.middleName,
    personName?.familyName,
    personName?.familyName2,
  ].filter((part): part is string => Boolean(getNonEmptyString(part)));

  return nameParts.join(' ') || patient.uuid;
}

export function isValidSearchedPatient(patient: unknown): patient is SearchedPatient {
  if (!isObject(patient)) {
    return false;
  }

  const candidate = patient as Partial<SearchedPatient>;
  const person = candidate.person;
  const personName = person?.personName;

  return (
    Boolean(getNonEmptyString(candidate.uuid)) &&
    isObject(person) &&
    isObject(personName) &&
    Boolean(
      getNonEmptyString(personName.display) ||
        getNonEmptyString(personName.givenName) ||
        getNonEmptyString(personName.familyName),
    )
  );
}

function mapGender(gender: unknown): fhir.Patient['gender'] {
  switch (gender) {
    case 'M':
      return 'male';
    case 'F':
      return 'female';
    case 'O':
      return 'other';
    case 'U':
      return 'unknown';
    case 'male':
    case 'female':
    case 'other':
    case 'unknown':
      return gender;
    default:
      return undefined;
  }
}

export function mapSearchedPatientToFhir(patient: SearchedPatient): MappedSearchedPatient {
  const addresses = Array.isArray(patient.person?.addresses) ? patient.person.addresses : [];
  const preferredAddress = addresses.find((address) => isObject(address) && address.preferred);
  const identifiers = Array.isArray(patient.identifiers) ? patient.identifiers : [];
  const personName = patient.person.personName;
  const givenNames = [personName?.givenName, personName?.middleName].filter(
    (name): name is string => Boolean(getNonEmptyString(name)),
  );
  const familyName = [personName?.familyName, personName?.familyName2]
    .filter((name): name is string => Boolean(getNonEmptyString(name)))
    .join(' ');

  return {
    resourceType: 'Patient',
    id: patient.uuid,
    address: preferredAddress
      ? [
          {
            city: getNonEmptyString(preferredAddress.cityVillage),
            country: getNonEmptyString(preferredAddress.country),
            state: getNonEmptyString(preferredAddress.stateProvince),
            use: 'home',
          },
        ]
      : [],
    birthDate: getNonEmptyString(patient.person.birthdate),
    deceasedBoolean: Boolean(patient.person.dead),
    deceasedDateTime: getNonEmptyString(patient.person.deathDate),
    gender: mapGender(patient.person.gender),
    identifier: identifiers.flatMap((identifier) => {
      if (!isObject(identifier)) {
        return [];
      }

      const identifierValue = getNonEmptyString(identifier.identifier);
      if (!identifierValue) {
        return [];
      }

      const identifierType = isObject(identifier.identifierType) ? identifier.identifierType : null;
      const identifierTypeUuid = getNonEmptyString(identifierType?.uuid);
      const identifierTypeDisplay = getNonEmptyString(identifierType?.display);

      return [
        {
          id: getNonEmptyString(identifier.uuid),
          type:
            identifierTypeUuid || identifierTypeDisplay
              ? {
                  coding: identifierTypeUuid ? [{ code: identifierTypeUuid }] : undefined,
                  text: identifierTypeDisplay,
                }
              : undefined,
          use: 'official' as const,
          value: identifierValue,
        },
      ];
    }),
    name: [
      {
        family: familyName || undefined,
        given: givenNames,
        text: getSearchedPatientDisplayName(patient),
      },
    ],
  };
}
