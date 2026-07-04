import { peruDniPatientIdentifierTypeUuid } from '../peru-registration-config';
import {
  documentTypeConceptUuids,
  getDocumentTypeDefinitionByConcept,
  isValidDocumentNumber,
  normalizeDocumentNumber,
  personDocumentNumberAttributeTypeUuid,
  personDocumentTypeAttributeTypeUuid,
} from './identity-documents';
import { type PersonForPromotion } from './identity-search.resource';
import {
  applyPersonToRegistrationForm,
  buildDocumentIdentifierForPromotion,
  clearPromotionSelection,
} from './promotion';

const dniDefinition = getDocumentTypeDefinitionByConcept(documentTypeConceptUuids.dni);
const ceDefinition = getDocumentTypeDefinitionByConcept(documentTypeConceptUuids.foreignResidentCard);

function buildPerson(overrides: Partial<PersonForPromotion> = {}): PersonForPromotion {
  return {
    uuid: 'person-1',
    display: 'Rosa Flores',
    gender: 'F',
    birthdate: '1986-01-01',
    birthdateEstimated: false,
    names: [
      { uuid: 'name-1', preferred: true, givenName: 'Rosa', middleName: 'Elena', familyName: 'Flores' },
    ],
    addresses: [{ uuid: 'address-1', preferred: true, address1: 'Jr. Principal 123' }],
    attributes: [
      {
        uuid: 'attr-1',
        value: { uuid: documentTypeConceptUuids.dni, display: 'DNI' },
        attributeType: { uuid: personDocumentTypeAttributeTypeUuid, format: 'org.openmrs.Concept' },
      },
      {
        uuid: 'attr-2',
        value: '99887766',
        attributeType: { uuid: personDocumentNumberAttributeTypeUuid, format: 'java.lang.String' },
      },
    ],
    ...overrides,
  };
}

describe('normalizeDocumentNumber', () => {
  it('strips spaces and dashes', () => {
    expect(normalizeDocumentNumber(' 998 877-66 ', dniDefinition)).toBe('99887766');
  });

  it('upper-cases alphanumeric documents', () => {
    expect(normalizeDocumentNumber('ce-123 abc', ceDefinition)).toBe('CE123ABC');
  });
});

describe('isValidDocumentNumber', () => {
  it('applies the same regex as the matching PatientIdentifierType', () => {
    expect(isValidDocumentNumber('99887766', dniDefinition)).toBe(true);
    expect(isValidDocumentNumber('9988776', dniDefinition)).toBe(false);
    expect(isValidDocumentNumber('CE123ABC', ceDefinition)).toBe(true);
  });

  it('accepts any non-empty value for types without regex', () => {
    const dieDefinition = getDocumentTypeDefinitionByConcept(documentTypeConceptUuids.foreignIdentityDocument);
    expect(isValidDocumentNumber('X-99', dieDefinition)).toBe(true);
    expect(isValidDocumentNumber('', dieDefinition)).toBe(false);
  });
});

describe('buildDocumentIdentifierForPromotion', () => {
  it('maps the DNI person attribute to a DNI patient identifier', () => {
    const identifier = buildDocumentIdentifierForPromotion(buildPerson(), [], 'location-1');

    expect(identifier).toEqual({
      identifier: '99887766',
      identifierType: peruDniPatientIdentifierTypeUuid,
      location: 'location-1',
      preferred: false,
    });
  });

  it('does not duplicate an identifier type already present in the payload', () => {
    const identifier = buildDocumentIdentifierForPromotion(
      buildPerson(),
      [{ identifier: '99887766', identifierType: peruDniPatientIdentifierTypeUuid, location: 'location-1' }],
      'location-1',
    );

    expect(identifier).toBeNull();
  });

  it('skips document numbers that do not match the identifier type format', () => {
    const person = buildPerson({
      attributes: [
        {
          uuid: 'attr-1',
          value: { uuid: documentTypeConceptUuids.dni, display: 'DNI' },
          attributeType: { uuid: personDocumentTypeAttributeTypeUuid, format: 'org.openmrs.Concept' },
        },
        {
          uuid: 'attr-2',
          value: 'no-es-un-dni',
          attributeType: { uuid: personDocumentNumberAttributeTypeUuid, format: 'java.lang.String' },
        },
      ],
    });

    expect(buildDocumentIdentifierForPromotion(person, [], 'location-1')).toBeNull();
  });

  it('creates no identifier for undocumented persons', () => {
    const person = buildPerson({
      attributes: [
        {
          uuid: 'attr-1',
          value: { uuid: documentTypeConceptUuids.undocumented, display: 'Sin documento' },
          attributeType: { uuid: personDocumentTypeAttributeTypeUuid, format: 'org.openmrs.Concept' },
        },
      ],
    });

    expect(buildDocumentIdentifierForPromotion(person, [], 'location-1')).toBeNull();
  });
});

describe('applyPersonToRegistrationForm', () => {
  it('hydrates the form reusing the person UUID and marking the promotion', () => {
    const setFieldValue = vi.fn();
    const setFieldTouched = vi.fn();

    applyPersonToRegistrationForm(buildPerson(), setFieldValue, setFieldTouched);

    expect(setFieldValue).toHaveBeenCalledWith('patientUuid', 'person-1', false);
    expect(setFieldValue).toHaveBeenCalledWith('personUuidToPromote', 'person-1', false);
    expect(setFieldValue).toHaveBeenCalledWith('givenName', 'Rosa', false);
    expect(setFieldValue).toHaveBeenCalledWith('middleName', 'Elena', false);
    expect(setFieldValue).toHaveBeenCalledWith('familyName', 'Flores', false);
    expect(setFieldValue).toHaveBeenCalledWith('gender', 'female', false);
    expect(setFieldValue).toHaveBeenCalledWith(
      `attributes.${personDocumentNumberAttributeTypeUuid}`,
      '99887766',
      false,
    );
    expect(setFieldValue).toHaveBeenCalledWith(
      `attributes.${personDocumentTypeAttributeTypeUuid}`,
      documentTypeConceptUuids.dni,
      false,
    );
    expect(setFieldValue).toHaveBeenCalledWith('address.address1', 'Jr. Principal 123', false);

    const birthdateCall = setFieldValue.mock.calls.find(([field]) => field === 'birthdate');
    // Local date, not UTC: parsing the ISO datetime directly would shift the day back
    // in timezones behind UTC (Peru).
    expect(birthdateCall?.[1]).toEqual(new Date(1986, 0, 1));
  });

  it('parses UTC birthdate datetimes without shifting the calendar day', () => {
    const setFieldValue = vi.fn();

    applyPersonToRegistrationForm(
      buildPerson({ birthdate: '1986-01-01T00:00:00.000+0000' }),
      setFieldValue,
      vi.fn(),
    );

    const birthdateCall = setFieldValue.mock.calls.find(([field]) => field === 'birthdate');
    expect(birthdateCall?.[1]).toEqual(new Date(1986, 0, 1));
  });

  it('derives the estimated age fields for persons with estimated birthdate', () => {
    const setFieldValue = vi.fn();

    applyPersonToRegistrationForm(
      buildPerson({ birthdate: '1990-01-01', birthdateEstimated: true }),
      setFieldValue,
      vi.fn(),
    );

    expect(setFieldValue).toHaveBeenCalledWith('birthdateEstimated', true, false);
    const yearsCall = setFieldValue.mock.calls.find(([field]) => field === 'yearsEstimated');
    expect(yearsCall?.[1]).toBeGreaterThan(30);
  });
});

describe('clearPromotionSelection', () => {
  it('resets the promotion flag and assigns a fresh patient UUID', () => {
    const setFieldValue = vi.fn();

    clearPromotionSelection('fresh-uuid', setFieldValue);

    expect(setFieldValue).toHaveBeenCalledWith('personUuidToPromote', undefined, false);
    expect(setFieldValue).toHaveBeenCalledWith('patientUuid', 'fresh-uuid', false);
  });
});
