import { type SearchedPatient } from './types';
import {
  getSearchedPatientDisplayName,
  isValidSearchedPatient,
  mapSearchedPatientToFhir,
} from './patient-search-result.utils';

const patient = {
  uuid: 'patient-uuid',
  identifiers: [
    {
      uuid: 'identifier-uuid',
      identifier: '10000123',
      identifierType: null,
    },
    null,
  ],
  person: {
    addresses: [null],
    birthdate: '1990-01-01',
    dead: false,
    deathDate: null,
    gender: 'F',
    personName: {
      display: 'Paciente Prueba',
      givenName: 'Paciente',
      middleName: null,
      familyName: 'Prueba',
      familyName2: null,
    },
  },
  attributes: [
    {
      attributeType: null,
      value: null,
    },
  ],
} as unknown as SearchedPatient;

describe('patient search result utilities', () => {
  it('keeps a valid patient even when optional nested resources are incomplete', () => {
    expect(isValidSearchedPatient(patient)).toBe(true);
    expect(() => mapSearchedPatientToFhir(patient)).not.toThrow();

    const mappedPatient = mapSearchedPatientToFhir(patient);

    expect(mappedPatient.id).toBe('patient-uuid');
    expect(mappedPatient.name?.[0]?.text).toBe('Paciente Prueba');
    expect(mappedPatient.identifier).toEqual([
      expect.objectContaining({
        id: 'identifier-uuid',
        type: undefined,
        value: '10000123',
      }),
    ]);
    expect(mappedPatient.address).toEqual([]);
  });

  it('accepts patients without an identifiers collection', () => {
    const patientWithoutIdentifiers = {
      ...patient,
      identifiers: null,
    } as unknown as SearchedPatient;

    expect(isValidSearchedPatient(patientWithoutIdentifiers)).toBe(true);
    expect(mapSearchedPatientToFhir(patientWithoutIdentifiers).identifier).toEqual([]);
  });

  it('builds a readable name when the display value is absent', () => {
    const patientWithoutDisplayName = {
      ...patient,
      person: {
        ...patient.person,
        personName: {
          ...patient.person.personName,
          display: null,
        },
      },
    } as unknown as SearchedPatient;

    expect(isValidSearchedPatient(patientWithoutDisplayName)).toBe(true);
    expect(getSearchedPatientDisplayName(patientWithoutDisplayName)).toBe('Paciente Prueba');
  });

  it('rejects records that cannot be rendered as patients', () => {
    expect(isValidSearchedPatient(null)).toBe(false);
    expect(isValidSearchedPatient({ uuid: 'patient-uuid', person: { personName: null } })).toBe(false);
  });
});
