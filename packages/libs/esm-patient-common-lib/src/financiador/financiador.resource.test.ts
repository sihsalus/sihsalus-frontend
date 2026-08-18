import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';

import {
  ACCREDITATION_CHECKED_AT_PERSON_ATTRIBUTE_TYPE_UUID,
  ACCREDITATION_STATUS_PERSON_ATTRIBUTE_TYPE_UUID,
  copyFinanciadorToVisit,
  FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID,
  fetchPersonInsurance,
  fetchVisitInsurance,
  getCodedValueUuid,
  getSisFinancingState,
  getTextValue,
  INSURANCE_CODE_PERSON_ATTRIBUTE_TYPE_UUID,
  INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID,
  INSURANCE_TYPE_PERSON_ATTRIBUTE_TYPE_UUID,
  LEGACY_SIS_PRODUCT_CONCEPT_UUIDS,
  normalizeFinanciadorConceptUuid,
  SELF_FINANCED_CONCEPT_UUID,
  SIS_ACCREDITATION_CHECKED_AT_VISIT_ATTRIBUTE_TYPE_UUID,
  SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID,
  SIS_ACCREDITATION_ACTIVE_CONCEPT_UUID,
  SIS_ACCREDITATION_INACTIVE_CONCEPT_UUID,
  SIS_ACCREDITATION_NOT_CONSULTED_CONCEPT_UUID,
  SIS_ACCREDITATION_PENDING_CONCEPT_UUID,
  SIS_CONCEPT_UUID,
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
const identifiersUrl = `${restBaseUrl}/patient/${patientUuid}?v=custom:(identifiers:(identifier,voided))`;
const visitUrl = `${restBaseUrl}/visit/${visitUuid}?v=custom:(attributes:(uuid,value,attributeType:(uuid)))`;

const essaludConceptUuid = 'af799b5e-313c-4352-80c4-5007dcd42f29';
const accreditationVigenteUuid = SIS_ACCREDITATION_ACTIVE_CONCEPT_UUID;
const accreditationCheckedAt = '2026-08-11T14:30:00.000-05:00';

type PersonAttribute = {
  uuid: string;
  value: string | { uuid?: string; display?: string } | null;
  attributeType: { uuid: string };
};

function mockFetchSequence({
  personAttributes = [],
  patientIdentifiers = [],
  visitAttributes = [],
}: {
  personAttributes?: Array<PersonAttribute>;
  patientIdentifiers?: Array<{ identifier: string; voided?: boolean }>;
  visitAttributes?: Array<PersonAttribute>;
}) {
  mockOpenmrsFetch.mockImplementation((url: string) => {
    if (url === personUrl) {
      return Promise.resolve({ data: { attributes: personAttributes } }) as never;
    }
    if (url === visitUrl) {
      return Promise.resolve({ data: { attributes: visitAttributes } }) as never;
    }
    if (url === identifiersUrl) {
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
    if (!init?.method && url === personUrl) {
      return Promise.resolve({ data: { attributes: personAttributes } }) as never;
    }
    if (!init?.method && url === identifiersUrl) {
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

describe('fetchPersonInsurance', () => {
  it('returns empty insurance without fetching when the patient UUID is missing', async () => {
    await expect(fetchPersonInsurance('')).resolves.toEqual({
      insuranceTypeUuid: null,
      insuranceCode: null,
      accreditationStatusUuid: null,
      accreditationCheckedAt: null,
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
      ],
    });

    await expect(fetchPersonInsurance(patientUuid)).resolves.toEqual({
      insuranceTypeUuid: SIS_CONCEPT_UUID,
      insuranceCode: 'COD-000123',
      accreditationStatusUuid: accreditationVigenteUuid,
      accreditationCheckedAt: null,
    });
    expect(mockOpenmrsFetch).toHaveBeenCalledWith(personUrl);
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
    expect(mockOpenmrsFetch).toHaveBeenCalledWith(personUrl);
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
      if (url === personUrl) {
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
      if (url === identifiersUrl) {
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
    expect(mockOpenmrsFetch).not.toHaveBeenCalledWith(identifiersUrl);
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
    expect(mockOpenmrsFetch).toHaveBeenCalledWith(identifiersUrl);
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
      if (url === personUrl) {
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
      if (url === personUrl) {
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
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
