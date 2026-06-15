import { getDefaultVisitAttributesFromPatientAddress } from './visit-form.resource';

const provenanceVisitAttributeTypeUuid = '9b640334-69e7-49a8-bc8d-1a379742f2f1';
const addressExtensionUrl = 'http://openmrs.org/fhir/StructureDefinition/address';

function openmrsAddressExtension(field: string, value: string) {
  return {
    url: `${addressExtensionUrl}#${field}`,
    valueString: value,
  };
}

function openmrsAddressExtensions(...extensions: Array<ReturnType<typeof openmrsAddressExtension>>) {
  return {
    url: addressExtensionUrl,
    extension: extensions,
  };
}

describe('getDefaultVisitAttributesFromPatientAddress', () => {
  it('prefills a visit attribute from the patient residence address', () => {
    const patient = {
      address: [
        {
          use: 'home',
          city: 'San Rafael',
          district: 'Napo',
          state: 'Maynas',
          country: 'PERU',
          extension: [openmrsAddressExtensions(openmrsAddressExtension('address1', 'Loreto'))],
        },
      ],
    } as fhir.Patient;

    const defaults = getDefaultVisitAttributesFromPatientAddress(
      patient,
      [
        {
          visitAttributeTypeUuid: provenanceVisitAttributeTypeUuid,
          addressKind: 'residence',
          addressFields: ['cityVillage', 'countyDistrict', 'stateProvince', 'address1', 'country'],
          separator: ', ',
        },
      ],
      new Set([provenanceVisitAttributeTypeUuid]),
    );

    expect(defaults).toEqual({
      [provenanceVisitAttributeTypeUuid]: 'San Rafael, Napo, Maynas, Loreto, PERU',
    });
  });

  it('does not use a structured birth address as residence', () => {
    const patient = {
      address: [
        {
          use: 'home',
          city: 'Nacimiento',
          district: 'Nacimiento distrito',
          state: 'Nacimiento provincia',
          country: 'PERU',
          extension: [
            openmrsAddressExtensions(
              openmrsAddressExtension('address1', 'Nacimiento region'),
              openmrsAddressExtension('address15', 'SIHSALUS_BIRTH_ADDRESS'),
            ),
          ],
        },
        {
          use: 'home',
          city: 'Residencia',
          district: 'Residencia distrito',
          state: 'Residencia provincia',
          country: 'PERU',
          extension: [openmrsAddressExtensions(openmrsAddressExtension('address1', 'Residencia region'))],
        },
      ],
    } as fhir.Patient;

    const defaults = getDefaultVisitAttributesFromPatientAddress(
      patient,
      [
        {
          visitAttributeTypeUuid: provenanceVisitAttributeTypeUuid,
          addressKind: 'residence',
          addressFields: ['cityVillage', 'countyDistrict', 'stateProvince', 'address1', 'country'],
        },
      ],
      new Set([provenanceVisitAttributeTypeUuid]),
    );

    expect(defaults).toEqual({
      [provenanceVisitAttributeTypeUuid]:
        'Residencia, Residencia distrito, Residencia provincia, Residencia region, PERU',
    });
  });

  it('can explicitly prefill from the structured birth address', () => {
    const patient = {
      address: [
        {
          use: 'home',
          city: 'Residencia',
          district: 'Residencia distrito',
          state: 'Residencia provincia',
          country: 'PERU',
        },
        {
          city: 'Nacimiento',
          district: 'Nacimiento distrito',
          state: 'Nacimiento provincia',
          country: 'PERU',
          extension: [
            openmrsAddressExtensions(
              openmrsAddressExtension('address1', 'Nacimiento region'),
              openmrsAddressExtension('address15', 'SIHSALUS_BIRTH_ADDRESS'),
            ),
          ],
        },
      ],
    } as fhir.Patient;

    const defaults = getDefaultVisitAttributesFromPatientAddress(
      patient,
      [
        {
          visitAttributeTypeUuid: provenanceVisitAttributeTypeUuid,
          addressKind: 'birth',
          addressFields: ['cityVillage', 'countyDistrict', 'stateProvince', 'address1', 'country'],
        },
      ],
      new Set([provenanceVisitAttributeTypeUuid]),
    );

    expect(defaults).toEqual({
      [provenanceVisitAttributeTypeUuid]:
        'Nacimiento, Nacimiento distrito, Nacimiento provincia, Nacimiento region, PERU',
    });
  });

  it('skips defaults for visit attribute types that are not configured in the form', () => {
    const patient = {
      address: [
        {
          use: 'home',
          city: 'San Rafael',
        },
      ],
    } as fhir.Patient;

    const defaults = getDefaultVisitAttributesFromPatientAddress(
      patient,
      [
        {
          visitAttributeTypeUuid: provenanceVisitAttributeTypeUuid,
          addressKind: 'residence',
          addressFields: ['cityVillage'],
        },
      ],
      new Set(),
    );

    expect(defaults).toEqual({});
  });

  it('trims empty values and removes duplicate address segments', () => {
    const patient = {
      address: [
        {
          use: 'home',
          city: 'Napo ',
          district: 'Napo',
          state: '',
          country: 'PERU',
          extension: [openmrsAddressExtensions(openmrsAddressExtension('address1', 'Loreto'))],
        },
      ],
    } as fhir.Patient;

    const defaults = getDefaultVisitAttributesFromPatientAddress(
      patient,
      [
        {
          visitAttributeTypeUuid: provenanceVisitAttributeTypeUuid,
          addressKind: 'residence',
          addressFields: ['cityVillage', 'countyDistrict', 'stateProvince', 'address1', 'country'],
        },
      ],
      new Set([provenanceVisitAttributeTypeUuid]),
    );

    expect(defaults).toEqual({
      [provenanceVisitAttributeTypeUuid]: 'Napo, Loreto, PERU',
    });
  });
});
