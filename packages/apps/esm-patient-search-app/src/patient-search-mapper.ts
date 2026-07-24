import { v4 as uuidv4 } from 'uuid';

import { type SearchedPatient } from './types';

function getGender(gender: string) {
  switch (gender) {
    case 'M':
      return 'male';
    case 'F':
      return 'female';
    case 'O':
      return 'other';
    case 'U':
      return 'unknown';
    default:
      return gender;
  }
}

export function mapSearchedPatientToFhir(patient: SearchedPatient) {
  const preferredAddress = patient.person.addresses?.find((address) => address.preferred);

  return {
    address: preferredAddress
      ? [
          {
            id: uuidv4(),
            city: preferredAddress.cityVillage,
            country: preferredAddress.country,
            state: preferredAddress.stateProvince,
            use: 'home',
          },
        ]
      : [],
    birthDate: patient.person.birthdate,
    deceasedBoolean: patient.person.dead,
    deceasedDateTime: patient.person.deathDate,
    gender: getGender(patient.person.gender),
    id: patient.uuid,
    identifier: (patient.identifiers ?? [])
      .filter((identifier) => Boolean(identifier))
      .map((identifier, index) => {
        const identifierType = identifier.identifierType;

        return {
          id: identifier.uuid || `${patient.uuid}-identifier-${index}`,
          ...(identifierType
            ? {
                type: {
                  coding: identifierType.uuid ? [{ code: identifierType.uuid }] : [],
                  text: identifierType.display,
                },
              }
            : {}),
          use: 'official',
          value: identifier.identifier,
        };
      }),
    name: [
      {
        family: [patient.person.personName.familyName, patient.person.personName.familyName2].filter(Boolean).join(' '),
        given: [patient.person.personName.givenName, patient.person.personName.middleName],
        id: uuidv4(),
        text: patient.person.personName.display,
      },
    ],
    telecom: patient.attributes?.filter((attribute) => attribute?.attributeType?.display === 'Telephone Number'),
  };
}
