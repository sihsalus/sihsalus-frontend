import { mapSearchedPatientToFhir } from './patient-search-mapper';
import { type SearchedPatient } from './types';

const patient: SearchedPatient = {
  attributes: [],
  identifiers: [
    {
      display: 'DNI = 12345678',
      identifier: '12345678',
      identifierType: {
        display: 'DNI',
        uuid: 'dni-identifier-type-uuid',
      },
      location: {
        display: 'Hospital Santa Clotilde',
        uuid: 'location-uuid',
      },
      preferred: true,
      uuid: 'identifier-uuid',
    },
  ],
  person: {
    addresses: [],
    age: 36,
    birthdate: '1990-01-01T00:00:00.000+0000',
    dead: false,
    deathDate: null,
    gender: 'M',
    personName: {
      display: 'Perez, Juan',
      familyName: 'Perez',
      familyName2: '',
      givenName: 'Juan',
      middleName: '',
    },
  },
  uuid: 'patient-uuid',
};

describe('mapSearchedPatientToFhir', () => {
  it('maps complete identifiers and their types', () => {
    const result = mapSearchedPatientToFhir(patient);

    expect(result.id).toBe('patient-uuid');
    expect(result.gender).toBe('male');
    expect(result.identifier).toEqual([
      {
        id: 'identifier-uuid',
        type: {
          coding: [{ code: 'dni-identifier-type-uuid' }],
          text: 'DNI',
        },
        use: 'official',
        value: '12345678',
      },
    ]);
  });

  it('keeps patients visible when identifier and attribute metadata is incomplete', () => {
    const patientWithIncompleteMetadata = {
      ...patient,
      attributes: [
        null,
        {
          attributeType: null,
          display: 'Telephone Number = 999999999',
          value: '999999999',
        },
      ],
      identifiers: [
        null,
        {
          ...patient.identifiers[0],
          identifier: 'LEGACY-1',
          identifierType: null,
          uuid: '',
        },
      ],
    } as unknown as SearchedPatient;

    expect(() => mapSearchedPatientToFhir(patientWithIncompleteMetadata)).not.toThrow();

    const result = mapSearchedPatientToFhir(patientWithIncompleteMetadata);
    expect(result.identifier).toEqual([
      {
        id: 'patient-uuid-identifier-0',
        use: 'official',
        value: 'LEGACY-1',
      },
    ]);
    expect(result.telecom).toEqual([]);
  });
});
