import type { ConfigObject } from '../config-schema';
import type { DyakuPatient } from './dyaku-patients.resource';

const mockOpenmrsFetch = vi.fn();
const mockFetch = vi.fn();
let resource: typeof import('./dyaku-patients.resource');

vi.mock('@openmrs/esm-framework', () => ({
  openmrsFetch: mockOpenmrsFetch,
  omrsOfflineCachingStrategyHttpHeaderName: 'x-omrs-offline-caching-strategy',
  useConfig: vi.fn(),
}));

const config: ConfigObject = {
  dyaku: {
    fhirBaseUrl: 'https://fhir.test',
    fhirImplementationGuideBaseUrl: 'https://fhir.test/guides/',
    patientProfileUrl: 'https://fhir.test/StructureDefinition/PacientePe',
    identifierSourceUuid: 'src-uuid',
    dniIdentifierTypeUuid: 'dni-uuid',
    hscIdentifierTypeUuid: 'hsc-uuid',
    defaultLocationUuid: 'loc-uuid',
    emailAttributeTypeUuid: 'email-uuid',
    phoneAttributeTypeUuid: 'phone-uuid',
    syncEnabled: true,
    syncBatchSize: 50,
    syncIntervalMinutes: 60,
  },
};

function patient(dni = '00000001'): DyakuPatient & { identifier: NonNullable<DyakuPatient['identifier']> } {
  return {
    resourceType: 'Patient',
    id: `synthetic-${dni}`,
    identifier: [{ system: 'urn:oid:2.16.840.1.113883.3.9143.2.1.5', value: dni }],
    name: [{ family: 'Synthetic', given: ['Test'] }],
    gender: 'male',
    birthDate: '1990-01-01',
  };
}

const ok = (data: unknown) => ({ ok: true, status: 200, data });
const localPatient = (uuid = 'local-uuid', dni = '00000001', type = 'dni-uuid') => ({
  uuid,
  voided: false,
  identifiers: [
    { identifier: 'HCE-EXISTING', identifierType: { uuid: 'hsc-uuid' }, preferred: true, voided: false },
    { identifier: dni, identifierType: { uuid: type }, voided: false },
  ],
});
const writes = () => mockOpenmrsFetch.mock.calls.filter(([, options]) => options?.method === 'POST');
const patientWrites = () => writes().filter(([url]) => /\/patient(?:\/|$)/.test(url));

function mockBundle(patients: DyakuPatient[]) {
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      resourceType: 'Bundle',
      type: 'searchset',
      total: patients.length,
      entry: patients.map((p) => ({ resource: p })),
    }),
  });
}

beforeAll(async () => {
  resource = await import('./dyaku-patients.resource');
});

beforeEach(() => {
  vi.clearAllMocks();
  mockOpenmrsFetch.mockReset();
  mockFetch.mockReset();
  vi.stubGlobal('fetch', mockFetch);
  mockOpenmrsFetch.mockImplementation(async (url: string, options?: { method?: string }) => {
    if (url.includes('/patientidentifiertype/')) {
      return ok({
        uuid: url.includes('dni-uuid') ? 'dni-uuid' : 'hsc-uuid',
        retired: false,
        locationBehavior: 'NOT_USED',
      });
    }
    if (url.includes('/idgen/')) return ok({ identifier: 'HCE-NEW' });
    if (options?.method === 'POST') return ok({ uuid: 'local-uuid' });
    return ok({ results: [] });
  });
});

afterEach(() => vi.unstubAllGlobals());

describe('DNI identity integrity', () => {
  it.each(['12345678', '01234567'])('preserves the exact eight digit value %s', (dni) => {
    expect(resource.validateAndFixPeruvianDNI(dni)).toBe(dni);
  });

  it.each(['123456789', '12-345-678', ' 12345678', '12345678 ', '1234567', '', '1234567890'])(
    'rejects %s without silently rewriting identity',
    (dni) => {
      expect(resource.validateAndFixPeruvianDNI(dni)).toBeNull();
    },
  );

  it.each([
    [{ value: '00000001' }],
    [{ system: 'passport', value: '00000001' }],
    [{ type: { coding: [{ system: 'unrelated', code: 'DNI' }] }, value: '00000001' }],
    [
      {
        type: { coding: [{ system: 'https://www.gob.pe/minsa/RENHICE/fhir/CodeSystem/IdspersonaPeru', code: '2' }] },
        value: '00000001',
      },
    ],
  ])('never treats another or untyped document as DNI', async (identifier) => {
    const result = await resource.syncSinglePatientToOpenMRS({ ...patient(), identifier: [identifier] }, config);
    expect(result.success).toBe(false);
    expect(writes()).toEqual([]);
  });

  it('recognizes the exact official DNI type without the legacy identifier system', async () => {
    const result = await resource.syncSinglePatientToOpenMRS(
      {
        ...patient(),
        identifier: [
          {
            type: {
              coding: [{ system: 'https://www.gob.pe/minsa/RENHICE/fhir/CodeSystem/IdspersonaPeru', code: '1' }],
            },
            value: '00000001',
          },
        ],
      },
      config,
    );
    expect(result.success).toBe(true);
    expect(patientWrites()[0][1].body.identifiers).toContainEqual({
      identifier: '00000001',
      identifierType: 'dni-uuid',
      preferred: false,
    });
  });

  it('blocks conflicting DNI values on one patient', async () => {
    const source = patient();
    source.identifier.push({ system: source.identifier[0].system, value: '00000002' });
    expect((await resource.syncSinglePatientToOpenMRS(source, config)).success).toBe(false);
    expect(writes()).toEqual([]);
  });
});

describe('fresh exact local identity lookup', () => {
  it.each([401, 403, 500])('does not create or update after HTTP %i', async (status) => {
    mockOpenmrsFetch.mockRejectedValue({ status, message: 'PRIVATE-ID-AND-TRACE' });
    const result = await resource.syncSinglePatientToOpenMRS(patient(), config);
    expect(result.success).toBe(false);
    expect(writes()).toEqual([]);
    expect(JSON.stringify(result)).not.toContain('PRIVATE');
    expect(JSON.stringify(result)).not.toContain('synthetic-');
  });

  it.each([undefined, {}, { results: null }, { results: [] }, { results: [{}] }])(
    'rejects malformed or non-successful local lookup responses',
    async (data) => {
      mockOpenmrsFetch.mockResolvedValue({ ok: false, data });
      expect((await resource.syncSinglePatientToOpenMRS(patient(), config)).success).toBe(false);
      expect(writes()).toEqual([]);
    },
  );

  it('blocks an incomplete paginated search rather than assuming absence', async () => {
    mockOpenmrsFetch.mockResolvedValue(ok({ results: [], links: [{ rel: 'next', uri: 'https://example.test/next' }] }));
    expect((await resource.syncSinglePatientToOpenMRS(patient(), config)).success).toBe(false);
    expect(writes()).toEqual([]);
  });

  it('blocks two exact typed matches', async () => {
    mockOpenmrsFetch.mockResolvedValue(ok({ results: [localPatient('one'), localPatient('two')] }));
    expect((await resource.syncSinglePatientToOpenMRS(patient(), config)).success).toBe(false);
    expect(writes()).toEqual([]);
  });

  it('never updates a fuzzy match or matching number of another document type', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce(ok({ results: [localPatient('other', '00000001', 'passport')] }));
    const result = await resource.syncSinglePatientToOpenMRS(patient(), config);
    expect(result.success).toBe(false);
    expect(writes()).toEqual([]);
  });

  it('requests fresh network identity and preserves identifiers and absent demographics on update', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce(ok({ results: [localPatient()] }));
    const source = patient();
    delete source.birthDate;
    delete source.gender;
    delete source.name;
    const result = await resource.syncSinglePatientToOpenMRS(source, config);
    expect(result.success).toBe(true);
    expect(mockOpenmrsFetch.mock.calls[0][1]).toMatchObject({ cache: 'no-store', rejectOnAuthFailure: true });
    expect(writes()).toEqual([]);
  });

  it('updates only supplied demographics without generating a new HCE', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce(ok({ results: [localPatient()] }));
    const result = await resource.syncSinglePatientToOpenMRS(patient(), config);
    expect(result.success).toBe(true);
    expect(writes()).toHaveLength(1);
    expect(patientWrites()[0][0]).toBe('/ws/rest/v1/patient/local-uuid');
    expect(patientWrites()[0][1].body).toEqual({
      person: {
        names: [{ givenName: 'Test', familyName: 'Synthetic', preferred: true }],
        gender: 'M',
        birthdate: '1990-01-01',
      },
    });
  });
});

describe('creation and response integrity', () => {
  it('does not guess location for identifier types marked NOT_USED', async () => {
    const result = await resource.syncSinglePatientToOpenMRS(patient(), config);
    expect(result.success).toBe(true);
    expect(mockOpenmrsFetch.mock.calls.some(([url]) => url.includes('/location'))).toBe(false);
    expect(patientWrites()[0][1].body.identifiers.every((identifier: object) => !('location' in identifier))).toBe(
      true,
    );
  });

  it('blocks unknown identifier location behavior before generating identifiers', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce(ok({ results: [] })).mockResolvedValueOnce(ok({ uuid: 'hsc-uuid' }));
    expect((await resource.syncSinglePatientToOpenMRS(patient(), config)).success).toBe(false);
    expect(writes()).toEqual([]);
  });

  it.each([undefined, '', 123])('blocks malformed idgen result %s before patient creation', async (identifier) => {
    const defaultImplementation = mockOpenmrsFetch.getMockImplementation();
    if (!defaultImplementation) throw new Error('Missing test mock');
    mockOpenmrsFetch.mockImplementation((url: string, options: object) =>
      url.includes('/idgen/') ? Promise.resolve(ok({ identifier })) : defaultImplementation(url, options),
    );
    expect((await resource.syncSinglePatientToOpenMRS(patient(), config)).success).toBe(false);
    expect(patientWrites()).toEqual([]);
  });

  it('does not report persistence from malformed write response', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce(ok({ results: [localPatient()] })).mockResolvedValueOnce(ok({}));
    expect((await resource.syncSinglePatientToOpenMRS(patient(), config)).success).toBe(false);
  });

  it.each([
    { name: [] },
    { name: [{ given: ['Test'] }] },
    { birthDate: '2020-02-30' },
    { birthDate: '2020' },
    { gender: undefined },
  ])('blocks incomplete or invalid new demographics without consuming idgen', async (change) => {
    expect((await resource.syncSinglePatientToOpenMRS({ ...patient(), ...change }, config)).success).toBe(false);
    expect(writes()).toEqual([]);
  });
});

describe('batch integrity', () => {
  it('rejects every duplicate DNI in one batch, including conflicting source resources', async () => {
    mockBundle([patient(), { ...patient(), id: 'another-synthetic-resource' }]);
    const result = await resource.syncDyakuPatientsToOpenMRS('https://fhir.test', 50, config);
    expect(result).toMatchObject({ success: false, synchronized: 0, failed: 2 });
    expect(writes()).toEqual([]);
  });

  it('reports every processed patient and successful persistence', async () => {
    mockBundle([patient(), patient('00000002'), patient('00000003')]);
    const progress = vi.fn();
    const result = await resource.syncDyakuPatientsToOpenMRS('https://fhir.test', 3, config, progress);
    expect(result).toMatchObject({ success: true, synchronized: 3, failed: 0 });
    expect(patientWrites()).toHaveLength(3);
    expect(progress).toHaveBeenCalledTimes(3);
    expect(progress).toHaveBeenLastCalledWith(3, 3);
  });

  it.each([{ resourceType: 'OperationOutcome' }, { resourceType: 'Bundle', type: 'searchset', entry: [{}] }])(
    'rejects invalid remote bundles without local writes',
    async (bundle) => {
      mockFetch.mockResolvedValue({ ok: true, json: async () => bundle });
      await expect(resource.syncDyakuPatientsToOpenMRS('https://fhir.test', 50, config)).rejects.toThrow();
      expect(writes()).toEqual([]);
    },
  );

  it('accepts a valid empty bundle', async () => {
    mockBundle([]);
    expect(await resource.syncDyakuPatientsToOpenMRS('https://fhir.test', 50, config)).toMatchObject({
      success: true,
      synchronized: 0,
      failed: 0,
    });
    expect(writes()).toEqual([]);
  });
});

describe('adversarial import responses', () => {
  it.each([{}, { results: null }, { results: [{}] }, { results: [{ ...localPatient(), voided: true }] }])(
    'blocks an invalid successful response without writes',
    async (data) => {
      mockOpenmrsFetch.mockResolvedValue(ok(data));
      expect((await resource.syncSinglePatientToOpenMRS(patient(), config)).success).toBe(false);
      expect(writes()).toEqual([]);
    },
  );

  it.each([{ gender: '__proto__' }, { name: 'invalid' }, { identifier: [{ type: { coding: 'invalid' } }] }])(
    'rejects malformed patient fields before identity lookup',
    async (change) => {
      const malformed = { ...patient(), ...change } as unknown as DyakuPatient;
      expect((await resource.syncSinglePatientToOpenMRS(malformed, config)).success).toBe(false);
      expect(mockOpenmrsFetch).not.toHaveBeenCalled();
    },
  );

  it('rejects an inactive source patient', async () => {
    expect((await resource.syncSinglePatientToOpenMRS({ ...patient(), active: false }, config)).success).toBe(false);
    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
  });

  it('rejects a DNI OID contradicted by an explicit passport type', async () => {
    const source = patient();
    source.identifier[0].type = {
      coding: [{ system: 'https://www.gob.pe/minsa/RENHICE/fhir/CodeSystem/IdspersonaPeru', code: '3' }],
    };
    expect((await resource.syncSinglePatientToOpenMRS(source, config)).success).toBe(false);
    expect(writes()).toEqual([]);
  });

  it('preserves absent name and gender when only birth date is supplied', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce(ok({ results: [localPatient()] }));
    const source = patient();
    delete source.name;
    delete source.gender;
    expect((await resource.syncSinglePatientToOpenMRS(source, config)).success).toBe(true);
    expect(patientWrites()[0][1].body).toEqual({ person: { birthdate: '1990-01-01' } });
  });

  it('preserves absent local attributes when only the remote email is supplied', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce(ok({ results: [localPatient()] }));
    const source = patient();
    delete source.name;
    delete source.gender;
    delete source.birthDate;
    source.telecom = [{ system: 'email', value: 'synthetic@example.test' }];
    expect((await resource.syncSinglePatientToOpenMRS(source, config)).success).toBe(true);
    expect(patientWrites()[0][1].body).toEqual({
      person: { attributes: [{ attributeType: 'email-uuid', value: 'synthetic@example.test' }] },
    });
  });

  it('uses only the configured verified location for REQUIRED identifier types', async () => {
    const defaultImplementation = mockOpenmrsFetch.getMockImplementation();
    if (!defaultImplementation) throw new Error('Missing test mock');
    mockOpenmrsFetch.mockImplementation((url: string, options: object) => {
      if (url.includes('/patientidentifiertype/'))
        return Promise.resolve(
          ok({
            uuid: url.includes('dni-uuid') ? 'dni-uuid' : 'hsc-uuid',
            retired: false,
            locationBehavior: 'REQUIRED',
          }),
        );
      if (url.includes('/location/')) return Promise.resolve(ok({ uuid: 'loc-uuid', retired: false }));
      return defaultImplementation(url, options);
    });
    expect((await resource.syncSinglePatientToOpenMRS(patient(), config)).success).toBe(true);
    expect(
      patientWrites()[0][1].body.identifiers.every(
        (identifier: { location: string }) => identifier.location === 'loc-uuid',
      ),
    ).toBe(true);
    expect(
      mockOpenmrsFetch.mock.calls
        .filter(([url]) => url.includes('/location'))
        .every(([url]) => url === '/ws/rest/v1/location/loc-uuid?v=default'),
    ).toBe(true);
  });

  it('does not use a different or retired location as fallback', async () => {
    const defaultImplementation = mockOpenmrsFetch.getMockImplementation();
    if (!defaultImplementation) throw new Error('Missing test mock');
    mockOpenmrsFetch.mockImplementation((url: string, options: object) => {
      if (url.includes('/patientidentifiertype/'))
        return Promise.resolve(
          ok({
            uuid: url.includes('dni-uuid') ? 'dni-uuid' : 'hsc-uuid',
            retired: false,
            locationBehavior: 'REQUIRED',
          }),
        );
      if (url.includes('/location/')) return Promise.resolve(ok({ uuid: 'another-location', retired: false }));
      return defaultImplementation(url, options);
    });
    expect((await resource.syncSinglePatientToOpenMRS(patient(), config)).success).toBe(false);
    expect(writes()).toEqual([]);
  });

  it('does not auto-retry an unconfirmed write or disclose its raw error', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce(ok({ results: [localPatient()] }))
      .mockRejectedValueOnce(new Error('PRIVATE-ID TRACE https://private.test'));
    const result = await resource.syncSinglePatientToOpenMRS(patient(), config);
    expect(result.errors).toEqual(['syncWriteUnconfirmed']);
    expect(writes()).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain('PRIVATE');
  });

  it('rejects repeated remote resource IDs even when DNI values differ', async () => {
    mockBundle([patient(), { ...patient('00000002'), id: patient().id }]);
    expect(await resource.syncDyakuPatientsToOpenMRS('https://fhir.test', 50, config)).toMatchObject({
      synchronized: 0,
      failed: 2,
    });
    expect(writes()).toEqual([]);
  });

  it('blocks concurrent imports of the same DNI within this browser and releases the guard', async () => {
    let resolveLookup!: (value: ReturnType<typeof ok>) => void;
    mockOpenmrsFetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveLookup = resolve;
        }),
    );
    const first = resource.syncSinglePatientToOpenMRS(patient(), config);
    const second = await resource.syncSinglePatientToOpenMRS(patient(), config);
    expect(second.errors).toEqual(['syncDuplicateInBatch']);
    expect(writes()).toEqual([]);
    resolveLookup(ok({ results: [localPatient()] }));
    expect((await first).success).toBe(true);
    mockOpenmrsFetch.mockResolvedValueOnce(ok({ results: [localPatient()] }));
    expect((await resource.syncSinglePatientToOpenMRS(patient(), config)).success).toBe(true);
  });
});
