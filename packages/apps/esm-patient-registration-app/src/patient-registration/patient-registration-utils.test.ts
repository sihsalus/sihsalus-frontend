import {
  addressUbigeoField,
  addressUbigeoPathField,
  addressUbigeoPathSeparator,
  birthAddressMarker,
  birthAddressMarkerField,
  filterOutUndefinedPatientIdentifiers,
  getAddressFieldValuesFromFhirPatient,
  getFormValuesFromFhirPatient,
  getPatientUuidMapFromFhirPatient,
} from './patient-registration-utils';

describe('filterOutUndefinedPatientIdentifiers', () => {
  const getIdentifiers = (autoGeneration = true, manualEntryEnabled = false) => ({
    OpenMRSId: {
      autoGeneration: autoGeneration,
      identifierName: 'OpenMRS ID',
      identifierTypeUuid: '05a29f94-c0ed-11e2-94be-8c13b969e334',
      identifierValue: undefined,
      initialValue: '100GEJ',
      preferred: true,
      required: true,
      selectedSource: {
        uuid: '01af8526-cea4-4175-aa90-340acb411771',
        name: 'Generator for OpenMRS ID',
        autoGenerationOption: {
          manualEntryEnabled: manualEntryEnabled,
          automaticGenerationEnabled: autoGeneration,
        },
      },
    },
  });

  it('should fitler out undefined identifiers', () => {
    const filteredIdentifiers = filterOutUndefinedPatientIdentifiers(getIdentifiers());
    expect(filteredIdentifiers.OpenMRSId).not.toBeDefined();
  });

  it('should retain auto-generated identifiers with manual entry', () => {
    const filteredIdentifiers = filterOutUndefinedPatientIdentifiers(getIdentifiers(true, true));
    expect(filteredIdentifiers.OpenMRSId).toBeDefined();
  });

  it('does not throw when an incomplete auto-generated identifier has no source', () => {
    const identifiers = getIdentifiers();
    identifiers.OpenMRSId.selectedSource = undefined;

    expect(filterOutUndefinedPatientIdentifiers(identifiers).OpenMRSId).toBeUndefined();
  });
});

describe('structured patient addresses', () => {
  const openmrsAddressExtensionUrl = 'http://openmrs.org/fhir/StructureDefinition/address';

  const getOpenmrsAddressExtension = (values: Record<string, string>) => ({
    url: openmrsAddressExtensionUrl,
    extension: Object.entries(values).map(([field, value]) => ({
      url: `${openmrsAddressExtensionUrl}#${field}`,
      valueString: value,
    })),
  });

  const patient = {
    name: [{ id: 'name-uuid', given: ['Juan'], family: 'Perez' }],
    identifier: [],
    address: [
      {
        id: 'birth-address-uuid',
        country: 'PERU',
        state: 'MAYNAS',
        district: 'NAPO',
        use: 'old',
        extension: [
          getOpenmrsAddressExtension({
            address1: 'LORETO',
            cityVillage: 'SANTA CLOTILDE',
            [addressUbigeoField]: '1603030001',
            [addressUbigeoPathField]: ['PERU', 'LORETO', 'MAYNAS', 'NAPO', 'SANTA CLOTILDE'].join(
              addressUbigeoPathSeparator,
            ),
            [birthAddressMarkerField]: birthAddressMarker,
          }),
        ],
      },
      {
        id: 'residence-address-uuid',
        country: 'PERU',
        state: 'CHURCAMPA',
        district: 'CHURCAMPA',
        use: 'home',
        extension: [
          getOpenmrsAddressExtension({
            address1: 'HUANCAVELICA',
            address4: 'JR LIMA 123',
            [addressUbigeoField]: '090501',
            [addressUbigeoPathField]: ['PERU', 'HUANCAVELICA', 'CHURCAMPA', 'CHURCAMPA'].join(
              addressUbigeoPathSeparator,
            ),
          }),
        ],
      },
    ],
  } as unknown as fhir.Patient;

  it('reads the preferred residence address without using the birth address by position', () => {
    expect(getAddressFieldValuesFromFhirPatient(patient)).toEqual({
      address1: 'HUANCAVELICA',
      address13: ['PERU', 'HUANCAVELICA', 'CHURCAMPA', 'CHURCAMPA'].join(addressUbigeoPathSeparator),
      address14: '090501',
      address4: 'JR LIMA 123',
      country: 'PERU',
      countyDistrict: 'CHURCAMPA',
      stateProvince: 'CHURCAMPA',
    });
  });

  it('reads the structured birthplace address by marker', () => {
    expect(getAddressFieldValuesFromFhirPatient(patient, 'birth')).toEqual({
      address1: 'LORETO',
      address13: ['PERU', 'LORETO', 'MAYNAS', 'NAPO', 'SANTA CLOTILDE'].join(addressUbigeoPathSeparator),
      address14: '1603030001',
      address15: birthAddressMarker,
      cityVillage: 'SANTA CLOTILDE',
      country: 'PERU',
      countyDistrict: 'NAPO',
      stateProvince: 'MAYNAS',
    });
  });

  it('keeps separate address UUIDs for edit mode', () => {
    expect(getPatientUuidMapFromFhirPatient(patient)).toMatchObject({
      preferredAddressUuid: 'residence-address-uuid',
      birthAddressUuid: 'birth-address-uuid',
    });
  });
});

describe('legacy FHIR patient mapping', () => {
  it('maps a patient with missing names, identifiers, birthdate, and telecom without throwing', () => {
    const patient = { id: 'patient-uuid' } as fhir.Patient;

    expect(getFormValuesFromFhirPatient(patient)).toMatchObject({
      patientUuid: 'patient-uuid',
      givenName: '',
      familyName: '',
      gender: '',
      telephoneNumber: '',
    });
    expect(getPatientUuidMapFromFhirPatient(patient)).toEqual({
      preferredNameUuid: undefined,
      additionalNameUuid: undefined,
      preferredAddressUuid: undefined,
      birthAddressUuid: undefined,
    });
  });
});
