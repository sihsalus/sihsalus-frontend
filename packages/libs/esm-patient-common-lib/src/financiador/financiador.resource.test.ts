import { omrsOfflineCachingStrategyHttpHeaderName, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';

import {
  getPersonSisFinancingState,
  ACCREDITATION_CHECKED_AT_PERSON_ATTRIBUTE_TYPE_UUID,
  ACCREDITATION_STATUS_PERSON_ATTRIBUTE_TYPE_UUID,
  copyFinanciadorToVisit,
  FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID,
  fetchFreshPatientIdentifiers,
  fetchFreshPersonInsurance,
  fetchPersonInsurance,
  fetchVisitInsurance,
  getCodedValueUuid,
  getSisFinancingState,
  getTextValue,
  INSURANCE_CODE_PERSON_ATTRIBUTE_TYPE_UUID,
  INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID,
  INSURANCE_TYPE_PERSON_ATTRIBUTE_TYPE_UUID,
  INSURANCE_VERIFICATION_METHOD_PERSON_ATTRIBUTE_TYPE_UUID,
  isInsuranceCodeAllowed,
  LEGACY_SIS_PRODUCT_CONCEPT_UUIDS,
  isTriageFinancingEligible,
  normalizeFinanciadorConceptUuid,
  SELF_FINANCED_CONCEPT_UUID,
  SIS_ACCREDITATION_CHECKED_AT_VISIT_ATTRIBUTE_TYPE_UUID,
  SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID,
  SIS_ACCREDITATION_ACTIVE_CONCEPT_UUID,
  SIS_ACCREDITATION_INACTIVE_CONCEPT_UUID,
  SIS_ACCREDITATION_NOT_CONSULTED_CONCEPT_UUID,
  SIS_ACCREDITATION_PENDING_CONCEPT_UUID,
  SIS_CONCEPT_UUID,
  SIS_TEMPORARY_AFFILIATION_PATIENT_IDENTIFIER_TYPE_UUID,
  safeCopyFinanciadorToVisit,
} from './financiador.resource';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  openmrsFetch: vi.fn(),
}));

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

const patientUuid = 'patient-uuid-1';
const visitUuid = 'visit-uuid-1';
const personUrl = `${restBaseUrl}/person/${patientUuid}?v=custom:(attributes:(uuid,value,attributeType:(uuid)))`;
const identifiersUrl = `${restBaseUrl}/patient/${patientUuid}?v=custom:(identifiers:(identifier,identifierType:(uuid),voided))`;
const visitUrl = `${restBaseUrl}/visit/${visitUuid}?v=custom:(attributes:(uuid,value,attributeType:(uuid)))`;

function isPersonInsuranceReadUrl(url: string) {
  return url === personUrl || url.startsWith(`${restBaseUrl}/person/${patientUuid}?`);
}

function isPatientIdentifiersReadUrl(url: string) {
  return url === identifiersUrl || url.startsWith(`${restBaseUrl}/patient/${patientUuid}?`);
}

const essaludConceptUuid = 'af799b5e-313c-4352-80c4-5007dcd42f29';
const accreditationVigenteUuid = SIS_ACCREDITATION_ACTIVE_CONCEPT_UUID;
const accreditationCheckedAt = '2026-08-11T14:30:00.000-05:00';

type PersonAttribute = {
  uuid: string;
  value: string | { uuid?: string; display?: string } | null;
  attributeType: { uuid: string };
};

function temporarySisPersonAttributes(
  verificationMethod: string | null = 'siasis-adt',
  accreditationCheckedAtValue = accreditationCheckedAt,
): Array<PersonAttribute> {
  return [
    {
      uuid: 'attr-1',
      value: SIS_CONCEPT_UUID,
      attributeType: { uuid: INSURANCE_TYPE_PERSON_ATTRIBUTE_TYPE_UUID },
    },
    {
      uuid: 'attr-2',
      value: 'E-12345678',
      attributeType: { uuid: INSURANCE_CODE_PERSON_ATTRIBUTE_TYPE_UUID },
    },
    {
      uuid: 'attr-3',
      value: SIS_ACCREDITATION_ACTIVE_CONCEPT_UUID,
      attributeType: { uuid: ACCREDITATION_STATUS_PERSON_ATTRIBUTE_TYPE_UUID },
    },
    {
      uuid: 'attr-4',
      value: accreditationCheckedAtValue,
      attributeType: { uuid: ACCREDITATION_CHECKED_AT_PERSON_ATTRIBUTE_TYPE_UUID },
    },
    ...(verificationMethod
      ? [
          {
            uuid: 'attr-5',
            value: verificationMethod,
            attributeType: { uuid: INSURANCE_VERIFICATION_METHOD_PERSON_ATTRIBUTE_TYPE_UUID },
          },
        ]
      : []),
  ];
}

function mockFetchSequence({
  personAttributes = [],
  patientIdentifiers = [],
  visitAttributes = [],
}: {
  personAttributes?: Array<PersonAttribute>;
  patientIdentifiers?: Array<{
    identifier: string;
    identifierType?: { uuid?: string };
    voided?: boolean;
  }>;
  visitAttributes?: Array<PersonAttribute>;
}) {
  mockOpenmrsFetch.mockImplementation((url: string) => {
    if (isPersonInsuranceReadUrl(url)) {
      return Promise.resolve({ data: { attributes: personAttributes } }) as never;
    }
    if (url === visitUrl) {
      return Promise.resolve({ data: { attributes: visitAttributes } }) as never;
    }
    if (isPatientIdentifiersReadUrl(url)) {
      return Promise.resolve({ data: { identifiers: patientIdentifiers } }) as never;
    }
    // Escrituras (POST a /visit/{uuid}/attribute[...]) devuelven ok.
    return Promise.resolve({ data: {} }) as never;
  });
}

function getWriteCalls() {
  return mockOpenmrsFetch.mock.calls.filter(([, init]) => (init as { method?: string } | undefined)?.method === 'POST');
}

function getDeleteCalls() {
  return mockOpenmrsFetch.mock.calls.filter(
    ([, init]) => (init as { method?: string } | undefined)?.method === 'DELETE',
  );
}

type StatefulWrite = {
  url: string;
  method: string;
  body?: { attributeType?: string; value?: string };
};

function mockStatefulVisitPersistence({
  personAttributes,
  initialVisitAttributes,
  failOnceWhen,
}: {
  personAttributes: Array<PersonAttribute>;
  initialVisitAttributes: Array<PersonAttribute>;
  failOnceWhen: (write: StatefulWrite) => boolean;
}) {
  const visitAttributes = initialVisitAttributes.map((attribute) => ({ ...attribute }));
  let failurePending = true;
  let nextCreatedUuid = 1;

  mockOpenmrsFetch.mockImplementation((url: string, init?: { method?: string; body?: unknown }) => {
    if (!init?.method && isPersonInsuranceReadUrl(url)) {
      return Promise.resolve({ data: { attributes: personAttributes } }) as never;
    }
    if (!init?.method && isPatientIdentifiersReadUrl(url)) {
      return Promise.resolve({ data: { identifiers: [] } }) as never;
    }
    if (!init?.method && url === visitUrl) {
      return Promise.resolve({ data: { attributes: visitAttributes.map((attribute) => ({ ...attribute })) } }) as never;
    }

    const write = {
      url,
      method: init?.method ?? '',
      body: init?.body as StatefulWrite['body'],
    };
    if (failurePending && failOnceWhen(write)) {
      failurePending = false;
      return Promise.reject(new Error('simulated partial write failure')) as never;
    }

    if (write.method === 'DELETE') {
      const attributeUuid = url.split('/').at(-1);
      const attributeIndex = visitAttributes.findIndex(({ uuid }) => uuid === attributeUuid);
      if (attributeIndex >= 0) {
        visitAttributes.splice(attributeIndex, 1);
      }
    } else if (write.method === 'POST' && write.body) {
      if (write.body.attributeType) {
        visitAttributes.push({
          uuid: `created-${nextCreatedUuid++}`,
          value: write.body.value ?? null,
          attributeType: { uuid: write.body.attributeType },
        });
      } else {
        const attributeUuid = url.split('/').at(-1);
        const existing = visitAttributes.find(({ uuid }) => uuid === attributeUuid);
        if (existing) {
          existing.value = write.body.value ?? null;
        }
      }
    }

    return Promise.resolve({ data: {} }) as never;
  });

  return {
    getValue: (attributeTypeUuid: string) =>
      visitAttributes.find(({ attributeType }) => attributeType.uuid === attributeTypeUuid)?.value ?? null,
    hasAttribute: (attributeTypeUuid: string) =>
      visitAttributes.some(({ attributeType }) => attributeType.uuid === attributeTypeUuid),
  };
}

beforeEach(() => {
  mockOpenmrsFetch.mockReset();
});

describe('value mapping helpers', () => {
  it('extracts coded UUIDs from hydrated objects and plain strings', () => {
    expect(getCodedValueUuid({ uuid: 'abc', display: 'SIS' })).toBe('abc');
    expect(getCodedValueUuid('abc')).toBe('abc');
    expect(getCodedValueUuid('  ')).toBeNull();
    expect(getCodedValueUuid(null)).toBeNull();
    expect(getCodedValueUuid({ display: 'sin uuid' })).toBeNull();
  });

  it('extracts text values from strings and objects', () => {
    expect(getTextValue('COD-123')).toBe('COD-123');
    expect(getTextValue({ display: 'COD-123' })).toBe('COD-123');
    expect(getTextValue('')).toBeNull();
    expect(getTextValue(undefined)).toBeNull();
  });
});

describe('normalizeFinanciadorConceptUuid', () => {
  it.each(LEGACY_SIS_PRODUCT_CONCEPT_UUIDS)('normalizes legacy SIS product %s to the SIS concept', (legacyUuid) => {
    expect(normalizeFinanciadorConceptUuid(legacyUuid)).toBe(SIS_CONCEPT_UUID);
  });

  it('reconoce «Plan de atención SIS» como SIS para el gating clínico', () => {
    // El catálogo lo ofrece como financiador de primer nivel y el registro de
    // pacientes ya lo acepta como SIS. Si el gating no lo normaliza, un
    // paciente asegurado queda bloqueado en triaje y derivado a Caja.
    const planDeAtencionSis = 'b76a9a24-4905-4132-a215-8a567281852a';
    expect(normalizeFinanciadorConceptUuid(planDeAtencionSis)).toBe(SIS_CONCEPT_UUID);
    expect(
      getSisFinancingState({
        financiadorUuid: planDeAtencionSis,
        insuranceNumber: 'SIS-12345',
        accreditationStatusUuid: SIS_ACCREDITATION_ACTIVE_CONCEPT_UUID,
        accreditationCheckedAt: '2026-08-01T10:00:00.000Z',
      }),
    ).toBe('active');
  });

  it('keeps non-SIS financiadores untouched', () => {
    expect(normalizeFinanciadorConceptUuid(essaludConceptUuid)).toBe(essaludConceptUuid);
    expect(normalizeFinanciadorConceptUuid(SIS_CONCEPT_UUID)).toBe(SIS_CONCEPT_UUID);
    expect(normalizeFinanciadorConceptUuid(null)).toBeNull();
  });

  it('honors overridden catalog UUIDs', () => {
    expect(
      normalizeFinanciadorConceptUuid('legacy-x', {
        sisConceptUuid: 'sis-x',
        legacySisProductConceptUuids: ['legacy-x'],
      }),
    ).toBe('sis-x');
  });
});

describe('insurance code and patient identifier contract', () => {
  const temporaryCode = 'E-12345678';

  it('allows the configured temporary E identifier only for SIS', () => {
    expect(
      isInsuranceCodeAllowed(temporaryCode, SIS_CONCEPT_UUID, [
        { value: temporaryCode, identifierTypeUuid: SIS_TEMPORARY_AFFILIATION_PATIENT_IDENTIFIER_TYPE_UUID },
      ]),
    ).toBe(true);
  });

  it('honors a deployment-specific temporary affiliation identifier type', () => {
    expect(
      isInsuranceCodeAllowed(
        temporaryCode,
        SIS_CONCEPT_UUID,
        [{ value: temporaryCode, identifierTypeUuid: 'custom-temporary-sis-type' }],
        'custom-temporary-sis-type',
      ),
    ).toBe(true);
  });

  it('blocks E-######## when SIS has no exact matching temporary identifier', () => {
    expect(isInsuranceCodeAllowed(temporaryCode, SIS_CONCEPT_UUID, [])).toBe(false);
    expect(
      isInsuranceCodeAllowed(temporaryCode, SIS_CONCEPT_UUID, [
        {
          value: 'E-87654321',
          identifierTypeUuid: SIS_TEMPORARY_AFFILIATION_PATIENT_IDENTIFIER_TYPE_UUID,
        },
      ]),
    ).toBe(false);
  });

  it.each([
    'dni-type',
    'ce-type',
    'passport-type',
    'hce-type',
    'other-type',
  ])('blocks an E-shaped match classified as %s', (identifierTypeUuid) => {
    expect(
      isInsuranceCodeAllowed(temporaryCode, SIS_CONCEPT_UUID, [{ value: temporaryCode, identifierTypeUuid }]),
    ).toBe(false);
  });

  it('blocks untyped, non-SIS, non-E and ambiguously typed matches', () => {
    expect(isInsuranceCodeAllowed(temporaryCode, SIS_CONCEPT_UUID, [temporaryCode])).toBe(false);
    expect(
      isInsuranceCodeAllowed(temporaryCode, essaludConceptUuid, [
        { value: temporaryCode, identifierTypeUuid: SIS_TEMPORARY_AFFILIATION_PATIENT_IDENTIFIER_TYPE_UUID },
      ]),
    ).toBe(false);
    expect(
      isInsuranceCodeAllowed('12345678', SIS_CONCEPT_UUID, [
        { value: '12-345-678', identifierTypeUuid: SIS_TEMPORARY_AFFILIATION_PATIENT_IDENTIFIER_TYPE_UUID },
      ]),
    ).toBe(false);
    expect(
      isInsuranceCodeAllowed('E 12345678', SIS_CONCEPT_UUID, [
        { value: temporaryCode, identifierTypeUuid: SIS_TEMPORARY_AFFILIATION_PATIENT_IDENTIFIER_TYPE_UUID },
      ]),
    ).toBe(false);
    expect(
      isInsuranceCodeAllowed(temporaryCode, SIS_CONCEPT_UUID, [
        { value: temporaryCode, identifierTypeUuid: SIS_TEMPORARY_AFFILIATION_PATIENT_IDENTIFIER_TYPE_UUID },
        { value: 'E 12345678', identifierTypeUuid: 'hce-type' },
      ]),
    ).toBe(false);
  });

  it.each([
    'E12345678',
    'E 12345678',
    'E-123456789',
    'E-1234',
    'E 1234',
    'E1234',
  ])('does not let malformed typed identifier %s validate a canonical temporary code', (identifierValue) => {
    expect(
      isInsuranceCodeAllowed(temporaryCode, SIS_CONCEPT_UUID, [
        {
          value: identifierValue,
          identifierTypeUuid: SIS_TEMPORARY_AFFILIATION_PATIENT_IDENTIFIER_TYPE_UUID,
        },
      ]),
    ).toBe(false);
    expect(isInsuranceCodeAllowed(identifierValue, SIS_CONCEPT_UUID, [])).toBe(false);
  });

  it('does not reject a code that does not match any patient identifier', () => {
    expect(isInsuranceCodeAllowed('SIS-452781', SIS_CONCEPT_UUID, ['12345678'])).toBe(true);
  });
});

describe('SIS financing eligibility', () => {
  it('requires both the SIS financiador and an active accreditation', () => {
    expect(
      getSisFinancingState({
        financiadorUuid: SIS_CONCEPT_UUID,
        insuranceNumber: 'SIS-123',
        accreditationStatusUuid: SIS_ACCREDITATION_ACTIVE_CONCEPT_UUID,
        accreditationCheckedAt,
      }),
    ).toBe('active');
    expect(
      getSisFinancingState({
        financiadorUuid: SIS_CONCEPT_UUID,
        insuranceNumber: 'SIS-123',
        accreditationStatusUuid: SIS_ACCREDITATION_INACTIVE_CONCEPT_UUID,
        accreditationCheckedAt,
      }),
    ).toBe('inactive');
    expect(
      getSisFinancingState({
        financiadorUuid: essaludConceptUuid,
        insuranceNumber: null,
        accreditationStatusUuid: null,
        accreditationCheckedAt: null,
      }),
    ).toBe('notApplicable');
  });

  it('does not treat active SIS as complete without its number and verification date', () => {
    expect(
      getSisFinancingState({
        financiadorUuid: SIS_CONCEPT_UUID,
        insuranceNumber: null,
        accreditationStatusUuid: SIS_ACCREDITATION_ACTIVE_CONCEPT_UUID,
        accreditationCheckedAt,
      }),
    ).toBe('missing');
    expect(
      getSisFinancingState({
        financiadorUuid: SIS_CONCEPT_UUID,
        insuranceNumber: 'SIS-123',
        accreditationStatusUuid: SIS_ACCREDITATION_ACTIVE_CONCEPT_UUID,
        accreditationCheckedAt: null,
      }),
    ).toBe('missing');
  });

  it('distinguishes missing financing from an explicitly known non-SIS financer', () => {
    expect(
      getSisFinancingState({
        financiadorUuid: null,
        insuranceNumber: null,
        accreditationStatusUuid: null,
        accreditationCheckedAt: null,
      }),
    ).toBe('missing');
    expect(
      getSisFinancingState({
        financiadorUuid: essaludConceptUuid,
        insuranceNumber: null,
        accreditationStatusUuid: null,
        accreditationCheckedAt: null,
      }),
    ).toBe('notApplicable');
  });

  it.each([
    ['active', true],
    ['notApplicable', true],
    ['inactive', false],
    ['pending', false],
    ['notConsulted', false],
    ['missing', false],
    [null, false],
    [undefined, false],
  ] as const)('evaluates %s as triage eligibility %s', (state, expected) => {
    expect(isTriageFinancingEligible(state)).toBe(expected);
  });

  it('reads the visit-level financing attributes used by triage', async () => {
    mockFetchSequence({
      visitAttributes: [
        {
          uuid: 'visit-financiador',
          value: { uuid: SIS_CONCEPT_UUID },
          attributeType: { uuid: FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID },
        },
        {
          uuid: 'visit-number',
          value: 'SIS-123',
          attributeType: { uuid: INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID },
        },
        {
          uuid: 'visit-status',
          value: SIS_ACCREDITATION_ACTIVE_CONCEPT_UUID,
          attributeType: { uuid: SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID },
        },
        {
          uuid: 'visit-checked-at',
          value: accreditationCheckedAt,
          attributeType: { uuid: SIS_ACCREDITATION_CHECKED_AT_VISIT_ATTRIBUTE_TYPE_UUID },
        },
      ],
    });

    await expect(fetchVisitInsurance(visitUuid)).resolves.toEqual({
      financiadorUuid: SIS_CONCEPT_UUID,
      insuranceNumber: 'SIS-123',
      accreditationStatusUuid: SIS_ACCREDITATION_ACTIVE_CONCEPT_UUID,
      accreditationCheckedAt,
    });
  });
});

describe('getPersonSisFinancingState', () => {
  const trustedTemporaryPerson = {
    insuranceTypeUuid: SIS_CONCEPT_UUID,
    insuranceCode: 'E-11138562',
    accreditationStatusUuid: SIS_ACCREDITATION_ACTIVE_CONCEPT_UUID,
    accreditationCheckedAt,
    verificationMethod: 'siasis-adt',
  };

  it('acredita un E temporal solo con evidencia de verificación confiable', () => {
    expect(getPersonSisFinancingState(trustedTemporaryPerson)).toBe('active');
  });

  it('trata un E temporal sin método confiable como cobertura incompleta', () => {
    // El caso real de la marcha blanca: «Afiliación Temporal» E-11138562
    // registrada a mano. La persona leía `active`, el copiado descartaba el
    // código y la revalidación de triaje reventaba con «no pudo sincronizarse».
    expect(getPersonSisFinancingState({ ...trustedTemporaryPerson, verificationMethod: null })).toBe('missing');
    expect(getPersonSisFinancingState({ ...trustedTemporaryPerson, verificationMethod: 'manual' })).toBe('missing');
    // Una fecha civil sin hora tampoco acredita.
    expect(
      getPersonSisFinancingState({ ...trustedTemporaryPerson, accreditationCheckedAt: '2026-08-11' }),
    ).toBe('missing');
  });

  it('aplica la regla también a códigos con intención temporal malformada', () => {
    expect(
      getPersonSisFinancingState({ ...trustedTemporaryPerson, insuranceCode: 'E 111385', verificationMethod: null }),
    ).toBe('missing');
  });

  it('no exige método de verificación a un carné SIS regular ni a una IAFAS no-SIS', () => {
    expect(
      getPersonSisFinancingState({ ...trustedTemporaryPerson, insuranceCode: 'SIS-123', verificationMethod: null }),
    ).toBe('active');
    expect(
      getPersonSisFinancingState({
        insuranceTypeUuid: essaludConceptUuid,
        insuranceCode: 'ESSALUD-1',
        accreditationStatusUuid: null,
        accreditationCheckedAt: null,
        verificationMethod: null,
      }),
    ).toBe('notApplicable');
  });
});

describe('fetchPersonInsurance', () => {
  it('returns empty insurance without fetching when the patient UUID is missing', async () => {
    await expect(fetchPersonInsurance('')).resolves.toEqual({
      insuranceTypeUuid: null,
      insuranceCode: null,
      accreditationStatusUuid: null,
      accreditationCheckedAt: null,
      verificationMethod: null,
    });
    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
  });

  it('maps hydrated coded values and plain text values', async () => {
    mockFetchSequence({
      personAttributes: [
        {
          uuid: 'attr-1',
          value: { uuid: SIS_CONCEPT_UUID, display: 'SIS' },
          attributeType: { uuid: INSURANCE_TYPE_PERSON_ATTRIBUTE_TYPE_UUID },
        },
        {
          uuid: 'attr-2',
          value: 'COD-000123',
          attributeType: { uuid: INSURANCE_CODE_PERSON_ATTRIBUTE_TYPE_UUID },
        },
        {
          uuid: 'attr-3',
          value: accreditationVigenteUuid,
          attributeType: { uuid: ACCREDITATION_STATUS_PERSON_ATTRIBUTE_TYPE_UUID },
        },
        {
          uuid: 'attr-4',
          value: 'manual-web',
          attributeType: { uuid: INSURANCE_VERIFICATION_METHOD_PERSON_ATTRIBUTE_TYPE_UUID },
        },
      ],
    });

    await expect(fetchPersonInsurance(patientUuid)).resolves.toEqual({
      insuranceTypeUuid: SIS_CONCEPT_UUID,
      insuranceCode: 'COD-000123',
      accreditationStatusUuid: accreditationVigenteUuid,
      accreditationCheckedAt: null,
      verificationMethod: 'manual-web',
    });
    expect(mockOpenmrsFetch.mock.calls.some(([url]) => isPersonInsuranceReadUrl(String(url)))).toBe(true);
  });

  it('supports coded values that arrive as plain strings', async () => {
    mockFetchSequence({
      personAttributes: [
        {
          uuid: 'attr-1',
          value: essaludConceptUuid,
          attributeType: { uuid: INSURANCE_TYPE_PERSON_ATTRIBUTE_TYPE_UUID },
        },
      ],
    });

    await expect(fetchPersonInsurance(patientUuid)).resolves.toMatchObject({
      insuranceTypeUuid: essaludConceptUuid,
    });
  });
});

describe('fresh temporary SIS coverage reads', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(1_787_589_000_000);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses unique network-only URLs and the same abort signal for person and identifier proof', async () => {
    const abortController = new AbortController();
    mockFetchSequence({
      personAttributes: temporarySisPersonAttributes(),
      patientIdentifiers: [
        {
          identifier: 'E-12345678',
          identifierType: { uuid: SIS_TEMPORARY_AFFILIATION_PATIENT_IDENTIFIER_TYPE_UUID },
        },
      ],
    });

    await Promise.all([
      fetchFreshPersonInsurance(patientUuid, abortController.signal),
      fetchFreshPatientIdentifiers(patientUuid, abortController.signal),
    ]);

    const personCall = mockOpenmrsFetch.mock.calls.find(([url]) => isPersonInsuranceReadUrl(String(url)));
    const identifiersCall = mockOpenmrsFetch.mock.calls.find(([url]) => isPatientIdentifiersReadUrl(String(url)));
    expect(personCall).toBeDefined();
    expect(identifiersCall).toBeDefined();

    const personRequestUrl = new URL(String(personCall?.[0]), 'https://example.test');
    const identifiersRequestUrl = new URL(String(identifiersCall?.[0]), 'https://example.test');
    expect(personRequestUrl.pathname).toBe(`${restBaseUrl}/person/${patientUuid}`);
    expect(personRequestUrl.searchParams.get('v')).toBe('custom:(attributes:(uuid,value,attributeType:(uuid)))');
    expect(personRequestUrl.searchParams.get('_')).toMatch(/^1787589000000-\d+$/);
    expect(identifiersRequestUrl.pathname).toBe(`${restBaseUrl}/patient/${patientUuid}`);
    expect(identifiersRequestUrl.searchParams.get('v')).toBe(
      'custom:(identifiers:(identifier,identifierType:(uuid),voided))',
    );
    expect(identifiersRequestUrl.searchParams.get('_')).toMatch(/^1787589000000-\d+$/);
    expect(personRequestUrl.searchParams.get('_')).not.toBe(identifiersRequestUrl.searchParams.get('_'));

    const expectedRequestOptions = {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-store',
        [omrsOfflineCachingStrategyHttpHeaderName]: 'network-only-or-cache-only',
      },
      signal: abortController.signal,
    };
    expect(personCall?.[1]).toEqual(expectedRequestOptions);
    expect(identifiersCall?.[1]).toEqual(expectedRequestOptions);
  });

  it('propagates a failed network-only proof instead of substituting cached coverage', async () => {
    const networkError = new TypeError('Failed to fetch');
    mockOpenmrsFetch.mockRejectedValue(networkError);

    await expect(fetchFreshPersonInsurance(patientUuid)).rejects.toBe(networkError);
    await expect(fetchFreshPatientIdentifiers(patientUuid)).rejects.toBe(networkError);
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(2);
    for (const [, requestOptions] of mockOpenmrsFetch.mock.calls) {
      expect(requestOptions).toEqual(
        expect.objectContaining({
          cache: 'no-store',
          headers: expect.objectContaining({
            [omrsOfflineCachingStrategyHttpHeaderName]: 'network-only-or-cache-only',
          }),
        }),
      );
    }
  });
});

describe('copyFinanciadorToVisit', () => {
  it('reports a missing financer when the person has no insurance data', async () => {
    mockFetchSequence({ personAttributes: [] });

    await expect(copyFinanciadorToVisit({ patientUuid, visitUuid })).resolves.toEqual({
      ok: true,
      skipped: true,
      created: 0,
      updated: 0,
      reviewReason: 'missing-financiador',
    });
    // La visita también se lee para conservar una cobertura histórica coherente.
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(2);
    expect(mockOpenmrsFetch.mock.calls.some(([url]) => isPersonInsuranceReadUrl(String(url)))).toBe(true);
    expect(mockOpenmrsFetch).toHaveBeenCalledWith(visitUrl);
  });

  it('cleans orphan coverage details when neither the person nor the visit has a financer', async () => {
    mockFetchSequence({
      personAttributes: [],
      visitAttributes: [
        {
          uuid: 'visit-number',
          value: 'ORPHAN-10',
          attributeType: { uuid: INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID },
        },
        {
          uuid: 'visit-status',
          value: accreditationVigenteUuid,
          attributeType: { uuid: SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID },
        },
        {
          uuid: 'visit-checked-at',
          value: accreditationCheckedAt,
          attributeType: { uuid: SIS_ACCREDITATION_CHECKED_AT_VISIT_ATTRIBUTE_TYPE_UUID },
        },
      ],
    });

    await expect(copyFinanciadorToVisit({ patientUuid, visitUuid })).resolves.toEqual({
      ok: true,
      skipped: true,
      created: 0,
      updated: 3,
      reviewReason: 'missing-financiador',
    });
    expect(getDeleteCalls().map(([url]) => url)).toEqual([
      `${restBaseUrl}/visit/${visitUuid}/attribute/visit-status`,
      `${restBaseUrl}/visit/${visitUuid}/attribute/visit-number`,
      `${restBaseUrl}/visit/${visitUuid}/attribute/visit-checked-at`,
    ]);
  });

  it('preserves a complete visit coverage snapshot when the person no longer has an affiliation', async () => {
    mockFetchSequence({
      personAttributes: [],
      visitAttributes: [
        {
          uuid: 'visit-financer',
          value: SIS_CONCEPT_UUID,
          attributeType: { uuid: FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID },
        },
        {
          uuid: 'visit-number',
          value: 'SIS-HISTORIC-10',
          attributeType: { uuid: INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID },
        },
        {
          uuid: 'visit-status',
          value: accreditationVigenteUuid,
          attributeType: { uuid: SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID },
        },
        {
          uuid: 'visit-checked-at',
          value: accreditationCheckedAt,
          attributeType: { uuid: SIS_ACCREDITATION_CHECKED_AT_VISIT_ATTRIBUTE_TYPE_UUID },
        },
      ],
    });

    await expect(copyFinanciadorToVisit({ patientUuid, visitUuid })).resolves.toEqual({
      ok: true,
      skipped: false,
      created: 0,
      updated: 0,
    });
    expect(getWriteCalls()).toHaveLength(0);
    expect(getDeleteCalls()).toHaveLength(0);
  });

  it('copies financer, affiliation, status and checked-at for SIS coverage', async () => {
    mockFetchSequence({
      personAttributes: [
        {
          uuid: 'attr-1',
          value: { uuid: SIS_CONCEPT_UUID, display: 'SIS' },
          attributeType: { uuid: INSURANCE_TYPE_PERSON_ATTRIBUTE_TYPE_UUID },
        },
        {
          uuid: 'attr-2',
          value: 'COD-9',
          attributeType: { uuid: INSURANCE_CODE_PERSON_ATTRIBUTE_TYPE_UUID },
        },
        {
          uuid: 'attr-3',
          value: { uuid: accreditationVigenteUuid, display: 'Vigente' },
          attributeType: { uuid: ACCREDITATION_STATUS_PERSON_ATTRIBUTE_TYPE_UUID },
        },
        {
          uuid: 'attr-4',
          value: accreditationCheckedAt,
          attributeType: { uuid: ACCREDITATION_CHECKED_AT_PERSON_ATTRIBUTE_TYPE_UUID },
        },
      ],
      visitAttributes: [],
    });

    await expect(copyFinanciadorToVisit({ patientUuid, visitUuid })).resolves.toEqual({
      ok: true,
      skipped: false,
      created: 4,
      updated: 0,
    });

    const writes = getWriteCalls();
    expect(writes).toHaveLength(4);
    expect(writes.map(([url]) => url)).toEqual([
      `${restBaseUrl}/visit/${visitUuid}/attribute`,
      `${restBaseUrl}/visit/${visitUuid}/attribute`,
      `${restBaseUrl}/visit/${visitUuid}/attribute`,
      `${restBaseUrl}/visit/${visitUuid}/attribute`,
    ]);
    expect(writes.map(([, init]) => (init as { body: unknown }).body)).toEqual([
      { attributeType: FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID, value: SIS_CONCEPT_UUID },
      { attributeType: INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID, value: 'COD-9' },
      { attributeType: SIS_ACCREDITATION_CHECKED_AT_VISIT_ATTRIBUTE_TYPE_UUID, value: accreditationCheckedAt },
      { attributeType: SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID, value: accreditationVigenteUuid },
    ]);
  });

  it('explicitly synchronizes a formerly pending SIS snapshot to the current affiliation', async () => {
    mockFetchSequence({
      personAttributes: [
        {
          uuid: 'attr-1',
          value: SIS_CONCEPT_UUID,
          attributeType: { uuid: INSURANCE_TYPE_PERSON_ATTRIBUTE_TYPE_UUID },
        },
        {
          uuid: 'attr-2',
          value: 'SIS-900',
          attributeType: { uuid: INSURANCE_CODE_PERSON_ATTRIBUTE_TYPE_UUID },
        },
        {
          uuid: 'attr-3',
          value: accreditationVigenteUuid,
          attributeType: { uuid: ACCREDITATION_STATUS_PERSON_ATTRIBUTE_TYPE_UUID },
        },
        {
          uuid: 'attr-4',
          value: accreditationCheckedAt,
          attributeType: { uuid: ACCREDITATION_CHECKED_AT_PERSON_ATTRIBUTE_TYPE_UUID },
        },
      ],
      visitAttributes: [
        {
          uuid: 'visit-financer',
          value: SIS_CONCEPT_UUID,
          attributeType: { uuid: FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID },
        },
        {
          uuid: 'visit-number',
          value: 'SIS-900',
          attributeType: { uuid: INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID },
        },
        {
          uuid: 'visit-pending-status',
          value: 'pending-status-uuid',
          attributeType: { uuid: SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID },
        },
      ],
    });

    await expect(copyFinanciadorToVisit({ patientUuid, visitUuid, onlyFillMissing: false })).resolves.toEqual({
      ok: true,
      skipped: false,
      created: 2,
      updated: 1,
    });
    expect(getDeleteCalls().map(([url]) => url)).toEqual([
      `${restBaseUrl}/visit/${visitUuid}/attribute/visit-pending-status`,
    ]);
    expect(getWriteCalls().map(([, init]) => (init as { body: unknown }).body)).toEqual([
      { attributeType: SIS_ACCREDITATION_CHECKED_AT_VISIT_ATTRIBUTE_TYPE_UUID, value: accreditationCheckedAt },
      { attributeType: SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID, value: accreditationVigenteUuid },
    ]);
    expect(getWriteCalls().map(([url]) => url)).toEqual([
      `${restBaseUrl}/visit/${visitUuid}/attribute`,
      `${restBaseUrl}/visit/${visitUuid}/attribute`,
    ]);
  });

  it('copies only the financer for self-financed care', async () => {
    mockFetchSequence({
      personAttributes: [
        {
          uuid: 'attr-1',
          value: { uuid: SELF_FINANCED_CONCEPT_UUID, display: 'Autofinanciamiento' },
          attributeType: { uuid: INSURANCE_TYPE_PERSON_ATTRIBUTE_TYPE_UUID },
        },
        {
          uuid: 'attr-2',
          value: 'STALE-CODE',
          attributeType: { uuid: INSURANCE_CODE_PERSON_ATTRIBUTE_TYPE_UUID },
        },
        {
          uuid: 'attr-3',
          value: accreditationVigenteUuid,
          attributeType: { uuid: ACCREDITATION_STATUS_PERSON_ATTRIBUTE_TYPE_UUID },
        },
        {
          uuid: 'attr-4',
          value: accreditationCheckedAt,
          attributeType: { uuid: ACCREDITATION_CHECKED_AT_PERSON_ATTRIBUTE_TYPE_UUID },
        },
      ],
      visitAttributes: [],
    });

    await expect(copyFinanciadorToVisit({ patientUuid, visitUuid })).resolves.toMatchObject({
      ok: true,
      created: 1,
      updated: 0,
    });
    expect(getWriteCalls().map(([, init]) => (init as { body: unknown }).body)).toEqual([
      { attributeType: FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID, value: SELF_FINANCED_CONCEPT_UUID },
    ]);
  });

  it('does not fetch identifiers for an inapplicable historic self-financed code', async () => {
    mockOpenmrsFetch.mockImplementation((url: string) => {
      if (isPersonInsuranceReadUrl(url)) {
        return Promise.resolve({
          data: {
            attributes: [
              {
                uuid: 'attr-1',
                value: SELF_FINANCED_CONCEPT_UUID,
                attributeType: { uuid: INSURANCE_TYPE_PERSON_ATTRIBUTE_TYPE_UUID },
              },
              {
                uuid: 'attr-2',
                value: 'LEGACY-DOCUMENT-VALUE',
                attributeType: { uuid: INSURANCE_CODE_PERSON_ATTRIBUTE_TYPE_UUID },
              },
            ],
          },
        }) as never;
      }
      if (isPatientIdentifiersReadUrl(url)) {
        return Promise.reject(new Error('identifier endpoint unavailable')) as never;
      }
      if (url === visitUrl) {
        return Promise.resolve({ data: { attributes: [] } }) as never;
      }
      return Promise.resolve({ data: {} }) as never;
    });

    await expect(copyFinanciadorToVisit({ patientUuid, visitUuid })).resolves.toEqual({
      ok: true,
      skipped: false,
      created: 1,
      updated: 0,
    });
    expect(mockOpenmrsFetch.mock.calls.some(([url]) => isPatientIdentifiersReadUrl(String(url)))).toBe(false);
    expect(getWriteCalls().map(([, init]) => (init as { body: unknown }).body)).toEqual([
      { attributeType: FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID, value: SELF_FINANCED_CONCEPT_UUID },
    ]);
  });

  it('copies a general policy for another IAFAS without SIS status or checked-at', async () => {
    mockFetchSequence({
      personAttributes: [
        {
          uuid: 'attr-1',
          value: { uuid: essaludConceptUuid, display: 'EsSalud' },
          attributeType: { uuid: INSURANCE_TYPE_PERSON_ATTRIBUTE_TYPE_UUID },
        },
        {
          uuid: 'attr-2',
          value: 'ESSALUD-88',
          attributeType: { uuid: INSURANCE_CODE_PERSON_ATTRIBUTE_TYPE_UUID },
        },
        {
          uuid: 'attr-3',
          value: accreditationVigenteUuid,
          attributeType: { uuid: ACCREDITATION_STATUS_PERSON_ATTRIBUTE_TYPE_UUID },
        },
        {
          uuid: 'attr-4',
          value: accreditationCheckedAt,
          attributeType: { uuid: ACCREDITATION_CHECKED_AT_PERSON_ATTRIBUTE_TYPE_UUID },
        },
      ],
      visitAttributes: [],
    });

    await expect(copyFinanciadorToVisit({ patientUuid, visitUuid })).resolves.toMatchObject({ created: 2 });
    expect(getWriteCalls().map(([, init]) => (init as { body: unknown }).body)).toEqual([
      { attributeType: INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID, value: 'ESSALUD-88' },
      { attributeType: FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID, value: essaludConceptUuid },
    ]);
  });

  it('marks another IAFAS without a policy number for visible review', async () => {
    mockFetchSequence({
      personAttributes: [
        {
          uuid: 'attr-1',
          value: essaludConceptUuid,
          attributeType: { uuid: INSURANCE_TYPE_PERSON_ATTRIBUTE_TYPE_UUID },
        },
      ],
      visitAttributes: [],
    });

    await expect(copyFinanciadorToVisit({ patientUuid, visitUuid })).resolves.toEqual({
      ok: true,
      skipped: false,
      created: 1,
      updated: 0,
      reviewReason: 'incomplete-coverage',
    });
  });

  it('marks SIS without the accreditation bundle for visible review', async () => {
    mockFetchSequence({
      personAttributes: [
        {
          uuid: 'attr-1',
          value: SIS_CONCEPT_UUID,
          attributeType: { uuid: INSURANCE_TYPE_PERSON_ATTRIBUTE_TYPE_UUID },
        },
        {
          uuid: 'attr-2',
          value: 'SIS-INCOMPLETE-10',
          attributeType: { uuid: INSURANCE_CODE_PERSON_ATTRIBUTE_TYPE_UUID },
        },
      ],
      visitAttributes: [],
    });

    await expect(copyFinanciadorToVisit({ patientUuid, visitUuid })).resolves.toEqual({
      ok: true,
      skipped: false,
      created: 2,
      updated: 0,
      reviewReason: 'incomplete-coverage',
    });
  });

  it('marks an unknown SIS accreditation status for review instead of reporting a false success', async () => {
    mockFetchSequence({
      personAttributes: [
        {
          uuid: 'attr-1',
          value: SIS_CONCEPT_UUID,
          attributeType: { uuid: INSURANCE_TYPE_PERSON_ATTRIBUTE_TYPE_UUID },
        },
        {
          uuid: 'attr-2',
          value: 'SIS-UNKNOWN-10',
          attributeType: { uuid: INSURANCE_CODE_PERSON_ATTRIBUTE_TYPE_UUID },
        },
        {
          uuid: 'attr-3',
          value: '0f5a8a7d-5d6e-4f4f-8f36-24d99ac0baca',
          attributeType: { uuid: ACCREDITATION_STATUS_PERSON_ATTRIBUTE_TYPE_UUID },
        },
        {
          uuid: 'attr-4',
          value: accreditationCheckedAt,
          attributeType: { uuid: ACCREDITATION_CHECKED_AT_PERSON_ATTRIBUTE_TYPE_UUID },
        },
      ],
      visitAttributes: [],
    });

    await expect(copyFinanciadorToVisit({ patientUuid, visitUuid })).resolves.toEqual({
      ok: true,
      skipped: false,
      created: 4,
      updated: 0,
      reviewReason: 'unknown-accreditation-status',
    });
  });

  it.each([
    'manual-web',
    'setisis',
    'siasis-adt',
  ])('copies E-######## with fresh identifier and trusted %s evidence', async (verificationMethod) => {
    mockFetchSequence({
      personAttributes: temporarySisPersonAttributes(verificationMethod),
      patientIdentifiers: [
        {
          identifier: 'E-12345678',
          identifierType: { uuid: SIS_TEMPORARY_AFFILIATION_PATIENT_IDENTIFIER_TYPE_UUID },
        },
      ],
    });

    await expect(copyFinanciadorToVisit({ patientUuid, visitUuid })).resolves.toMatchObject({
      ok: true,
      created: 4,
    });
    expect(getWriteCalls().map(([, init]) => (init as { body: unknown }).body)).toContainEqual({
      attributeType: INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID,
      value: 'E-12345678',
    });
  });

  it.each([
    ['missing method', null, accreditationCheckedAt],
    ['unknown method', 'spreadsheet-import', accreditationCheckedAt],
    ['date without time and zone', 'siasis-adt', '2026-08-12'],
  ])('does not copy E-######## with %s', async (_caseName, verificationMethod, checkedAt) => {
    mockFetchSequence({
      personAttributes: temporarySisPersonAttributes(verificationMethod, checkedAt),
      patientIdentifiers: [
        {
          identifier: 'E-12345678',
          identifierType: { uuid: SIS_TEMPORARY_AFFILIATION_PATIENT_IDENTIFIER_TYPE_UUID },
        },
      ],
    });

    await expect(copyFinanciadorToVisit({ patientUuid, visitUuid })).resolves.toMatchObject({
      ok: true,
      created: 3,
      reviewReason: 'incomplete-coverage',
    });
    expect(getWriteCalls().map(([, init]) => (init as { body: unknown }).body)).not.toContainEqual({
      attributeType: INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID,
      value: 'E-12345678',
    });
  });

  it.each([
    'E12345678',
    'E 12345678',
  ])('does not copy E-######## from malformed REST identifier %s', async (identifier) => {
    mockFetchSequence({
      personAttributes: temporarySisPersonAttributes(),
      patientIdentifiers: [
        {
          identifier,
          identifierType: { uuid: SIS_TEMPORARY_AFFILIATION_PATIENT_IDENTIFIER_TYPE_UUID },
        },
      ],
    });

    await copyFinanciadorToVisit({ patientUuid, visitUuid });

    expect(getWriteCalls().map(([, init]) => (init as { body: unknown }).body)).not.toContainEqual({
      attributeType: INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID,
      value: 'E-12345678',
    });
  });

  it('does not trust a stale caller snapshot when REST no longer contains the E identifier', async () => {
    mockFetchSequence({
      personAttributes: temporarySisPersonAttributes(),
      patientIdentifiers: [],
    });

    await copyFinanciadorToVisit({
      patientUuid,
      visitUuid,
      patientIdentifiers: [
        {
          value: 'E-12345678',
          identifierTypeUuid: SIS_TEMPORARY_AFFILIATION_PATIENT_IDENTIFIER_TYPE_UUID,
        },
      ],
    });

    expect(mockOpenmrsFetch.mock.calls.filter(([url]) => isPatientIdentifiersReadUrl(String(url)))).toHaveLength(1);
    expect(getWriteCalls().map(([, init]) => (init as { body: unknown }).body)).not.toContainEqual({
      attributeType: INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID,
      value: 'E-12345678',
    });
  });

  it('reuses an explicitly fresh empty proof without fetching or restoring a stale E identifier', async () => {
    mockFetchSequence({
      personAttributes: temporarySisPersonAttributes(),
    });

    await copyFinanciadorToVisit({
      patientUuid,
      visitUuid,
      patientIdentifiers: [
        {
          value: 'E-12345678',
          identifierTypeUuid: SIS_TEMPORARY_AFFILIATION_PATIENT_IDENTIFIER_TYPE_UUID,
        },
      ],
      freshPatientIdentifiers: [],
      freshPersonInsurance: {
        insuranceTypeUuid: SIS_CONCEPT_UUID,
        insuranceCode: 'E-12345678',
        accreditationStatusUuid: SIS_ACCREDITATION_ACTIVE_CONCEPT_UUID,
        accreditationCheckedAt,
        verificationMethod: 'siasis-adt',
      },
    });

    expect(mockOpenmrsFetch.mock.calls.some(([url]) => isPatientIdentifiersReadUrl(String(url)))).toBe(false);
    expect(mockOpenmrsFetch.mock.calls.some(([url]) => isPersonInsuranceReadUrl(String(url)))).toBe(false);
    expect(getWriteCalls().map(([, init]) => (init as { body: unknown }).body)).not.toContainEqual({
      attributeType: INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID,
      value: 'E-12345678',
    });
  });

  it('uses one fresh proof when REST gained the E identifier after the caller snapshot', async () => {
    mockFetchSequence({
      personAttributes: temporarySisPersonAttributes(),
    });

    await copyFinanciadorToVisit({
      patientUuid,
      visitUuid,
      patientIdentifiers: [],
      freshPatientIdentifiers: [
        {
          value: 'E-12345678',
          identifierTypeUuid: SIS_TEMPORARY_AFFILIATION_PATIENT_IDENTIFIER_TYPE_UUID,
        },
      ],
      freshPersonInsurance: {
        insuranceTypeUuid: SIS_CONCEPT_UUID,
        insuranceCode: 'E-12345678',
        accreditationStatusUuid: SIS_ACCREDITATION_ACTIVE_CONCEPT_UUID,
        accreditationCheckedAt,
        verificationMethod: 'siasis-adt',
      },
    });

    expect(mockOpenmrsFetch.mock.calls.some(([url]) => isPatientIdentifiersReadUrl(String(url)))).toBe(false);
    expect(mockOpenmrsFetch.mock.calls.some(([url]) => isPersonInsuranceReadUrl(String(url)))).toBe(false);
    expect(getWriteCalls().map(([, init]) => (init as { body: unknown }).body)).toContainEqual({
      attributeType: INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID,
      value: 'E-12345678',
    });
  });

  it.each([
    ['no identifiers', []],
    [
      'an unrelated temporary identifier',
      [
        {
          identifier: 'E-87654321',
          identifierType: { uuid: SIS_TEMPORARY_AFFILIATION_PATIENT_IDENTIFIER_TYPE_UUID },
        },
      ],
    ],
  ] as const)('does not copy E-######## when REST returns %s', async (_case, patientIdentifiers) => {
    mockFetchSequence({
      personAttributes: temporarySisPersonAttributes(),
      patientIdentifiers: [...patientIdentifiers],
    });

    await expect(copyFinanciadorToVisit({ patientUuid, visitUuid })).resolves.toMatchObject({
      ok: true,
      created: 3,
      reviewReason: 'incomplete-coverage',
    });
    expect(getWriteCalls().map(([, init]) => (init as { body: unknown }).body)).not.toContainEqual({
      attributeType: INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID,
      value: 'E-12345678',
    });
  });

  it('ignores voided identifiers when checking an insurance number', async () => {
    mockFetchSequence({
      personAttributes: [
        {
          uuid: 'attr-1',
          value: SIS_CONCEPT_UUID,
          attributeType: { uuid: INSURANCE_TYPE_PERSON_ATTRIBUTE_TYPE_UUID },
        },
        {
          uuid: 'attr-2',
          value: '72-344-001',
          attributeType: { uuid: INSURANCE_CODE_PERSON_ATTRIBUTE_TYPE_UUID },
        },
      ],
      patientIdentifiers: [{ identifier: '72344001', identifierType: { uuid: 'dni-type' }, voided: true }],
    });

    await copyFinanciadorToVisit({ patientUuid, visitUuid });

    expect(getWriteCalls().map(([, init]) => (init as { body: unknown }).body)).toContainEqual({
      attributeType: INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID,
      value: '72-344-001',
    });
  });

  it('never copies a document identifier as the affiliation number', async () => {
    mockFetchSequence({
      personAttributes: [
        {
          uuid: 'attr-1',
          value: SIS_CONCEPT_UUID,
          attributeType: { uuid: INSURANCE_TYPE_PERSON_ATTRIBUTE_TYPE_UUID },
        },
        {
          uuid: 'attr-2',
          value: '72-344-001',
          attributeType: { uuid: INSURANCE_CODE_PERSON_ATTRIBUTE_TYPE_UUID },
        },
      ],
      patientIdentifiers: [{ identifier: '72344001' }],
      visitAttributes: [],
    });

    await copyFinanciadorToVisit({ patientUuid, visitUuid });

    expect(getWriteCalls().map(([, init]) => (init as { body: unknown }).body)).toEqual([
      { attributeType: FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID, value: SIS_CONCEPT_UUID },
    ]);
    expect(mockOpenmrsFetch.mock.calls.some(([url]) => isPatientIdentifiersReadUrl(String(url)))).toBe(true);
  });

  it('normalizes legacy SIS products to the SIS concept when writing the Financiador attribute', async () => {
    mockFetchSequence({
      personAttributes: [
        {
          uuid: 'attr-1',
          value: { uuid: LEGACY_SIS_PRODUCT_CONCEPT_UUIDS[0], display: 'SIS Gratuito' },
          attributeType: { uuid: INSURANCE_TYPE_PERSON_ATTRIBUTE_TYPE_UUID },
        },
      ],
      visitAttributes: [],
    });

    await copyFinanciadorToVisit({ patientUuid, visitUuid });

    const writes = getWriteCalls();
    expect(writes).toHaveLength(1);
    expect((writes[0][1] as { body: unknown }).body).toEqual({
      attributeType: FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID,
      value: SIS_CONCEPT_UUID,
    });
  });

  it('is idempotent: does not rewrite attributes whose value already matches', async () => {
    mockFetchSequence({
      personAttributes: [
        {
          uuid: 'attr-1',
          value: { uuid: LEGACY_SIS_PRODUCT_CONCEPT_UUIDS[1], display: 'SIS Semicontributivo' },
          attributeType: { uuid: INSURANCE_TYPE_PERSON_ATTRIBUTE_TYPE_UUID },
        },
        {
          uuid: 'attr-2',
          value: 'COD-9',
          attributeType: { uuid: INSURANCE_CODE_PERSON_ATTRIBUTE_TYPE_UUID },
        },
        {
          uuid: 'attr-3',
          value: accreditationVigenteUuid,
          attributeType: { uuid: ACCREDITATION_STATUS_PERSON_ATTRIBUTE_TYPE_UUID },
        },
        {
          uuid: 'attr-4',
          value: accreditationCheckedAt,
          attributeType: { uuid: ACCREDITATION_CHECKED_AT_PERSON_ATTRIBUTE_TYPE_UUID },
        },
      ],
      visitAttributes: [
        {
          uuid: 'visit-attr-1',
          value: { uuid: SIS_CONCEPT_UUID, display: 'SIS' },
          attributeType: { uuid: FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID },
        },
        {
          uuid: 'visit-attr-2',
          value: 'COD-9',
          attributeType: { uuid: INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID },
        },
        {
          uuid: 'visit-attr-3',
          value: accreditationVigenteUuid,
          attributeType: { uuid: SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID },
        },
        {
          uuid: 'visit-attr-4',
          value: accreditationCheckedAt,
          attributeType: { uuid: SIS_ACCREDITATION_CHECKED_AT_VISIT_ATTRIBUTE_TYPE_UUID },
        },
      ],
    });

    await expect(copyFinanciadorToVisit({ patientUuid, visitUuid })).resolves.toEqual({
      ok: true,
      skipped: false,
      created: 0,
      updated: 0,
    });
    expect(getWriteCalls()).toHaveLength(0);
  });

  it('replaces a changed payer in place as the final commit step', async () => {
    mockFetchSequence({
      personAttributes: [
        {
          uuid: 'attr-1',
          value: { uuid: essaludConceptUuid, display: 'EsSalud' },
          attributeType: { uuid: INSURANCE_TYPE_PERSON_ATTRIBUTE_TYPE_UUID },
        },
      ],
      visitAttributes: [
        {
          uuid: 'visit-attr-1',
          // Valor persistido como uuid plano, distinto del deseado.
          value: SIS_CONCEPT_UUID,
          attributeType: { uuid: FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID },
        },
      ],
    });

    await expect(copyFinanciadorToVisit({ patientUuid, visitUuid })).resolves.toEqual({
      ok: true,
      skipped: false,
      created: 0,
      updated: 1,
      reviewReason: 'incomplete-coverage',
    });

    const writes = getWriteCalls();
    expect(writes).toHaveLength(1);
    expect(getDeleteCalls()).toHaveLength(0);
    expect(writes[0][0]).toBe(`${restBaseUrl}/visit/${visitUuid}/attribute/visit-attr-1`);
    expect((writes[0][1] as { body: unknown }).body).toEqual({
      value: essaludConceptUuid,
    });
  });

  it('does not copy an orphan insurance code without a financer', async () => {
    mockFetchSequence({
      personAttributes: [
        {
          uuid: 'attr-2',
          value: 'COD-77',
          attributeType: { uuid: INSURANCE_CODE_PERSON_ATTRIBUTE_TYPE_UUID },
        },
      ],
      visitAttributes: [],
    });

    await expect(copyFinanciadorToVisit({ patientUuid, visitUuid })).resolves.toEqual({
      ok: true,
      skipped: true,
      created: 0,
      updated: 0,
      reviewReason: 'missing-financiador',
    });
    expect(getWriteCalls()).toHaveLength(0);
  });

  it('honors overridden attribute type UUIDs', async () => {
    const customPersonType = 'person-type-x';
    const customVisitType = 'visit-type-x';
    mockOpenmrsFetch.mockImplementation((url: string) => {
      if (url.startsWith(`${restBaseUrl}/person/`)) {
        return Promise.resolve({
          data: {
            attributes: [{ uuid: 'attr-1', value: 'concept-x', attributeType: { uuid: customPersonType } }],
          },
        }) as never;
      }
      if (url.startsWith(`${restBaseUrl}/visit/${visitUuid}?`)) {
        return Promise.resolve({ data: { attributes: [] } }) as never;
      }
      return Promise.resolve({ data: {} }) as never;
    });

    await copyFinanciadorToVisit({
      patientUuid,
      visitUuid,
      personAttributeTypeUuids: { insuranceTypeAttributeTypeUuid: customPersonType },
      visitAttributeTypeUuids: { financiadorVisitAttributeTypeUuid: customVisitType },
    });

    const writes = getWriteCalls();
    expect(writes).toHaveLength(1);
    expect((writes[0][1] as { body: unknown }).body).toEqual({ attributeType: customVisitType, value: 'concept-x' });
  });

  describe('onlyFillMissing', () => {
    const personSaysEsSalud = [
      {
        uuid: 'attr-1',
        value: { uuid: essaludConceptUuid, display: 'EsSalud' },
        attributeType: { uuid: INSURANCE_TYPE_PERSON_ATTRIBUTE_TYPE_UUID },
      },
      {
        uuid: 'attr-2',
        value: 'ESSALUD-44',
        attributeType: { uuid: INSURANCE_CODE_PERSON_ATTRIBUTE_TYPE_UUID },
      },
      {
        uuid: 'attr-3',
        value: accreditationVigenteUuid,
        attributeType: { uuid: ACCREDITATION_STATUS_PERSON_ATTRIBUTE_TYPE_UUID },
      },
      {
        uuid: 'attr-4',
        value: accreditationCheckedAt,
        attributeType: { uuid: ACCREDITATION_CHECKED_AT_PERSON_ATTRIBUTE_TYPE_UUID },
      },
    ];

    it('replaces orphan complements before adopting SIS as the visit payer', async () => {
      mockFetchSequence({
        personAttributes: [
          {
            uuid: 'person-financer',
            value: SIS_CONCEPT_UUID,
            attributeType: { uuid: INSURANCE_TYPE_PERSON_ATTRIBUTE_TYPE_UUID },
          },
          {
            uuid: 'person-number',
            value: 'SIS-NEW-44',
            attributeType: { uuid: INSURANCE_CODE_PERSON_ATTRIBUTE_TYPE_UUID },
          },
          {
            uuid: 'person-status',
            value: accreditationVigenteUuid,
            attributeType: { uuid: ACCREDITATION_STATUS_PERSON_ATTRIBUTE_TYPE_UUID },
          },
          {
            uuid: 'person-checked-at',
            value: accreditationCheckedAt,
            attributeType: { uuid: ACCREDITATION_CHECKED_AT_PERSON_ATTRIBUTE_TYPE_UUID },
          },
        ],
        visitAttributes: [
          {
            uuid: 'orphan-number',
            value: 'OLD-UNOWNED-NUMBER',
            attributeType: { uuid: INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID },
          },
          {
            uuid: 'orphan-status',
            value: 'old-unowned-status',
            attributeType: { uuid: SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID },
          },
          {
            uuid: 'orphan-checked-at',
            value: '2025-01-01T00:00:00.000-05:00',
            attributeType: { uuid: SIS_ACCREDITATION_CHECKED_AT_VISIT_ATTRIBUTE_TYPE_UUID },
          },
        ],
      });

      await expect(copyFinanciadorToVisit({ patientUuid, visitUuid, onlyFillMissing: true })).resolves.toEqual({
        ok: true,
        skipped: false,
        created: 4,
        updated: 3,
      });
      expect(getDeleteCalls().map(([url]) => url)).toEqual([
        `${restBaseUrl}/visit/${visitUuid}/attribute/orphan-number`,
        `${restBaseUrl}/visit/${visitUuid}/attribute/orphan-status`,
        `${restBaseUrl}/visit/${visitUuid}/attribute/orphan-checked-at`,
      ]);
      expect(getWriteCalls().map(([, init]) => (init as { body: unknown }).body)).toEqual([
        { attributeType: FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID, value: SIS_CONCEPT_UUID },
        { attributeType: INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID, value: 'SIS-NEW-44' },
        { attributeType: SIS_ACCREDITATION_CHECKED_AT_VISIT_ATTRIBUTE_TYPE_UUID, value: accreditationCheckedAt },
        { attributeType: SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID, value: accreditationVigenteUuid },
      ]);
      const firstWriteIndex = mockOpenmrsFetch.mock.calls.findIndex(
        ([, init]) => (init as { method?: string } | undefined)?.method === 'POST',
      );
      const lastDeleteIndex = mockOpenmrsFetch.mock.calls
        .map(([, init]) => (init as { method?: string } | undefined)?.method)
        .lastIndexOf('DELETE');
      expect(lastDeleteIndex).toBeLessThan(firstWriteIndex);
    });

    it('does not relabel orphan SIS details as another IAFAS policy', async () => {
      mockFetchSequence({
        personAttributes: personSaysEsSalud,
        visitAttributes: [
          {
            uuid: 'orphan-number',
            value: 'SIS-OLD-99',
            attributeType: { uuid: INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID },
          },
          {
            uuid: 'orphan-status',
            value: accreditationVigenteUuid,
            attributeType: { uuid: SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID },
          },
          {
            uuid: 'orphan-checked-at',
            value: accreditationCheckedAt,
            attributeType: { uuid: SIS_ACCREDITATION_CHECKED_AT_VISIT_ATTRIBUTE_TYPE_UUID },
          },
        ],
      });

      await expect(copyFinanciadorToVisit({ patientUuid, visitUuid, onlyFillMissing: true })).resolves.toEqual({
        ok: true,
        skipped: false,
        created: 2,
        updated: 3,
      });
      expect(getDeleteCalls()).toHaveLength(3);
      expect(getWriteCalls().map(([, init]) => (init as { body: unknown }).body)).toEqual([
        { attributeType: FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID, value: essaludConceptUuid },
        { attributeType: INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID, value: 'ESSALUD-44' },
      ]);
    });

    it('never mixes complements from the person when the visit has a different manually selected payer', async () => {
      // The start-visit form lets the user correct the payer for this encounter.
      // Backfilling from the (stale) affiliation must not revert that choice.
      mockFetchSequence({
        personAttributes: personSaysEsSalud,
        visitAttributes: [
          {
            uuid: 'visit-attr-1',
            value: { uuid: 'particular-concept-uuid', display: 'Particular' },
            attributeType: { uuid: FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID },
          },
        ],
      });

      await expect(copyFinanciadorToVisit({ patientUuid, visitUuid, onlyFillMissing: true })).resolves.toMatchObject({
        ok: true,
        created: 0,
        updated: 0,
      });
      expect(getWriteCalls()).toHaveLength(0);
    });

    it('removes residual affiliation and SIS fields from a self-financed visit', async () => {
      mockFetchSequence({
        personAttributes: personSaysEsSalud,
        visitAttributes: [
          {
            uuid: 'visit-financer',
            value: SELF_FINANCED_CONCEPT_UUID,
            attributeType: { uuid: FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID },
          },
          {
            uuid: 'visit-number',
            value: 'STALE-SIS-10',
            attributeType: { uuid: INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID },
          },
          {
            uuid: 'visit-status',
            value: accreditationVigenteUuid,
            attributeType: { uuid: SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID },
          },
          {
            uuid: 'visit-checked-at',
            value: accreditationCheckedAt,
            attributeType: { uuid: SIS_ACCREDITATION_CHECKED_AT_VISIT_ATTRIBUTE_TYPE_UUID },
          },
        ],
      });

      await expect(copyFinanciadorToVisit({ patientUuid, visitUuid, onlyFillMissing: true })).resolves.toMatchObject({
        created: 0,
        updated: 3,
      });
      expect(getWriteCalls()).toHaveLength(0);
      expect(getDeleteCalls().map(([url]) => url)).toEqual([
        `${restBaseUrl}/visit/${visitUuid}/attribute/visit-number`,
        `${restBaseUrl}/visit/${visitUuid}/attribute/visit-status`,
        `${restBaseUrl}/visit/${visitUuid}/attribute/visit-checked-at`,
      ]);
    });

    it('does not combine a manually corrected SIS status with the person accreditation date', async () => {
      mockFetchSequence({
        personAttributes: [
          {
            uuid: 'person-financer',
            value: SIS_CONCEPT_UUID,
            attributeType: { uuid: INSURANCE_TYPE_PERSON_ATTRIBUTE_TYPE_UUID },
          },
          {
            uuid: 'person-status',
            value: accreditationVigenteUuid,
            attributeType: { uuid: ACCREDITATION_STATUS_PERSON_ATTRIBUTE_TYPE_UUID },
          },
          {
            uuid: 'person-checked-at',
            value: accreditationCheckedAt,
            attributeType: { uuid: ACCREDITATION_CHECKED_AT_PERSON_ATTRIBUTE_TYPE_UUID },
          },
        ],
        visitAttributes: [
          {
            uuid: 'visit-financer',
            value: SIS_CONCEPT_UUID,
            attributeType: { uuid: FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID },
          },
          {
            uuid: 'visit-status',
            value: 'manually-corrected-inactive-status',
            attributeType: { uuid: SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID },
          },
        ],
      });

      await expect(copyFinanciadorToVisit({ patientUuid, visitUuid, onlyFillMissing: true })).resolves.toEqual({
        ok: true,
        skipped: false,
        created: 0,
        updated: 0,
        reviewReason: 'sis-accreditation-conflict',
      });
      expect(getWriteCalls()).toHaveLength(0);
    });

    it('does not add a status beside a different orphan accreditation date', async () => {
      const staleCheckedAt = '2026-07-01T08:00:00.000-05:00';
      mockFetchSequence({
        personAttributes: [
          {
            uuid: 'person-financer',
            value: SIS_CONCEPT_UUID,
            attributeType: { uuid: INSURANCE_TYPE_PERSON_ATTRIBUTE_TYPE_UUID },
          },
          {
            uuid: 'person-number',
            value: 'SIS-PAIR-10',
            attributeType: { uuid: INSURANCE_CODE_PERSON_ATTRIBUTE_TYPE_UUID },
          },
          {
            uuid: 'person-status',
            value: accreditationVigenteUuid,
            attributeType: { uuid: ACCREDITATION_STATUS_PERSON_ATTRIBUTE_TYPE_UUID },
          },
          {
            uuid: 'person-checked-at',
            value: accreditationCheckedAt,
            attributeType: { uuid: ACCREDITATION_CHECKED_AT_PERSON_ATTRIBUTE_TYPE_UUID },
          },
        ],
        visitAttributes: [
          {
            uuid: 'visit-financer',
            value: SIS_CONCEPT_UUID,
            attributeType: { uuid: FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID },
          },
          {
            uuid: 'visit-number',
            value: 'SIS-PAIR-10',
            attributeType: { uuid: INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID },
          },
          {
            uuid: 'visit-checked-at',
            value: staleCheckedAt,
            attributeType: { uuid: SIS_ACCREDITATION_CHECKED_AT_VISIT_ATTRIBUTE_TYPE_UUID },
          },
        ],
      });

      await expect(copyFinanciadorToVisit({ patientUuid, visitUuid, onlyFillMissing: true })).resolves.toEqual({
        ok: true,
        skipped: false,
        created: 0,
        updated: 0,
        reviewReason: 'sis-accreditation-conflict',
      });
      expect(getWriteCalls()).toHaveLength(0);
      expect(getDeleteCalls()).toHaveLength(0);
    });

    it('still fills a payer the visit does not have yet', async () => {
      mockFetchSequence({ personAttributes: personSaysEsSalud, visitAttributes: [] });

      await expect(copyFinanciadorToVisit({ patientUuid, visitUuid, onlyFillMissing: true })).resolves.toMatchObject({
        ok: true,
        created: 2,
        updated: 0,
      });
      expect(getWriteCalls()).toHaveLength(2);
    });

    it('overwrites by default so the emergency sync keeps its behaviour', async () => {
      mockFetchSequence({
        personAttributes: personSaysEsSalud,
        visitAttributes: [
          {
            uuid: 'visit-attr-1',
            value: { uuid: 'particular-concept-uuid', display: 'Particular' },
            attributeType: { uuid: FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID },
          },
        ],
      });

      await expect(copyFinanciadorToVisit({ patientUuid, visitUuid })).resolves.toMatchObject({ updated: 1 });
    });
  });

  it('recovers idempotently after a partial write failure', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const personAttributes: Array<PersonAttribute> = [
      {
        uuid: 'attr-1',
        value: SIS_CONCEPT_UUID,
        attributeType: { uuid: INSURANCE_TYPE_PERSON_ATTRIBUTE_TYPE_UUID },
      },
      {
        uuid: 'attr-2',
        value: 'SIS-800',
        attributeType: { uuid: INSURANCE_CODE_PERSON_ATTRIBUTE_TYPE_UUID },
      },
      {
        uuid: 'attr-3',
        value: accreditationVigenteUuid,
        attributeType: { uuid: ACCREDITATION_STATUS_PERSON_ATTRIBUTE_TYPE_UUID },
      },
      {
        uuid: 'attr-4',
        value: accreditationCheckedAt,
        attributeType: { uuid: ACCREDITATION_CHECKED_AT_PERSON_ATTRIBUTE_TYPE_UUID },
      },
    ];
    let financerWasPersisted = false;
    let failInsuranceNumberOnce = true;

    mockOpenmrsFetch.mockImplementation((url: string, init?: { method?: string; body?: unknown }) => {
      if (isPersonInsuranceReadUrl(url)) {
        return Promise.resolve({ data: { attributes: personAttributes } }) as never;
      }
      if (url === visitUrl) {
        return Promise.resolve({
          data: {
            attributes: financerWasPersisted
              ? [
                  {
                    uuid: 'visit-financer',
                    value: SIS_CONCEPT_UUID,
                    attributeType: { uuid: FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID },
                  },
                ]
              : [],
          },
        }) as never;
      }
      if (init?.method === 'POST') {
        const body = init.body as { attributeType?: string };
        if (body.attributeType === FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID) {
          financerWasPersisted = true;
        }
        if (body.attributeType === INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID && failInsuranceNumberOnce) {
          failInsuranceNumberOnce = false;
          return Promise.reject(new Error('temporary write failure')) as never;
        }
      }
      return Promise.resolve({ data: {} }) as never;
    });

    await expect(safeCopyFinanciadorToVisit({ patientUuid, visitUuid, onlyFillMissing: true })).resolves.toMatchObject({
      ok: false,
    });
    await expect(safeCopyFinanciadorToVisit({ patientUuid, visitUuid, onlyFillMissing: true })).resolves.toEqual({
      ok: true,
      skipped: false,
      created: 3,
      updated: 0,
    });

    const bodies = getWriteCalls().map(([, init]) => (init as { body: { attributeType: string } }).body);
    expect(bodies.filter(({ attributeType }) => attributeType === FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID)).toHaveLength(
      1,
    );
    expect(bodies.at(-1)).toEqual({
      attributeType: SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID,
      value: accreditationVigenteUuid,
    });
    consoleErrorSpy.mockRestore();
  });

  it('does not persist a SIS status after the checked-at write fails', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const personAttributes: Array<PersonAttribute> = [
      {
        uuid: 'attr-1',
        value: SIS_CONCEPT_UUID,
        attributeType: { uuid: INSURANCE_TYPE_PERSON_ATTRIBUTE_TYPE_UUID },
      },
      {
        uuid: 'attr-2',
        value: 'SIS-801',
        attributeType: { uuid: INSURANCE_CODE_PERSON_ATTRIBUTE_TYPE_UUID },
      },
      {
        uuid: 'attr-3',
        value: accreditationVigenteUuid,
        attributeType: { uuid: ACCREDITATION_STATUS_PERSON_ATTRIBUTE_TYPE_UUID },
      },
      {
        uuid: 'attr-4',
        value: accreditationCheckedAt,
        attributeType: { uuid: ACCREDITATION_CHECKED_AT_PERSON_ATTRIBUTE_TYPE_UUID },
      },
    ];

    mockOpenmrsFetch.mockImplementation((url: string, init?: { method?: string; body?: unknown }) => {
      if (isPersonInsuranceReadUrl(url)) {
        return Promise.resolve({ data: { attributes: personAttributes } }) as never;
      }
      if (url === visitUrl) {
        return Promise.resolve({ data: { attributes: [] } }) as never;
      }
      if (
        init?.method === 'POST' &&
        (init.body as { attributeType?: string }).attributeType ===
          SIS_ACCREDITATION_CHECKED_AT_VISIT_ATTRIBUTE_TYPE_UUID
      ) {
        return Promise.reject(new Error('checked-at write failed')) as never;
      }
      return Promise.resolve({ data: {} }) as never;
    });

    await expect(safeCopyFinanciadorToVisit({ patientUuid, visitUuid, onlyFillMissing: true })).resolves.toMatchObject({
      ok: false,
    });

    const writtenAttributeTypes = getWriteCalls().map(
      ([, init]) => (init as { body: { attributeType: string } }).body.attributeType,
    );
    expect(writtenAttributeTypes).toContain(SIS_ACCREDITATION_CHECKED_AT_VISIT_ATTRIBUTE_TYPE_UUID);
    expect(writtenAttributeTypes).not.toContain(SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID);
    consoleErrorSpy.mockRestore();
  });

  describe('failure-safe explicit synchronization', () => {
    const previousCheckedAt = '2026-08-10T09:00:00.000-05:00';
    const currentCheckedAt = '2026-08-11T16:00:00.000-05:00';
    const accreditationNoVigenteUuid = SIS_ACCREDITATION_INACTIVE_CONCEPT_UUID;

    const completeSisVisit = (): Array<PersonAttribute> => [
      {
        uuid: 'old-payer',
        value: SIS_CONCEPT_UUID,
        attributeType: { uuid: FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID },
      },
      {
        uuid: 'old-number',
        value: 'SIS-OLD-10',
        attributeType: { uuid: INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID },
      },
      {
        uuid: 'old-status',
        value: accreditationVigenteUuid,
        attributeType: { uuid: SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID },
      },
      {
        uuid: 'old-checked-at',
        value: previousCheckedAt,
        attributeType: { uuid: SIS_ACCREDITATION_CHECKED_AT_VISIT_ATTRIBUTE_TYPE_UUID },
      },
    ];

    it.each([
      ['pending', SIS_ACCREDITATION_PENDING_CONCEPT_UUID],
      ['inactive', SIS_ACCREDITATION_INACTIVE_CONCEPT_UUID],
      ['not consulted', SIS_ACCREDITATION_NOT_CONSULTED_CONCEPT_UUID],
      ['unknown', 'unknown-sis-accreditation-status'],
    ])('refreshes a %s visit accreditation after the person is corrected to active', async (_case, staleStatus) => {
      mockFetchSequence({
        personAttributes: [
          {
            uuid: 'person-payer',
            value: SIS_CONCEPT_UUID,
            attributeType: { uuid: INSURANCE_TYPE_PERSON_ATTRIBUTE_TYPE_UUID },
          },
          {
            uuid: 'person-number',
            value: 'SIS-OLD-10',
            attributeType: { uuid: INSURANCE_CODE_PERSON_ATTRIBUTE_TYPE_UUID },
          },
          {
            uuid: 'person-status',
            value: SIS_ACCREDITATION_ACTIVE_CONCEPT_UUID,
            attributeType: { uuid: ACCREDITATION_STATUS_PERSON_ATTRIBUTE_TYPE_UUID },
          },
          {
            uuid: 'person-checked-at',
            value: currentCheckedAt,
            attributeType: { uuid: ACCREDITATION_CHECKED_AT_PERSON_ATTRIBUTE_TYPE_UUID },
          },
        ],
        visitAttributes: completeSisVisit().map((attribute) =>
          attribute.attributeType.uuid === SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID
            ? { ...attribute, value: staleStatus }
            : attribute,
        ),
      });

      await expect(copyFinanciadorToVisit({ patientUuid, visitUuid, onlyFillMissing: false })).resolves.toEqual({
        ok: true,
        skipped: false,
        created: 1,
        updated: 2,
      });
      expect(getDeleteCalls().map(([url]) => url)).toContain(`${restBaseUrl}/visit/${visitUuid}/attribute/old-status`);
      expect(getWriteCalls().map(([, init]) => (init as { body: unknown }).body)).toEqual([
        { value: currentCheckedAt },
        {
          attributeType: SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID,
          value: SIS_ACCREDITATION_ACTIVE_CONCEPT_UUID,
        },
      ]);
    });

    it('invalidates the old SIS status before replacing date/status and converges after status creation fails', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const state = mockStatefulVisitPersistence({
        personAttributes: [
          {
            uuid: 'person-payer',
            value: SIS_CONCEPT_UUID,
            attributeType: { uuid: INSURANCE_TYPE_PERSON_ATTRIBUTE_TYPE_UUID },
          },
          {
            uuid: 'person-number',
            value: 'SIS-OLD-10',
            attributeType: { uuid: INSURANCE_CODE_PERSON_ATTRIBUTE_TYPE_UUID },
          },
          {
            uuid: 'person-status',
            value: accreditationNoVigenteUuid,
            attributeType: { uuid: ACCREDITATION_STATUS_PERSON_ATTRIBUTE_TYPE_UUID },
          },
          {
            uuid: 'person-checked-at',
            value: currentCheckedAt,
            attributeType: { uuid: ACCREDITATION_CHECKED_AT_PERSON_ATTRIBUTE_TYPE_UUID },
          },
        ],
        initialVisitAttributes: completeSisVisit(),
        failOnceWhen: ({ method, body }) =>
          method === 'POST' && body?.attributeType === SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID,
      });

      await expect(
        safeCopyFinanciadorToVisit({ patientUuid, visitUuid, onlyFillMissing: false }),
      ).resolves.toMatchObject({ ok: false });
      expect(state.getValue(FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID)).toBe(SIS_CONCEPT_UUID);
      expect(state.getValue(SIS_ACCREDITATION_CHECKED_AT_VISIT_ATTRIBUTE_TYPE_UUID)).toBe(currentCheckedAt);
      expect(state.hasAttribute(SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID)).toBe(false);

      const oldStatusDeleteIndex = mockOpenmrsFetch.mock.calls.findIndex(
        ([url, init]) => url.endsWith('/attribute/old-status') && (init as { method?: string })?.method === 'DELETE',
      );
      const dateUpdateIndex = mockOpenmrsFetch.mock.calls.findIndex(
        ([url, init]) => url.endsWith('/attribute/old-checked-at') && (init as { method?: string })?.method === 'POST',
      );
      const newStatusIndex = mockOpenmrsFetch.mock.calls.findIndex(
        ([, init]) =>
          (init as { method?: string })?.method === 'POST' &&
          (init as { body?: { attributeType?: string } })?.body?.attributeType ===
            SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID,
      );
      expect(oldStatusDeleteIndex).toBeLessThan(dateUpdateIndex);
      expect(dateUpdateIndex).toBeLessThan(newStatusIndex);

      await expect(safeCopyFinanciadorToVisit({ patientUuid, visitUuid, onlyFillMissing: false })).resolves.toEqual({
        ok: true,
        skipped: false,
        created: 1,
        updated: 0,
      });
      expect(state.getValue(SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID)).toBe(accreditationNoVigenteUuid);
      expect(state.getValue(SIS_ACCREDITATION_CHECKED_AT_VISIT_ATTRIBUTE_TYPE_UUID)).toBe(currentCheckedAt);
      consoleErrorSpy.mockRestore();
    });

    it('commits SIS before its complements and converges after an affiliation-number failure', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const state = mockStatefulVisitPersistence({
        personAttributes: [
          {
            uuid: 'person-payer',
            value: SIS_CONCEPT_UUID,
            attributeType: { uuid: INSURANCE_TYPE_PERSON_ATTRIBUTE_TYPE_UUID },
          },
          {
            uuid: 'person-number',
            value: 'SIS-NEW-30',
            attributeType: { uuid: INSURANCE_CODE_PERSON_ATTRIBUTE_TYPE_UUID },
          },
          {
            uuid: 'person-status',
            value: accreditationVigenteUuid,
            attributeType: { uuid: ACCREDITATION_STATUS_PERSON_ATTRIBUTE_TYPE_UUID },
          },
          {
            uuid: 'person-checked-at',
            value: currentCheckedAt,
            attributeType: { uuid: ACCREDITATION_CHECKED_AT_PERSON_ATTRIBUTE_TYPE_UUID },
          },
        ],
        initialVisitAttributes: [
          {
            uuid: 'old-payer',
            value: essaludConceptUuid,
            attributeType: { uuid: FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID },
          },
          {
            uuid: 'old-number',
            value: 'ESSALUD-OLD-30',
            attributeType: { uuid: INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID },
          },
        ],
        failOnceWhen: ({ method, body }) =>
          method === 'POST' && body?.attributeType === INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID,
      });

      await expect(
        safeCopyFinanciadorToVisit({ patientUuid, visitUuid, onlyFillMissing: false }),
      ).resolves.toMatchObject({ ok: false });
      expect(state.getValue(FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID)).toBe(SIS_CONCEPT_UUID);
      expect(state.hasAttribute(INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID)).toBe(false);
      expect(state.hasAttribute(SIS_ACCREDITATION_CHECKED_AT_VISIT_ATTRIBUTE_TYPE_UUID)).toBe(false);
      expect(state.hasAttribute(SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID)).toBe(false);

      const payerCommitIndex = mockOpenmrsFetch.mock.calls.findIndex(
        ([url, init]) =>
          url.endsWith('/attribute/old-payer') &&
          (init as { method?: string })?.method === 'POST' &&
          (init as { body?: { value?: string } })?.body?.value === SIS_CONCEPT_UUID,
      );
      const newNumberIndex = mockOpenmrsFetch.mock.calls.findIndex(
        ([, init]) =>
          (init as { method?: string })?.method === 'POST' &&
          (init as { body?: { attributeType?: string } })?.body?.attributeType ===
            INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID,
      );
      expect(payerCommitIndex).toBeLessThan(newNumberIndex);

      await expect(safeCopyFinanciadorToVisit({ patientUuid, visitUuid, onlyFillMissing: false })).resolves.toEqual({
        ok: true,
        skipped: false,
        created: 3,
        updated: 0,
      });
      expect(state.getValue(FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID)).toBe(SIS_CONCEPT_UUID);
      expect(state.getValue(INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID)).toBe('SIS-NEW-30');
      expect(state.getValue(SIS_ACCREDITATION_CHECKED_AT_VISIT_ATTRIBUTE_TYPE_UUID)).toBe(currentCheckedAt);
      expect(state.getValue(SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID)).toBe(accreditationVigenteUuid);
      consoleErrorSpy.mockRestore();
    });

    it('preserves the original non-SIS bundle when the SIS payer commit fails, then converges', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const state = mockStatefulVisitPersistence({
        personAttributes: [
          {
            uuid: 'person-payer',
            value: SIS_CONCEPT_UUID,
            attributeType: { uuid: INSURANCE_TYPE_PERSON_ATTRIBUTE_TYPE_UUID },
          },
          {
            uuid: 'person-number',
            value: 'SIS-NEW-31',
            attributeType: { uuid: INSURANCE_CODE_PERSON_ATTRIBUTE_TYPE_UUID },
          },
          {
            uuid: 'person-status',
            value: accreditationVigenteUuid,
            attributeType: { uuid: ACCREDITATION_STATUS_PERSON_ATTRIBUTE_TYPE_UUID },
          },
          {
            uuid: 'person-checked-at',
            value: currentCheckedAt,
            attributeType: { uuid: ACCREDITATION_CHECKED_AT_PERSON_ATTRIBUTE_TYPE_UUID },
          },
        ],
        initialVisitAttributes: [
          {
            uuid: 'old-payer',
            value: essaludConceptUuid,
            attributeType: { uuid: FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID },
          },
          {
            uuid: 'old-number',
            value: 'ESSALUD-OLD-31',
            attributeType: { uuid: INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID },
          },
        ],
        failOnceWhen: ({ url, method, body }) =>
          method === 'POST' && url.endsWith('/attribute/old-payer') && body?.value === SIS_CONCEPT_UUID,
      });

      await expect(
        safeCopyFinanciadorToVisit({ patientUuid, visitUuid, onlyFillMissing: false }),
      ).resolves.toMatchObject({ ok: false });
      expect(state.getValue(FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID)).toBe(essaludConceptUuid);
      expect(state.getValue(INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID)).toBe('ESSALUD-OLD-31');
      expect(getDeleteCalls()).toHaveLength(0);

      mockOpenmrsFetch.mockClear();
      await expect(safeCopyFinanciadorToVisit({ patientUuid, visitUuid, onlyFillMissing: false })).resolves.toEqual({
        ok: true,
        skipped: false,
        created: 3,
        updated: 2,
      });

      const payerCommitIndex = mockOpenmrsFetch.mock.calls.findIndex(
        ([url, init]) =>
          url.endsWith('/attribute/old-payer') &&
          (init as { method?: string })?.method === 'POST' &&
          (init as { body?: { value?: string } })?.body?.value === SIS_CONCEPT_UUID,
      );
      const oldNumberDeleteIndex = mockOpenmrsFetch.mock.calls.findIndex(
        ([url, init]) => url.endsWith('/attribute/old-number') && (init as { method?: string })?.method === 'DELETE',
      );
      const statusCommitIndex = mockOpenmrsFetch.mock.calls.findIndex(
        ([, init]) =>
          (init as { method?: string })?.method === 'POST' &&
          (init as { body?: { attributeType?: string } })?.body?.attributeType ===
            SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID,
      );
      expect(payerCommitIndex).toBeLessThan(oldNumberDeleteIndex);
      expect(oldNumberDeleteIndex).toBeLessThan(statusCommitIndex);
      expect(state.getValue(FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID)).toBe(SIS_CONCEPT_UUID);
      expect(state.getValue(INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID)).toBe('SIS-NEW-31');
      expect(state.getValue(SIS_ACCREDITATION_CHECKED_AT_VISIT_ATTRIBUTE_TYPE_UUID)).toBe(currentCheckedAt);
      expect(state.getValue(SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID)).toBe(accreditationVigenteUuid);
      consoleErrorSpy.mockRestore();
    });

    it('keeps the old SIS payer as a retry marker when the final EsSalud payer write fails, then converges', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const state = mockStatefulVisitPersistence({
        personAttributes: [
          {
            uuid: 'person-payer',
            value: essaludConceptUuid,
            attributeType: { uuid: INSURANCE_TYPE_PERSON_ATTRIBUTE_TYPE_UUID },
          },
          {
            uuid: 'person-number',
            value: 'ESSALUD-NEW-20',
            attributeType: { uuid: INSURANCE_CODE_PERSON_ATTRIBUTE_TYPE_UUID },
          },
        ],
        initialVisitAttributes: completeSisVisit(),
        failOnceWhen: ({ url, method, body }) =>
          method === 'POST' && url.endsWith('/attribute/old-payer') && body?.value === essaludConceptUuid,
      });

      await expect(
        safeCopyFinanciadorToVisit({ patientUuid, visitUuid, onlyFillMissing: false }),
      ).resolves.toMatchObject({ ok: false });
      expect(state.getValue(FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID)).toBe(SIS_CONCEPT_UUID);
      expect(state.getValue(INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID)).toBe('ESSALUD-NEW-20');
      expect(state.hasAttribute(SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID)).toBe(false);
      expect(state.hasAttribute(SIS_ACCREDITATION_CHECKED_AT_VISIT_ATTRIBUTE_TYPE_UUID)).toBe(false);

      const oldStatusDeleteIndex = mockOpenmrsFetch.mock.calls.findIndex(
        ([url, init]) => url.endsWith('/attribute/old-status') && (init as { method?: string })?.method === 'DELETE',
      );
      const newNumberIndex = mockOpenmrsFetch.mock.calls.findIndex(
        ([, init]) =>
          (init as { method?: string })?.method === 'POST' &&
          (init as { body?: { attributeType?: string } })?.body?.attributeType ===
            INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID,
      );
      const payerCommitIndex = mockOpenmrsFetch.mock.calls.findIndex(
        ([url, init]) =>
          url.endsWith('/attribute/old-payer') &&
          (init as { method?: string })?.method === 'POST' &&
          (init as { body?: { value?: string } })?.body?.value === essaludConceptUuid,
      );
      expect(oldStatusDeleteIndex).toBeLessThan(newNumberIndex);
      expect(newNumberIndex).toBeLessThan(payerCommitIndex);

      await expect(safeCopyFinanciadorToVisit({ patientUuid, visitUuid, onlyFillMissing: false })).resolves.toEqual({
        ok: true,
        skipped: false,
        created: 1,
        updated: 2,
      });
      expect(state.getValue(FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID)).toBe(essaludConceptUuid);
      expect(state.getValue(INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID)).toBe('ESSALUD-NEW-20');
      expect(state.hasAttribute(SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID)).toBe(false);
      expect(state.hasAttribute(SIS_ACCREDITATION_CHECKED_AT_VISIT_ATTRIBUTE_TYPE_UUID)).toBe(false);
      consoleErrorSpy.mockRestore();
    });

    it('keeps the old SIS payer without status after an EsSalud number failure, then converges', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const state = mockStatefulVisitPersistence({
        personAttributes: [
          {
            uuid: 'person-payer',
            value: essaludConceptUuid,
            attributeType: { uuid: INSURANCE_TYPE_PERSON_ATTRIBUTE_TYPE_UUID },
          },
          {
            uuid: 'person-number',
            value: 'ESSALUD-NEW-21',
            attributeType: { uuid: INSURANCE_CODE_PERSON_ATTRIBUTE_TYPE_UUID },
          },
        ],
        initialVisitAttributes: completeSisVisit(),
        failOnceWhen: ({ method, body }) =>
          method === 'POST' && body?.attributeType === INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID,
      });

      await expect(
        safeCopyFinanciadorToVisit({ patientUuid, visitUuid, onlyFillMissing: false }),
      ).resolves.toMatchObject({ ok: false });
      expect(state.getValue(FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID)).toBe(SIS_CONCEPT_UUID);
      expect(state.hasAttribute(INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID)).toBe(false);
      expect(state.hasAttribute(SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID)).toBe(false);
      expect(state.hasAttribute(SIS_ACCREDITATION_CHECKED_AT_VISIT_ATTRIBUTE_TYPE_UUID)).toBe(false);

      await expect(safeCopyFinanciadorToVisit({ patientUuid, visitUuid, onlyFillMissing: false })).resolves.toEqual({
        ok: true,
        skipped: false,
        created: 1,
        updated: 1,
      });
      expect(state.getValue(FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID)).toBe(essaludConceptUuid);
      expect(state.getValue(INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID)).toBe('ESSALUD-NEW-21');
      consoleErrorSpy.mockRestore();
    });

    it('keeps only the old SIS payer as a retry marker when the final self-financed payer write fails', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const state = mockStatefulVisitPersistence({
        personAttributes: [
          {
            uuid: 'person-payer',
            value: SELF_FINANCED_CONCEPT_UUID,
            attributeType: { uuid: INSURANCE_TYPE_PERSON_ATTRIBUTE_TYPE_UUID },
          },
        ],
        initialVisitAttributes: completeSisVisit(),
        failOnceWhen: ({ url, method, body }) =>
          method === 'POST' && url.endsWith('/attribute/old-payer') && body?.value === SELF_FINANCED_CONCEPT_UUID,
      });

      await expect(
        safeCopyFinanciadorToVisit({ patientUuid, visitUuid, onlyFillMissing: false }),
      ).resolves.toMatchObject({ ok: false });
      expect(state.getValue(FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID)).toBe(SIS_CONCEPT_UUID);
      expect(state.hasAttribute(INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID)).toBe(false);
      expect(state.hasAttribute(SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID)).toBe(false);
      expect(state.hasAttribute(SIS_ACCREDITATION_CHECKED_AT_VISIT_ATTRIBUTE_TYPE_UUID)).toBe(false);

      await expect(safeCopyFinanciadorToVisit({ patientUuid, visitUuid, onlyFillMissing: false })).resolves.toEqual({
        ok: true,
        skipped: false,
        created: 0,
        updated: 1,
      });
      expect(state.getValue(FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID)).toBe(SELF_FINANCED_CONCEPT_UUID);
      expect(state.hasAttribute(INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID)).toBe(false);
      expect(state.hasAttribute(SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID)).toBe(false);
      expect(state.hasAttribute(SIS_ACCREDITATION_CHECKED_AT_VISIT_ATTRIBUTE_TYPE_UUID)).toBe(false);
      consoleErrorSpy.mockRestore();
    });
  });
});

describe('safeCopyFinanciadorToVisit', () => {
  it('returns the copy result when everything succeeds', async () => {
    mockFetchSequence({ personAttributes: [] });

    await expect(safeCopyFinanciadorToVisit({ patientUuid, visitUuid })).resolves.toEqual({
      ok: true,
      skipped: true,
      created: 0,
      updated: 0,
      reviewReason: 'missing-financiador',
    });
  });

  it('never throws: returns { ok: false, error } on failure', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failure = new Error('network down');
    mockOpenmrsFetch.mockRejectedValue(failure);

    await expect(safeCopyFinanciadorToVisit({ patientUuid, visitUuid })).resolves.toEqual({
      ok: false,
      error: failure,
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'No se pudo copiar el financiador de la persona a la visita.',
      failure,
    );
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(expect.stringContaining(patientUuid), expect.anything());
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(expect.stringContaining(visitUuid), expect.anything());
    consoleErrorSpy.mockRestore();
  });
});
