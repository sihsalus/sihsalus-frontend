import { renderHook, waitFor } from '@testing-library/react';

import { type FetchResponse, openmrsFetch, type Visit } from '@openmrs/esm-framework';
import {
  ACCREDITATION_CHECKED_AT_PERSON_ATTRIBUTE_TYPE_UUID,
  ACCREDITATION_STATUS_PERSON_ATTRIBUTE_TYPE_UUID,
  INSURANCE_VERIFICATION_METHOD_PERSON_ATTRIBUTE_TYPE_UUID,
  SIS_ACCREDITATION_ACTIVE_CONCEPT_UUID,
  SIS_TEMPORARY_AFFILIATION_PATIENT_IDENTIFIER_TYPE_UUID,
} from '@openmrs/esm-patient-common-lib';

import {
  getDefaultVisitAttributesFromPatientAddress,
  getDefaultVisitAttributesFromPersonAttributes,
  getPatientIdentifierReferences,
  normalizeVisitTimeFormatInput,
  normalizeVisitTimeInput,
  reconcileVisitCreation,
  sanitizeVisitCoverageAttributes,
  sanitizeVisitTimeInput,
  useVisitAttributeTypeExists,
  VISIT_PERSISTENCE_CORRELATION_CONFLICT,
} from './visit-form.resource';

const provenanceVisitAttributeTypeUuid = '9b640334-69e7-49a8-bc8d-1a379742f2f1';
const insuranceCodePersonAttributeTypeUuid = '374b130f-7457-476f-87b1-f182aa77c434';
const insuranceTypePersonAttributeTypeUuid = '56188294-b42c-481d-a987-4b495116c580';
const insuranceNumberVisitAttributeTypeUuid = 'aac48226-d143-4274-80e0-264db4e368ee';
const financiadorVisitAttributeTypeUuid = '3a988e33-a6c0-4b76-b924-01abb998944b';
const accreditationStatusVisitAttributeTypeUuid = '5e13e902-2030-4f65-b9d5-9a4810c9a603';
const accreditationCheckedAtVisitAttributeTypeUuid = 'e3a66f60-4abe-4948-b323-7c4935d8eb8a';
const sisConceptUuid = '97c6e901-7570-4ab8-a9c0-9cf2b0f5bc0c';
const selfFinancedConceptUuid = 'cc72568e-d0d9-46a8-a618-91f0d679f518';
const addressExtensionUrl = 'http://openmrs.org/fhir/StructureDefinition/address';
const mockOpenmrsFetch = vi.mocked(openmrsFetch);

function buildFhirIdentifier(value: string, identifierTypeUuid?: string): fhir.Identifier {
  return {
    value,
    ...(identifierTypeUuid ? { type: { coding: [{ code: identifierTypeUuid }] } } : {}),
  };
}

describe('reconcileVisitCreation', () => {
  const patientUuid = 'patient-uuid';
  const correlation = { attributeType: 'appointment-link-type', value: 'appointment-uuid' };
  const payload = {
    patient: patientUuid,
    location: 'location-uuid',
    visitType: 'visit-type-uuid',
    startDatetime: new Date('2026-07-14T14:00:00.000Z'),
    attributes: [correlation],
  };
  const correlatedVisit = {
    uuid: 'visit-uuid',
    patient: { uuid: patientUuid },
    location: { uuid: payload.location },
    visitType: { uuid: payload.visitType, display: 'Consulta externa' },
    startDatetime: '2026-07-14T14:00:02.000Z',
    stopDatetime: null,
    attributes: [
      {
        uuid: 'link-attribute-uuid',
        attributeType: { uuid: correlation.attributeType },
        value: correlation.value,
      },
    ],
  } as unknown as Visit;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockVisitSearch = (results: Array<Visit>) =>
    mockOpenmrsFetch.mockResolvedValue({ data: { results } } as unknown as FetchResponse<unknown>);

  it('returns the unique active visit with the exact appointment correlation and context', async () => {
    mockVisitSearch([correlatedVisit]);

    await expect(reconcileVisitCreation(patientUuid, payload, correlation)).resolves.toEqual(correlatedVisit);
    expect(mockOpenmrsFetch).toHaveBeenCalledWith(
      expect.stringContaining(`/visit?patient=${patientUuid}&includeInactive=true`),
    );
  });

  it('returns null when no active visit has the correlation', async () => {
    mockVisitSearch([]);

    await expect(reconcileVisitCreation(patientUuid, payload, correlation)).resolves.toBeNull();
  });

  it('searches every visit page and deduplicates visits before correlating', async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      ...correlatedVisit,
      uuid: `uncorrelated-visit-${index}`,
      attributes: [],
    })) as Array<Visit>;
    mockOpenmrsFetch
      .mockResolvedValueOnce({ data: { results: firstPage } } as unknown as FetchResponse<unknown>)
      .mockResolvedValueOnce({
        data: { results: [firstPage[99], correlatedVisit] },
      } as unknown as FetchResponse<unknown>);

    await expect(reconcileVisitCreation(patientUuid, payload, correlation)).resolves.toEqual(correlatedVisit);
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(2);
    expect(mockOpenmrsFetch).toHaveBeenLastCalledWith(expect.stringContaining('startIndex=100'));
  });

  it('accepts a stopped correlated visit when the creation payload is stopped', async () => {
    const stoppedPayload = {
      ...payload,
      stopDatetime: new Date('2026-07-14T15:00:00.000Z'),
    };
    const stoppedVisit = {
      ...correlatedVisit,
      stopDatetime: '2026-07-14T15:00:00.000Z',
    } as Visit;
    mockVisitSearch([stoppedVisit]);

    await expect(reconcileVisitCreation(patientUuid, stoppedPayload, correlation)).resolves.toEqual(stoppedVisit);
  });

  it('rejects an active correlated visit when the creation payload is stopped', async () => {
    mockVisitSearch([correlatedVisit]);

    await expect(
      reconcileVisitCreation(
        patientUuid,
        { ...payload, stopDatetime: new Date('2026-07-14T15:00:00.000Z') },
        correlation,
      ),
    ).rejects.toMatchObject({
      code: VISIT_PERSISTENCE_CORRELATION_CONFLICT,
    });
  });

  it('fails closed when more than one active visit has the same correlation', async () => {
    mockVisitSearch([correlatedVisit, { ...correlatedVisit, uuid: 'second-visit-uuid' }]);

    await expect(reconcileVisitCreation(patientUuid, payload, correlation)).rejects.toMatchObject({
      code: VISIT_PERSISTENCE_CORRELATION_CONFLICT,
    });
  });

  it.each([
    ['patient', { patient: { uuid: 'other-patient' } }],
    ['location', { location: { uuid: 'other-location' } }],
    ['visit type', { visitType: { uuid: 'other-type', display: 'Otro tipo' } }],
    ['active state', { stopDatetime: '2026-07-14T15:00:00.000Z' }],
  ])('fails closed when the correlated visit has a different %s', async (_field, override) => {
    mockVisitSearch([{ ...correlatedVisit, ...override } as Visit]);

    await expect(reconcileVisitCreation(patientUuid, payload, correlation)).rejects.toMatchObject({
      code: VISIT_PERSISTENCE_CORRELATION_CONFLICT,
    });
  });
});

describe('visit time helpers', () => {
  it('removes non-time characters from the time input', () => {
    expect(sanitizeVisitTimeInput('ww')).toBe('');
    expect(sanitizeVisitTimeInput('ww930')).toBe('9:30');
    expect(sanitizeVisitTimeInput('12:3x4')).toBe('12:34');
  });

  it('normalizes valid time input to hh:mm', () => {
    expect(normalizeVisitTimeInput('9:3')).toBe('09:03');
    expect(normalizeVisitTimeInput('930')).toBe('09:30');
    expect(normalizeVisitTimeInput('13:00')).toBe('13:00');
  });

  it('normalizes AM/PM input and rejects invalid values', () => {
    expect(normalizeVisitTimeFormatInput(' pm ')).toBe('PM');
    expect(normalizeVisitTimeFormatInput('am')).toBe('AM');
    expect(normalizeVisitTimeFormatInput('')).toBeUndefined();
    expect(normalizeVisitTimeFormatInput('xx')).toBeUndefined();
  });
});

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

describe('getPatientIdentifierReferences', () => {
  it('preserves FHIR identifier types and leaves missing coding untyped', () => {
    expect(
      getPatientIdentifierReferences({
        identifier: [
          buildFhirIdentifier(' E-12345678 ', SIS_TEMPORARY_AFFILIATION_PATIENT_IDENTIFIER_TYPE_UUID),
          buildFhirIdentifier('72344001'),
        ],
      } as fhir.Patient),
    ).toEqual([
      { value: 'E-12345678', identifierTypeUuid: SIS_TEMPORARY_AFFILIATION_PATIENT_IDENTIFIER_TYPE_UUID },
      { value: '72344001', identifierTypeUuid: null },
    ]);
  });
});

describe('getDefaultVisitAttributesFromPersonAttributes', () => {
  const mapping = [
    {
      personAttributeTypeUuid: insuranceCodePersonAttributeTypeUuid,
      visitAttributeTypeUuid: insuranceNumberVisitAttributeTypeUuid,
    },
  ];
  const configuredAttributeUuids = new Set([insuranceNumberVisitAttributeTypeUuid]);
  const coverageAttributes = (
    payerUuid: string,
    insuranceCode: string,
    {
      status = SIS_ACCREDITATION_ACTIVE_CONCEPT_UUID,
      checkedAt = '2026-08-12T15:30:00.000-05:00',
      method = 'siasis-adt' as string | null,
    } = {},
  ) => [
    {
      uuid: 'payer-attribute',
      attributeType: { uuid: insuranceTypePersonAttributeTypeUuid, format: 'org.openmrs.Concept' },
      value: payerUuid,
    },
    {
      uuid: 'insurance-code-attribute',
      attributeType: { uuid: insuranceCodePersonAttributeTypeUuid, format: 'java.lang.String' },
      value: insuranceCode,
    },
    {
      uuid: 'accreditation-status-attribute',
      attributeType: { uuid: ACCREDITATION_STATUS_PERSON_ATTRIBUTE_TYPE_UUID, format: 'org.openmrs.Concept' },
      value: status,
    },
    {
      uuid: 'accreditation-checked-at-attribute',
      attributeType: { uuid: ACCREDITATION_CHECKED_AT_PERSON_ATTRIBUTE_TYPE_UUID, format: 'java.lang.String' },
      value: checkedAt,
    },
    ...(method
      ? [
          {
            uuid: 'verification-method-attribute',
            attributeType: {
              uuid: INSURANCE_VERIFICATION_METHOD_PERSON_ATTRIBUTE_TYPE_UUID,
              format: 'java.lang.String',
            },
            value: method,
          },
        ]
      : []),
  ];

  it('prefills the insurance number when it is distinct from the patient identifiers', () => {
    const defaults = getDefaultVisitAttributesFromPersonAttributes(
      { identifier: [{ value: '99990030' }] } as fhir.Patient,
      [
        {
          uuid: 'insurance-code-attribute',
          attributeType: { uuid: insuranceCodePersonAttributeTypeUuid, format: 'java.lang.String' },
          value: 'SIS-452781',
        },
      ],
      mapping,
      configuredAttributeUuids,
    );

    expect(defaults).toEqual({ [insuranceNumberVisitAttributeTypeUuid]: 'SIS-452781' });
  });

  it('does not use a patient identifier as the insurance number', () => {
    const defaults = getDefaultVisitAttributesFromPersonAttributes(
      { identifier: [{ value: '99990030' }, { value: '10000KM' }] } as fhir.Patient,
      [
        {
          uuid: 'contaminated-insurance-code-attribute',
          attributeType: { uuid: insuranceCodePersonAttributeTypeUuid, format: 'java.lang.String' },
          value: '99-990-030',
        },
      ],
      mapping,
      configuredAttributeUuids,
    );

    expect(defaults).toEqual({});
  });

  it('prefills a matching E-######## identifier as the insurance number for SIS', () => {
    const defaults = getDefaultVisitAttributesFromPersonAttributes(
      {
        identifier: [buildFhirIdentifier('E-12345678', SIS_TEMPORARY_AFFILIATION_PATIENT_IDENTIFIER_TYPE_UUID)],
      } as fhir.Patient,
      coverageAttributes(sisConceptUuid, 'E-12345678'),
      mapping,
      configuredAttributeUuids,
    );

    expect(defaults).toEqual({ [insuranceNumberVisitAttributeTypeUuid]: 'E-12345678' });
  });

  it.each([
    ['missing method', { method: null }],
    ['unknown method', { method: 'spreadsheet-import' }],
    ['date without time and zone', { checkedAt: '2026-08-12' }],
    ['inactive accreditation', { status: 'inactive-status' }],
  ])('does not prefill a typed E identifier with %s', (_caseName, evidenceOverride) => {
    const defaults = getDefaultVisitAttributesFromPersonAttributes(
      {
        identifier: [buildFhirIdentifier('E-12345678', SIS_TEMPORARY_AFFILIATION_PATIENT_IDENTIFIER_TYPE_UUID)],
      } as fhir.Patient,
      coverageAttributes(sisConceptUuid, 'E-12345678', evidenceOverride),
      mapping,
      configuredAttributeUuids,
    );

    expect(defaults).toEqual({});
  });

  it('does not prefill E-######## from empty or stale FHIR identifiers', () => {
    for (const patient of [
      {} as fhir.Patient,
      {
        identifier: [buildFhirIdentifier('E-87654321', SIS_TEMPORARY_AFFILIATION_PATIENT_IDENTIFIER_TYPE_UUID)],
      } as fhir.Patient,
    ]) {
      expect(
        getDefaultVisitAttributesFromPersonAttributes(
          patient,
          coverageAttributes(sisConceptUuid, 'E-12345678'),
          mapping,
          configuredAttributeUuids,
        ),
      ).toEqual({});
    }
  });

  it('blocks the same E value when FHIR reports another identifier type or no type', () => {
    for (const identifier of [buildFhirIdentifier('E-12345678', 'hce-type'), buildFhirIdentifier('E-12345678')]) {
      expect(
        getDefaultVisitAttributesFromPersonAttributes(
          { identifier: [identifier] } as fhir.Patient,
          coverageAttributes(sisConceptUuid, 'E-12345678'),
          mapping,
          configuredAttributeUuids,
        ),
      ).toEqual({});
    }
  });

  it('honors the configured deployment-specific temporary identifier type', () => {
    expect(
      getDefaultVisitAttributesFromPersonAttributes(
        { identifier: [buildFhirIdentifier('E-12345678', 'custom-temporary-sis-type')] } as fhir.Patient,
        coverageAttributes(sisConceptUuid, 'E-12345678'),
        mapping,
        configuredAttributeUuids,
        'custom-temporary-sis-type',
      ),
    ).toEqual({ [insuranceNumberVisitAttributeTypeUuid]: 'E-12345678' });
  });

  it('normalizes a legacy SIS plan when prefilling the visit financer', () => {
    const defaults = getDefaultVisitAttributesFromPersonAttributes(
      {} as fhir.Patient,
      [
        {
          uuid: 'legacy-sis-attribute',
          attributeType: { uuid: insuranceTypePersonAttributeTypeUuid, format: 'org.openmrs.Concept' },
          value: { uuid: 'b61a9ff9-1485-4388-9f67-9c341f847f85', display: 'SIS Gratuito' },
        },
      ],
      [
        {
          personAttributeTypeUuid: insuranceTypePersonAttributeTypeUuid,
          visitAttributeTypeUuid: financiadorVisitAttributeTypeUuid,
        },
      ],
      new Set([financiadorVisitAttributeTypeUuid]),
    );

    expect(defaults).toEqual({ [financiadorVisitAttributeTypeUuid]: sisConceptUuid });
  });
});

describe('sanitizeVisitCoverageAttributes', () => {
  const sisComplements = {
    [insuranceNumberVisitAttributeTypeUuid]: 'SIS-452781',
    [accreditationStatusVisitAttributeTypeUuid]: 'vigente-concept',
    [accreditationCheckedAtVisitAttributeTypeUuid]: '2026-08-11T14:30:00.000-05:00',
  };
  const trustedTemporarySisEvidence = {
    insuranceTypeUuid: sisConceptUuid,
    insuranceCode: 'E-12345678',
    accreditationStatusUuid: SIS_ACCREDITATION_ACTIVE_CONCEPT_UUID,
    accreditationCheckedAt: '2026-08-12T15:30:00.000-05:00',
    verificationMethod: 'siasis-adt',
  };

  it('keeps all applicable SIS coverage fields', () => {
    expect(
      sanitizeVisitCoverageAttributes({
        [financiadorVisitAttributeTypeUuid]: sisConceptUuid,
        ...sisComplements,
      }),
    ).toEqual({
      [financiadorVisitAttributeTypeUuid]: sisConceptUuid,
      ...sisComplements,
    });
  });

  it('clears SIS complements when the user changes the visit to self-financed care', () => {
    expect(
      sanitizeVisitCoverageAttributes({
        [financiadorVisitAttributeTypeUuid]: selfFinancedConceptUuid,
        ...sisComplements,
      }),
    ).toEqual({
      [financiadorVisitAttributeTypeUuid]: selfFinancedConceptUuid,
      [insuranceNumberVisitAttributeTypeUuid]: '',
      [accreditationStatusVisitAttributeTypeUuid]: '',
      [accreditationCheckedAtVisitAttributeTypeUuid]: '',
    });
  });

  it('keeps a general policy for another IAFAS but clears SIS-only fields', () => {
    expect(
      sanitizeVisitCoverageAttributes({
        [financiadorVisitAttributeTypeUuid]: 'essalud-concept',
        [insuranceNumberVisitAttributeTypeUuid]: 'ESSALUD-90',
        [accreditationStatusVisitAttributeTypeUuid]: 'stale-sis-status',
        [accreditationCheckedAtVisitAttributeTypeUuid]: '2026-08-11',
      }),
    ).toEqual({
      [financiadorVisitAttributeTypeUuid]: 'essalud-concept',
      [insuranceNumberVisitAttributeTypeUuid]: 'ESSALUD-90',
      [accreditationStatusVisitAttributeTypeUuid]: '',
      [accreditationCheckedAtVisitAttributeTypeUuid]: '',
    });
  });

  it('clears orphan coverage fields when no financer is selected', () => {
    expect(
      sanitizeVisitCoverageAttributes({
        [insuranceNumberVisitAttributeTypeUuid]: 'ORPHAN-90',
        [accreditationStatusVisitAttributeTypeUuid]: 'stale-sis-status',
      }),
    ).toMatchObject({
      [insuranceNumberVisitAttributeTypeUuid]: '',
      [accreditationStatusVisitAttributeTypeUuid]: '',
    });
  });

  it('clears an affiliation number that duplicates a document identifier', () => {
    expect(
      sanitizeVisitCoverageAttributes(
        {
          [financiadorVisitAttributeTypeUuid]: sisConceptUuid,
          [insuranceNumberVisitAttributeTypeUuid]: '72-344-001',
          [accreditationStatusVisitAttributeTypeUuid]: 'vigente-concept',
        },
        ['72344001'],
      ),
    ).toMatchObject({
      [insuranceNumberVisitAttributeTypeUuid]: '',
      [accreditationStatusVisitAttributeTypeUuid]: 'vigente-concept',
    });
  });

  it('keeps E-######## only for a typed temporary SIS identifier under SIS', () => {
    const attributes = {
      [financiadorVisitAttributeTypeUuid]: sisConceptUuid,
      [insuranceNumberVisitAttributeTypeUuid]: 'E-12345678',
    };

    expect(
      sanitizeVisitCoverageAttributes(
        attributes,
        [{ value: 'E-12345678', identifierTypeUuid: SIS_TEMPORARY_AFFILIATION_PATIENT_IDENTIFIER_TYPE_UUID }],
        true,
        SIS_TEMPORARY_AFFILIATION_PATIENT_IDENTIFIER_TYPE_UUID,
        trustedTemporarySisEvidence,
      ),
    ).toMatchObject({ [insuranceNumberVisitAttributeTypeUuid]: 'E-12345678' });
    expect(
      sanitizeVisitCoverageAttributes(attributes, [{ value: 'E-12345678', identifierTypeUuid: 'hce-type' }]),
    ).toMatchObject({ [insuranceNumberVisitAttributeTypeUuid]: '' });
  });

  it('clears E-######## when the identifier snapshot is empty or stale', () => {
    const attributes = {
      [financiadorVisitAttributeTypeUuid]: sisConceptUuid,
      [insuranceNumberVisitAttributeTypeUuid]: 'E-12345678',
    };

    expect(
      sanitizeVisitCoverageAttributes(
        attributes,
        [],
        true,
        SIS_TEMPORARY_AFFILIATION_PATIENT_IDENTIFIER_TYPE_UUID,
        trustedTemporarySisEvidence,
      ),
    ).toMatchObject({
      [insuranceNumberVisitAttributeTypeUuid]: '',
    });
    expect(
      sanitizeVisitCoverageAttributes(
        attributes,
        [
          {
            value: 'E-87654321',
            identifierTypeUuid: SIS_TEMPORARY_AFFILIATION_PATIENT_IDENTIFIER_TYPE_UUID,
          },
        ],
        true,
        SIS_TEMPORARY_AFFILIATION_PATIENT_IDENTIFIER_TYPE_UUID,
        trustedTemporarySisEvidence,
      ),
    ).toMatchObject({ [insuranceNumberVisitAttributeTypeUuid]: '' });
  });

  it.each([
    'E-1234',
    'E-123456789',
    'E 12345678',
    'E12345678',
  ])('clears malformed temporary SIS intent %s even without an identifier match', (insuranceNumber) => {
    expect(
      sanitizeVisitCoverageAttributes(
        {
          [financiadorVisitAttributeTypeUuid]: sisConceptUuid,
          [insuranceNumberVisitAttributeTypeUuid]: insuranceNumber,
          [accreditationStatusVisitAttributeTypeUuid]: 'vigente-concept',
          [accreditationCheckedAtVisitAttributeTypeUuid]: '2026-08-11T14:30:00.000-05:00',
        },
        [],
        true,
        SIS_TEMPORARY_AFFILIATION_PATIENT_IDENTIFIER_TYPE_UUID,
        { ...trustedTemporarySisEvidence, insuranceCode: insuranceNumber },
      ),
    ).toMatchObject({ [insuranceNumberVisitAttributeTypeUuid]: '' });
  });

  it('clears the temporary identifier when the selected visit payer is not SIS', () => {
    expect(
      sanitizeVisitCoverageAttributes(
        {
          [financiadorVisitAttributeTypeUuid]: 'essalud-concept',
          [insuranceNumberVisitAttributeTypeUuid]: 'E-12345678',
        },
        [{ value: 'E-12345678', identifierTypeUuid: SIS_TEMPORARY_AFFILIATION_PATIENT_IDENTIFIER_TYPE_UUID }],
        true,
        SIS_TEMPORARY_AFFILIATION_PATIENT_IDENTIFIER_TYPE_UUID,
        trustedTemporarySisEvidence,
      ),
    ).toMatchObject({ [insuranceNumberVisitAttributeTypeUuid]: '' });
  });

  it('honors the configured temporary SIS identifier type while sanitizing', () => {
    expect(
      sanitizeVisitCoverageAttributes(
        {
          [financiadorVisitAttributeTypeUuid]: sisConceptUuid,
          [insuranceNumberVisitAttributeTypeUuid]: 'E-12345678',
        },
        [{ value: 'E-12345678', identifierTypeUuid: 'custom-temporary-sis-type' }],
        true,
        'custom-temporary-sis-type',
        trustedTemporarySisEvidence,
      ),
    ).toMatchObject({ [insuranceNumberVisitAttributeTypeUuid]: 'E-12345678' });
  });

  it.each([null, 'spreadsheet-import'])('clears E-######## with untrusted verification method %s', (method) => {
    expect(
      sanitizeVisitCoverageAttributes(
        {
          [financiadorVisitAttributeTypeUuid]: sisConceptUuid,
          [insuranceNumberVisitAttributeTypeUuid]: 'E-12345678',
        },
        [{ value: 'E-12345678', identifierTypeUuid: SIS_TEMPORARY_AFFILIATION_PATIENT_IDENTIFIER_TYPE_UUID }],
        true,
        SIS_TEMPORARY_AFFILIATION_PATIENT_IDENTIFIER_TYPE_UUID,
        { ...trustedTemporarySisEvidence, verificationMethod: method },
      ),
    ).toMatchObject({ [insuranceNumberVisitAttributeTypeUuid]: '' });
  });
});

describe('getDefaultVisitAttributesFromPatientAddress', () => {
  it('removes document-like values from the prefilled provenance', () => {
    const patient = {
      address: [
        {
          use: 'home',
          city: '2-99990030',
          district: 'MAYNAS',
          country: 'PERU',
        },
      ],
    } as fhir.Patient;

    const defaults = getDefaultVisitAttributesFromPatientAddress(
      patient,
      [
        {
          visitAttributeTypeUuid: provenanceVisitAttributeTypeUuid,
          addressKind: 'residence',
          addressFields: ['cityVillage', 'countyDistrict', 'country'],
        },
      ],
      new Set([provenanceVisitAttributeTypeUuid]),
    );

    expect(defaults).toEqual({ [provenanceVisitAttributeTypeUuid]: 'MAYNAS, PERU' });
  });

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

describe('useVisitAttributeTypeExists', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns false without querying when no attribute type is configured', () => {
    const { result } = renderHook(() => useVisitAttributeTypeExists(undefined));

    expect(result.current).toBe(false);
    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
  });

  it('returns false when the backend does not have the attribute type', async () => {
    mockOpenmrsFetch.mockRejectedValue({ response: { status: 404 } });

    const { result } = renderHook(() => useVisitAttributeTypeExists('missing-attribute-type-uuid'));

    await waitFor(() => expect(result.current).toBe(false));
  });

  it('returns true when the attribute type exists', async () => {
    mockOpenmrsFetch.mockResolvedValue({
      data: { uuid: 'existing-attribute-type-uuid' },
    } as unknown as FetchResponse<unknown>);

    const { result } = renderHook(() => useVisitAttributeTypeExists('existing-attribute-type-uuid'));

    await waitFor(() => expect(mockOpenmrsFetch).toHaveBeenCalled());
    expect(result.current).toBe(true);
  });

  it('keeps the attribute on transient errors', async () => {
    mockOpenmrsFetch.mockRejectedValue({ response: { status: 500 } });

    const { result } = renderHook(() => useVisitAttributeTypeExists('unreachable-attribute-type-uuid'));

    await waitFor(() => expect(mockOpenmrsFetch).toHaveBeenCalled());
    expect(result.current).toBe(true);
  });
});
