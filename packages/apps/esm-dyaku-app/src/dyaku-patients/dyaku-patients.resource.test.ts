let validateAndFixPeruvianDNI: (dni: string) => string | null;
const mockOpenmrsFetch = vi.fn();

import type { ConfigObject } from '../config-schema';

let syncDyakuPatientsToOpenMRS: (
  fhirBaseUrl: string,
  batchSize: number,
  config: ConfigObject,
  onProgress?: (processed: number, total: number) => void,
) => Promise<{
  success: boolean;
  synchronized: number;
  failed: number;
  errors: string[];
}>;

vi.mock('@openmrs/esm-framework', () => ({
  openmrsFetch: mockOpenmrsFetch,
  useConfig: vi.fn(),
  useConfigObject: vi.fn(),
  useSystemSession: vi.fn(),
  configSchema: {},
  Type: {
    Boolean: 'boolean',
    Number: 'number',
    Object: 'object',
    String: 'string',
  },
}));

beforeAll(async () => {
  const dyakuResource = await import('./dyaku-patients.resource');
  ({ validateAndFixPeruvianDNI, syncDyakuPatientsToOpenMRS } = dyakuResource);
});

describe('validateAndFixPeruvianDNI', () => {
  it('returns 8-digit DNI unchanged', () => {
    expect(validateAndFixPeruvianDNI('12345678')).toBe('12345678');
  });

  it('strips 9th check digit', () => {
    expect(validateAndFixPeruvianDNI('123456789')).toBe('12345678');
  });

  it('removes non-digit characters', () => {
    expect(validateAndFixPeruvianDNI('12-345-678')).toBe('12345678');
  });

  it('returns null for DNI shorter than 8 digits', () => {
    expect(validateAndFixPeruvianDNI('1234567')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(validateAndFixPeruvianDNI('')).toBeNull();
  });

  it('returns null for DNI with more than 9 digits after cleaning', () => {
    expect(validateAndFixPeruvianDNI('1234567890')).toBeNull();
  });

  it('handles DNI with leading zeros', () => {
    expect(validateAndFixPeruvianDNI('01234567')).toBe('01234567');
  });
});

describe('syncDyakuPatientsToOpenMRS', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    mockOpenmrsFetch.mockReset();
    global.fetch = mockFetch;
  });

  const makePatient = (id: string) => ({
    resourceType: 'Patient' as const,
    id,
    identifier: [{ value: `0000000${id}` }],
    name: [{ family: `Apellido${id}`, given: [`Nombre${id}`] }],
    gender: 'male' as const,
    birthDate: '1990-01-01',
  });

  const mockConfig: ConfigObject = {
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

  it('calls onProgress for each patient', async () => {
    const patients = Array.from({ length: 3 }, (_, i) => makePatient(String(i + 1)));

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        resourceType: 'Bundle',
        id: 'b1',
        type: 'searchset',
        total: 3,
        entry: patients.map((p) => ({ resource: p })),
      }),
    });

    mockOpenmrsFetch.mockResolvedValue({ data: { results: [] } });
    mockOpenmrsFetch.mockResolvedValueOnce({ data: { results: [] } });
    mockOpenmrsFetch.mockResolvedValueOnce({ data: {} });
    mockOpenmrsFetch.mockResolvedValueOnce({ data: {} });
    mockOpenmrsFetch.mockResolvedValue({ data: { results: [] } });

    const progressCalls: Array<[number, number]> = [];
    const onProgress = (processed: number, total: number) => progressCalls.push([processed, total]);

    await syncDyakuPatientsToOpenMRS('https://fhir.test', 3, mockConfig, onProgress);

    expect(progressCalls.length).toBe(3);
    expect(progressCalls[progressCalls.length - 1][0]).toBe(3);
    expect(progressCalls[progressCalls.length - 1][1]).toBe(3);
  });

  it('returns success=false and collects errors when patients fail', async () => {
    const patients = [makePatient('1'), makePatient('2')];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        resourceType: 'Bundle',
        id: 'b1',
        type: 'searchset',
        total: 2,
        entry: patients.map((p) => ({ resource: p })),
      }),
    });

    mockOpenmrsFetch.mockRejectedValue(new Error('Network error'));

    const result = await syncDyakuPatientsToOpenMRS('https://fhir.test', 2, mockConfig);

    expect(result.success).toBe(false);
    expect(result.failed).toBeGreaterThan(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('returns empty result when FHIR bundle has no entries', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        resourceType: 'Bundle',
        id: 'b1',
        type: 'searchset',
        total: 0,
      }),
    });

    const result = await syncDyakuPatientsToOpenMRS('https://fhir.test', 50, mockConfig);

    expect(result.synchronized).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.success).toBe(true);
  });
});
