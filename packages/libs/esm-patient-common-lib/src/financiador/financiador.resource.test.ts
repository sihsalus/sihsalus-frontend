import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';

import {
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
  SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID,
  SIS_ACCREDITATION_ACTIVE_CONCEPT_UUID,
  SIS_ACCREDITATION_INACTIVE_CONCEPT_UUID,
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
const visitUrl = `${restBaseUrl}/visit/${visitUuid}?v=custom:(attributes:(uuid,value,attributeType:(uuid)))`;

const essaludConceptUuid = 'af799b5e-313c-4352-80c4-5007dcd42f29';
const accreditationVigenteUuid = 'accreditation-vigente-uuid';

type PersonAttribute = {
  uuid: string;
  value: string | { uuid?: string; display?: string } | null;
  attributeType: { uuid: string };
};

function mockFetchSequence({
  personAttributes = [],
  visitAttributes = [],
}: {
  personAttributes?: Array<PersonAttribute>;
  visitAttributes?: Array<PersonAttribute>;
}) {
  mockOpenmrsFetch.mockImplementation((url: string) => {
    if (url === personUrl) {
      return Promise.resolve({ data: { attributes: personAttributes } }) as never;
    }
    if (url === visitUrl) {
      return Promise.resolve({ data: { attributes: visitAttributes } }) as never;
    }
    // Escrituras (POST a /visit/{uuid}/attribute[...]) devuelven ok.
    return Promise.resolve({ data: {} }) as never;
  });
}

function getWriteCalls() {
  return mockOpenmrsFetch.mock.calls.filter(([, init]) => (init as { method?: string } | undefined)?.method === 'POST');
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
        accreditationStatusUuid: SIS_ACCREDITATION_ACTIVE_CONCEPT_UUID,
      }),
    ).toBe('active');
    expect(
      getSisFinancingState({
        financiadorUuid: SIS_CONCEPT_UUID,
        accreditationStatusUuid: SIS_ACCREDITATION_INACTIVE_CONCEPT_UUID,
      }),
    ).toBe('inactive');
    expect(
      getSisFinancingState({ financiadorUuid: essaludConceptUuid, accreditationStatusUuid: null }),
    ).toBe('notApplicable');
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
      ],
    });

    await expect(fetchVisitInsurance(visitUuid)).resolves.toEqual({
      financiadorUuid: SIS_CONCEPT_UUID,
      insuranceNumber: 'SIS-123',
      accreditationStatusUuid: SIS_ACCREDITATION_ACTIVE_CONCEPT_UUID,
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
  it('skips silently when the person has no insurance data', async () => {
    mockFetchSequence({ personAttributes: [] });

    await expect(copyFinanciadorToVisit({ patientUuid, visitUuid })).resolves.toEqual({
      ok: true,
      skipped: true,
      created: 0,
      updated: 0,
    });
    // Solo la lectura de la persona: no se toca la visita.
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(1);
    expect(mockOpenmrsFetch).toHaveBeenCalledWith(personUrl);
  });

  it('creates the three visit attributes when the visit has none', async () => {
    mockFetchSequence({
      personAttributes: [
        {
          uuid: 'attr-1',
          value: { uuid: essaludConceptUuid, display: 'EsSalud' },
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
      ],
      visitAttributes: [],
    });

    await expect(copyFinanciadorToVisit({ patientUuid, visitUuid })).resolves.toEqual({
      ok: true,
      skipped: false,
      created: 3,
      updated: 0,
    });

    const writes = getWriteCalls();
    expect(writes).toHaveLength(3);
    expect(writes.map(([url]) => url)).toEqual([
      `${restBaseUrl}/visit/${visitUuid}/attribute`,
      `${restBaseUrl}/visit/${visitUuid}/attribute`,
      `${restBaseUrl}/visit/${visitUuid}/attribute`,
    ]);
    expect(writes.map(([, init]) => (init as { body: unknown }).body)).toEqual([
      { attributeType: FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID, value: essaludConceptUuid },
      { attributeType: INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID, value: 'COD-9' },
      { attributeType: SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID, value: accreditationVigenteUuid },
    ]);
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

  it('updates an existing attribute only when the value changed', async () => {
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
    });

    const writes = getWriteCalls();
    expect(writes).toHaveLength(1);
    expect(writes[0][0]).toBe(`${restBaseUrl}/visit/${visitUuid}/attribute/visit-attr-1`);
    expect((writes[0][1] as { body: unknown }).body).toEqual({ value: essaludConceptUuid });
  });

  it('copies partial data (only the insurance code) without touching the other attributes', async () => {
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
      skipped: false,
      created: 1,
      updated: 0,
    });
    expect((getWriteCalls()[0][1] as { body: unknown }).body).toEqual({
      attributeType: INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID,
      value: 'COD-77',
    });
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
    ];

    it('never overwrites a payer already on the visit', async () => {
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

    it('still fills a payer the visit does not have yet', async () => {
      mockFetchSequence({ personAttributes: personSaysEsSalud, visitAttributes: [] });

      await expect(copyFinanciadorToVisit({ patientUuid, visitUuid, onlyFillMissing: true })).resolves.toMatchObject({
        ok: true,
        created: 1,
        updated: 0,
      });
      expect(getWriteCalls()).toHaveLength(1);
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
});

describe('safeCopyFinanciadorToVisit', () => {
  it('returns the copy result when everything succeeds', async () => {
    mockFetchSequence({ personAttributes: [] });

    await expect(safeCopyFinanciadorToVisit({ patientUuid, visitUuid })).resolves.toEqual({
      ok: true,
      skipped: true,
      created: 0,
      updated: 0,
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
