import { createHash } from 'node:crypto';
import { Workbook, type Worksheet } from 'exceljs';
import { v5 } from 'uuid';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  type FreshPatientIdentity,
  fetchFreshPatientIdentityByUuid,
  searchLocalIdentityByDocument,
} from '../patient-registration/identity/identity-search.resource';
import { generateIdentifier, savePatient } from '../patient-registration/patient-registration.resource';
import type { PatientIdentifierType } from '../patient-registration/patient-registration.types';
import { peruDniPatientIdentifierTypeUuid } from '../patient-registration/peru-registration-config';
import { type SantaClotildeHeader, santaClotildeHeaders } from './bulk-patient-import.types';
import {
  bulkPatientImportRowErrorMessage,
  calculateFileSha256,
  createPatientFromImportRow,
  downloadImportReport,
  getImportLimits,
  normalizeAndValidateImportRow,
  normalizeDate,
  parseSantaClotildeWorkbook,
  preflightBulkPatientImportRows,
  summarizeImportRows,
  validateBulkPatientImportMetadata,
} from './bulk-patient-import.utils';

vi.mock('../patient-registration/identity/identity-search.resource', () => ({
  fetchFreshPatientIdentityByUuid: vi.fn(),
  searchLocalIdentityByDocument: vi.fn(),
}));

vi.mock('../patient-registration/patient-registration.resource', async () => ({
  ...(await vi.importActual('../patient-registration/patient-registration.resource')),
  generateIdentifier: vi.fn(),
  savePatient: vi.fn(),
}));

const mockSearchLocalIdentityByDocument = vi.mocked(searchLocalIdentityByDocument);
const mockFetchFreshPatientIdentityByUuid = vi.mocked(fetchFreshPatientIdentityByUuid);
const mockGenerateIdentifier = vi.mocked(generateIdentifier);
const mockSavePatient = vi.mocked(savePatient);
const mockAssertBeforeWrite = vi.fn<() => Promise<void>>();
const patientImportUuidNamespace = 'a56257d4-7d7b-4f6b-946e-c28fc970c916';
const excelContentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const identifierTypes = [
  {
    fieldName: 'dni',
    isPrimary: true,
    identifierSources: [],
    locationBehavior: 'NOT_USED',
    name: 'DNI',
    format: '^\\d{8}$',
    required: true,
    uniquenessBehavior: 'UNIQUE',
    uuid: peruDniPatientIdentifierTypeUuid,
  },
] as Array<PatientIdentifierType>;
const generatedIdentifierType = {
  fieldName: 'hce',
  format: '',
  identifierSources: [
    {
      uuid: '44444444-4444-4444-8444-444444444444',
      autoGenerationOption: { automaticGenerationEnabled: true, manualEntryEnabled: false },
    },
  ],
  isPrimary: false,
  locationBehavior: 'REQUIRED',
  name: 'HCE',
  required: true,
  uniquenessBehavior: 'UNIQUE',
  uuid: '33333333-3333-4333-8333-333333333333',
} as PatientIdentifierType;

function buildRawRow(overrides: Partial<Record<SantaClotildeHeader, string>> = {}) {
  return {
    ORDEN: '1',
    DNI: '11111111',
    SEXO: 'F',
    'F.N.': '01/01/1990',
    'A.PATERNO': 'SINTETICO',
    'A.MATERNO': 'PRUEBA',
    NOMBRES: 'PACIENTE FICTICIO',
    PARENTESCO: '',
    DOMICILIO: 'DIRECCION SINTETICA NO USAR',
    ...overrides,
  } as Record<SantaClotildeHeader, string>;
}

function buildImportRow(overrides: Partial<Record<SantaClotildeHeader, string>> = {}) {
  const row = normalizeAndValidateImportRow(buildRawRow(overrides), 2);
  row.patientUuid = '9b840936-a975-594c-9ff0-a7e9bffc7161';
  row.id = `approved-file-hash:${row.rowNumber}`;
  return row;
}

function getFixturePatientUuid(row = buildImportRow()) {
  if (!row.patientUuid) {
    throw new Error('Invalid patient import test fixture.');
  }
  return row.patientUuid;
}

function buildRowOptions(domicilioTarget: 'address4' | 'cityVillage' = 'address4', signal?: AbortSignal) {
  return { domicilioTarget, signal, assertBeforeWrite: mockAssertBeforeWrite };
}

function buildExactSearchMatch(row = buildImportRow()) {
  return {
    kind: 'patient' as const,
    uuid: getFixturePatientUuid(row),
    display: 'Synthetic patient',
    identifier: row.normalized.dni,
    identifierTypeUuid: peruDniPatientIdentifierTypeUuid,
  };
}

function buildFreshPatient(
  row = buildImportRow(),
  domicilioTarget: 'address4' | 'cityVillage' = 'address4',
): FreshPatientIdentity {
  return {
    uuid: getFixturePatientUuid(row),
    identifiers: [
      {
        identifier: row.normalized.dni,
        identifierType: { uuid: peruDniPatientIdentifierTypeUuid },
        preferred: true,
      },
    ],
    person: {
      uuid: row.patientUuid,
      gender: row.normalized.gender,
      birthdate: `${row.normalized.birthdate}T00:00:00.000+0000`,
      birthdateEstimated: false,
      dead: false,
      attributes: [],
      names: [
        {
          preferred: true,
          givenName: row.normalized.givenName,
          middleName: row.normalized.middleName,
          familyName: row.normalized.familyName,
          familyName2: row.normalized.familyName2,
        },
      ],
      addresses: row.normalized.domicilio ? [{ preferred: true, [domicilioTarget]: row.normalized.domicilio }] : [],
    },
  };
}

function rawRowValues(overrides: Partial<Record<SantaClotildeHeader, string>> = {}) {
  const raw = buildRawRow(overrides);
  return santaClotildeHeaders.map((header) => raw[header]);
}

async function buildWorkbookFile({
  fileName = 'patients.xlsx',
  headers = [...santaClotildeHeaders],
  rows = [rawRowValues()],
  updateWorksheet,
}: {
  fileName?: string;
  headers?: Array<string>;
  rows?: Array<Array<unknown>>;
  updateWorksheet?: (worksheet: Worksheet) => void;
} = {}) {
  const workbook = new Workbook();
  const worksheet = workbook.addWorksheet('Patients');
  worksheet.addRow(headers);
  rows.forEach((row) => {
    worksheet.addRow(row);
  });
  updateWorksheet?.(worksheet);
  const buffer = await workbook.xlsx.writeBuffer();
  return new File([buffer as BlobPart], fileName, { type: excelContentType });
}

function alphabeticSuffix(index: number) {
  let value = index;
  let suffix = '';

  do {
    suffix = String.fromCharCode(65 + (value % 26)) + suffix;
    value = Math.floor(value / 26) - 1;
  } while (value >= 0);

  return suffix;
}

describe('bulk patient import safety checks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchLocalIdentityByDocument.mockResolvedValue([]);
    mockFetchFreshPatientIdentityByUuid.mockResolvedValue(null);
    mockGenerateIdentifier.mockResolvedValue({ data: { identifier: 'SYNTHETIC-HCE-1' }, ok: true } as never);
    mockAssertBeforeWrite.mockResolvedValue();
    mockSavePatient.mockResolvedValue({
      data: { uuid: '9b840936-a975-594c-9ff0-a7e9bffc7161' },
      ok: true,
    } as never);
  });

  it('accepts a valid adult row', () => {
    const row = normalizeAndValidateImportRow(buildRawRow(), 2);

    expect(row.errors).toEqual([]);
    expect(row.normalized).toMatchObject({
      birthdate: '1990-01-01',
      familyName: 'SINTETICO',
      givenName: 'PACIENTE',
      middleName: 'FICTICIO',
    });
  });

  it('accepts a one-letter optional middle name like the manual form', () => {
    const row = normalizeAndValidateImportRow(buildRawRow({ NOMBRES: 'ANA M' }), 2);

    expect(row.errors).toEqual([]);
    expect(row.normalized.middleName).toBe('M');
  });

  it('rejects the reserved DNI used by the synthetic template', () => {
    const row = normalizeAndValidateImportRow(buildRawRow({ DNI: '00000000' }), 2);

    expect(row.errors).toContain('DNI 00000000 is reserved for the synthetic template and cannot be imported.');
  });

  it('rejects invalid name characters and minors that require a responsible person', () => {
    const row = normalizeAndValidateImportRow(buildRawRow({ NOMBRES: 'SINTETICO@', 'F.N.': '01/01/2015' }), 2);

    expect(row.errors).toEqual(
      expect.arrayContaining([
        'NOMBRES contains invalid characters.',
        'Los pacientes menores de edad deben registrarse manualmente junto con su responsable.',
      ]),
    );
  });

  it('checks OpenMRS for an existing document before creating the patient', async () => {
    const row = buildImportRow();
    mockSearchLocalIdentityByDocument.mockResolvedValue([
      {
        kind: 'patient',
        uuid: 'existing-patient-uuid',
        display: 'Ana Quispe',
        identifier: '11111111',
        identifierTypeUuid: peruDniPatientIdentifierTypeUuid,
      },
    ]);

    await expect(createPatientFromImportRow(row, identifierTypes, 'location-uuid', buildRowOptions())).rejects.toThrow(
      bulkPatientImportRowErrorMessage,
    );
    expect(mockSavePatient).not.toHaveBeenCalled();
  });

  it('reconciles an exact prior import only after a fresh UUID resource matches every clinical field', async () => {
    const row = buildImportRow();
    mockSearchLocalIdentityByDocument.mockResolvedValue([buildExactSearchMatch(row)]);
    mockFetchFreshPatientIdentityByUuid.mockResolvedValue(buildFreshPatient(row));

    await expect(createPatientFromImportRow(row, identifierTypes, 'location-uuid', buildRowOptions())).resolves.toEqual(
      {
        patientUuid: row.patientUuid,
        outcome: 'reconciled',
      },
    );
    expect(mockSavePatient).not.toHaveBeenCalled();
  });

  it('does not reconcile an imported patient that is missing a required generated identifier', async () => {
    const row = buildImportRow();
    mockSearchLocalIdentityByDocument.mockResolvedValue([buildExactSearchMatch(row)]);
    mockFetchFreshPatientIdentityByUuid.mockResolvedValue(buildFreshPatient(row));

    await expect(
      preflightBulkPatientImportRows([row], [...identifierTypes, generatedIdentifierType], 'location-uuid', {
        domicilioTarget: 'address4',
      }),
    ).rejects.toEqual(new Error(bulkPatientImportRowErrorMessage));
    expect(mockGenerateIdentifier).not.toHaveBeenCalled();
    expect(mockSavePatient).not.toHaveBeenCalled();
  });

  it('requires the generated identifier value and location to match after creation', async () => {
    const row = buildImportRow();
    const patientWithWrongGeneratedIdentifier = buildFreshPatient(row);
    patientWithWrongGeneratedIdentifier.identifiers?.push({
      identifier: 'DIFFERENT-HCE',
      identifierType: { uuid: generatedIdentifierType.uuid },
      location: { uuid: 'location-uuid' },
      preferred: false,
    });
    mockSearchLocalIdentityByDocument.mockResolvedValueOnce([]).mockResolvedValueOnce([buildExactSearchMatch(row)]);
    mockFetchFreshPatientIdentityByUuid
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(patientWithWrongGeneratedIdentifier);

    await expect(
      createPatientFromImportRow(row, [...identifierTypes, generatedIdentifierType], 'location-uuid', {
        ...buildRowOptions(),
      }),
    ).rejects.toEqual(new Error(bulkPatientImportRowErrorMessage));
    expect(mockGenerateIdentifier).toHaveBeenCalledOnce();
    expect(mockSavePatient).toHaveBeenCalledOnce();
  });

  it('revalidates the approval immediately before IdGen and performs no write when it changed', async () => {
    const row = buildImportRow();
    mockAssertBeforeWrite.mockRejectedValueOnce(new Error('private expired approval details'));

    await expect(
      createPatientFromImportRow(
        row,
        [...identifierTypes, generatedIdentifierType],
        'location-uuid',
        buildRowOptions(),
      ),
    ).rejects.toEqual(new Error(bulkPatientImportRowErrorMessage));
    expect(mockGenerateIdentifier).not.toHaveBeenCalled();
    expect(mockSavePatient).not.toHaveBeenCalled();
  });

  it('revalidates again after IdGen and stops before the patient POST when the context changed', async () => {
    const row = buildImportRow();
    mockAssertBeforeWrite
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('private changed-session details'));

    await expect(
      createPatientFromImportRow(
        row,
        [...identifierTypes, generatedIdentifierType],
        'location-uuid',
        buildRowOptions(),
      ),
    ).rejects.toEqual(new Error(bulkPatientImportRowErrorMessage));
    expect(mockGenerateIdentifier).toHaveBeenCalledOnce();
    expect(mockSavePatient).not.toHaveBeenCalled();
  });

  it('rejects a non-2xx IdGen response even if its body resembles an identifier', async () => {
    const row = buildImportRow();
    mockGenerateIdentifier.mockResolvedValueOnce({ data: { identifier: 'SYNTHETIC-HCE-1' }, ok: false } as never);

    await expect(
      createPatientFromImportRow(
        row,
        [...identifierTypes, generatedIdentifierType],
        'location-uuid',
        buildRowOptions(),
      ),
    ).rejects.toEqual(new Error(bulkPatientImportRowErrorMessage));
    expect(mockSavePatient).not.toHaveBeenCalled();
  });

  it.each([
    [
      'patient UUID',
      (patient: FreshPatientIdentity) => {
        patient.uuid = 'different-patient-uuid';
      },
    ],
    [
      'DNI',
      (patient: FreshPatientIdentity) => {
        patient.identifiers = [{ ...patient.identifiers?.[0], identifier: '22222222' }];
      },
    ],
    [
      'DNI type',
      (patient: FreshPatientIdentity) => {
        patient.identifiers = [{ ...patient.identifiers?.[0], identifierType: { uuid: 'different-identifier-type' } }];
      },
    ],
    [
      'preferred name',
      (patient: FreshPatientIdentity) => {
        patient.person = {
          ...patient.person,
          names: [{ ...patient.person?.names?.[0], givenName: 'DIFFERENT' }],
        };
      },
    ],
    [
      'preferred-name flag',
      (patient: FreshPatientIdentity) => {
        patient.person = {
          ...patient.person,
          names: [{ ...patient.person?.names?.[0], preferred: false }],
        };
      },
    ],
    [
      'sex',
      (patient: FreshPatientIdentity) => {
        patient.person = { ...patient.person, gender: 'M' };
      },
    ],
    [
      'birthdate',
      (patient: FreshPatientIdentity) => {
        patient.person = { ...patient.person, birthdate: '1991-01-01T00:00:00.000+0000' };
      },
    ],
    [
      'birthdate-estimated flag',
      (patient: FreshPatientIdentity) => {
        patient.person = { ...patient.person, birthdateEstimated: true };
      },
    ],
    [
      'dead flag',
      (patient: FreshPatientIdentity) => {
        patient.person = { ...patient.person, dead: true };
      },
    ],
    [
      'unexpected active person attribute',
      (patient: FreshPatientIdentity) => {
        patient.person = { ...patient.person, attributes: [{ voided: false }] };
      },
    ],
    [
      'configured DOMICILIO field',
      (patient: FreshPatientIdentity) => {
        patient.person = {
          ...patient.person,
          addresses: [{ ...patient.person?.addresses?.[0], address4: 'DIFFERENT' }],
        };
      },
    ],
  ])('fails closed without a write when the fresh patient %s does not match', async (_label, makeMismatch) => {
    const row = buildImportRow();
    const patient = buildFreshPatient(row);
    makeMismatch(patient);
    mockSearchLocalIdentityByDocument.mockResolvedValue([buildExactSearchMatch(row)]);
    mockFetchFreshPatientIdentityByUuid.mockResolvedValue(patient);

    await expect(createPatientFromImportRow(row, identifierTypes, 'location-uuid', buildRowOptions())).rejects.toEqual(
      new Error(bulkPatientImportRowErrorMessage),
    );
    expect(mockSavePatient).not.toHaveBeenCalled();
  });

  it('fails closed when DNI search finds the expected UUID but the fresh UUID GET returns 404', async () => {
    const row = buildImportRow();
    mockSearchLocalIdentityByDocument.mockResolvedValue([buildExactSearchMatch(row)]);
    mockFetchFreshPatientIdentityByUuid.mockResolvedValue(null);

    await expect(createPatientFromImportRow(row, identifierTypes, 'location-uuid', buildRowOptions())).rejects.toEqual(
      new Error(bulkPatientImportRowErrorMessage),
    );
    expect(mockSavePatient).not.toHaveBeenCalled();
  });

  it('fails closed on a deterministic UUID collision even when the DNI search is empty', async () => {
    const row = buildImportRow();
    mockSearchLocalIdentityByDocument.mockResolvedValue([]);
    mockFetchFreshPatientIdentityByUuid.mockResolvedValue(buildFreshPatient(row));

    await expect(createPatientFromImportRow(row, identifierTypes, 'location-uuid', buildRowOptions())).rejects.toEqual(
      new Error(bulkPatientImportRowErrorMessage),
    );
    expect(mockSavePatient).not.toHaveBeenCalled();
  });

  it('reconciles a lost POST response only when the new DNI search and UUID GET both match exactly', async () => {
    const row = buildImportRow();
    mockSearchLocalIdentityByDocument.mockResolvedValueOnce([]).mockResolvedValueOnce([buildExactSearchMatch(row)]);
    mockFetchFreshPatientIdentityByUuid.mockResolvedValueOnce(null).mockResolvedValueOnce(buildFreshPatient(row));
    mockSavePatient.mockRejectedValueOnce(new Error('POST failed with private synthetic row details'));

    await expect(createPatientFromImportRow(row, identifierTypes, 'location-uuid', buildRowOptions())).resolves.toEqual(
      {
        patientUuid: row.patientUuid,
        outcome: 'reconciled',
      },
    );
    expect(mockSavePatient).toHaveBeenCalledTimes(1);
  });

  it('does not expose row data or backend details when lost-response reconciliation fails', async () => {
    const row = buildImportRow();
    mockSearchLocalIdentityByDocument
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('GET leaked private synthetic row details'));
    mockFetchFreshPatientIdentityByUuid.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    mockSavePatient.mockRejectedValueOnce(new Error(`POST leaked ${row.patientUuid}`));

    const outcome = createPatientFromImportRow(row, identifierTypes, 'location-uuid', buildRowOptions());

    await expect(outcome).rejects.toEqual(new Error(bulkPatientImportRowErrorMessage));
  });

  it('combines caller cancellation with the per-row timeout and returns only the fixed error', async () => {
    const row = buildImportRow();
    const caller = new AbortController();
    let requestSignal: AbortSignal | undefined;
    mockSavePatient.mockImplementation(
      (_patient, _patientUuid, signal) =>
        new Promise((_resolve, reject) => {
          requestSignal = signal;
          signal?.addEventListener('abort', () => reject(new Error('private aborted request details')), {
            once: true,
          });
        }),
    );

    const outcome = createPatientFromImportRow(
      row,
      identifierTypes,
      'location-uuid',
      buildRowOptions('address4', caller.signal),
    );
    await vi.waitFor(() => expect(mockSavePatient).toHaveBeenCalledOnce());
    caller.abort(new Error('private caller reason'));

    await expect(outcome).rejects.toEqual(new Error(bulkPatientImportRowErrorMessage));
    expect(requestSignal).not.toBe(caller.signal);
    expect(requestSignal?.aborted).toBe(true);
  });

  it('requires the POST response UUID itself to match before reconciliation can advance', async () => {
    const row = buildImportRow();
    mockSavePatient.mockResolvedValueOnce({ data: { uuid: 'different-patient-uuid' }, ok: true } as never);

    await expect(createPatientFromImportRow(row, identifierTypes, 'location-uuid', buildRowOptions())).rejects.toEqual(
      new Error(bulkPatientImportRowErrorMessage),
    );
    expect(mockSearchLocalIdentityByDocument).toHaveBeenCalledTimes(1);
    expect(mockFetchFreshPatientIdentityByUuid).toHaveBeenCalledTimes(1);
  });

  it('does not send a UPSS on identifier types marked NOT_USED', async () => {
    const row = buildImportRow();
    mockSearchLocalIdentityByDocument.mockResolvedValueOnce([]).mockResolvedValueOnce([buildExactSearchMatch(row)]);
    mockFetchFreshPatientIdentityByUuid.mockResolvedValueOnce(null).mockResolvedValueOnce(buildFreshPatient(row));

    await expect(createPatientFromImportRow(row, identifierTypes, 'location-uuid', buildRowOptions())).resolves.toEqual(
      {
        patientUuid: row.patientUuid,
        outcome: 'created',
      },
    );

    expect(mockSavePatient).toHaveBeenCalledWith(
      expect.objectContaining({
        identifiers: [
          {
            identifier: '11111111',
            identifierType: peruDniPatientIdentifierTypeUuid,
            preferred: true,
          },
        ],
      }),
      undefined,
      expect.any(AbortSignal),
    );
  });

  it('maps DOMICILIO only to the explicitly approved clinical field', async () => {
    const row = buildImportRow();
    mockSearchLocalIdentityByDocument.mockResolvedValueOnce([]).mockResolvedValueOnce([buildExactSearchMatch(row)]);
    mockFetchFreshPatientIdentityByUuid
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(buildFreshPatient(row, 'cityVillage'));

    await createPatientFromImportRow(row, identifierTypes, 'location-uuid', buildRowOptions('cityVillage'));

    expect(mockSavePatient).toHaveBeenCalledWith(
      expect.objectContaining({
        person: expect.objectContaining({
          addresses: [{ cityVillage: 'DIRECCION SINTETICA NO USAR', preferred: true }],
        }),
      }),
      undefined,
      expect.any(AbortSignal),
    );
    expect(JSON.stringify(mockSavePatient.mock.calls[0][0])).not.toContain('address1');
  });

  it('validates every identifier policy before consuming an IdGen value', () => {
    const missingAutomaticSource = [
      ...identifierTypes,
      {
        fieldName: 'hce',
        format: '',
        identifierSources: [{ uuid: 'source-without-automatic-generation' }],
        isPrimary: false,
        locationBehavior: 'REQUIRED',
        name: 'HCE',
        required: true,
        uniquenessBehavior: 'UNIQUE',
        uuid: '33333333-3333-4333-8333-333333333333',
      },
    ] as Array<PatientIdentifierType>;

    expect(() => validateBulkPatientImportMetadata(missingAutomaticSource, 'location-uuid')).toThrow(
      bulkPatientImportRowErrorMessage,
    );
    expect(mockGenerateIdentifier).not.toHaveBeenCalled();
  });

  it('requires exactly one primary identifier type before consuming IdGen', () => {
    const conflictingPrimary = { ...generatedIdentifierType, isPrimary: true };

    expect(() => validateBulkPatientImportMetadata([...identifierTypes, conflictingPrimary], 'location-uuid')).toThrow(
      bulkPatientImportRowErrorMessage,
    );
    expect(mockGenerateIdentifier).not.toHaveBeenCalled();
  });

  it('preflights every row without IdGen or patient writes and requires fresh lookups', async () => {
    const firstRow = buildImportRow({ DNI: '11111111' });
    const secondRow = { ...buildImportRow({ DNI: '22222222' }), id: 'approved-file-hash:3', rowNumber: 3 };

    await expect(
      preflightBulkPatientImportRows([firstRow, secondRow], identifierTypes, 'location-uuid', {
        domicilioTarget: 'address4',
      }),
    ).resolves.toEqual({ reconciledRowIds: new Set() });

    expect(mockSearchLocalIdentityByDocument).toHaveBeenCalledTimes(2);
    expect(mockFetchFreshPatientIdentityByUuid).toHaveBeenCalledTimes(2);
    expect(mockSearchLocalIdentityByDocument).toHaveBeenNthCalledWith(
      1,
      firstRow.normalized.dni,
      undefined,
      expect.any(Object),
      expect.objectContaining({ requireFreshNetwork: true }),
    );
    expect(mockGenerateIdentifier).not.toHaveBeenCalled();
    expect(mockSavePatient).not.toHaveBeenCalled();
  });

  it('stops preflight on a conflict with only a fixed identifier-free error', async () => {
    const row = buildImportRow();
    mockSearchLocalIdentityByDocument.mockRejectedValue(
      new Error('GET exposed a private synthetic row and internal UUID'),
    );

    const outcome = preflightBulkPatientImportRows([row], identifierTypes, 'location-uuid', {
      domicilioTarget: 'address4',
    });
    await expect(outcome).rejects.toEqual(new Error(bulkPatientImportRowErrorMessage));
    expect(mockGenerateIdentifier).not.toHaveBeenCalled();
    expect(mockSavePatient).not.toHaveBeenCalled();
  });

  it('keeps raw demographics out of the downloaded reconciliation report', async () => {
    const row = buildImportRow();
    row.status = 'reconciled';
    const createObjectUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:synthetic-report');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    await downloadImportReport([row]);

    const reportBlob = createObjectUrl.mock.calls[0][0] as Blob;
    const reportWorkbook = new Workbook();
    await reportWorkbook.xlsx.load(await reportBlob.arrayBuffer());
    const values = JSON.stringify(reportWorkbook.worksheets[0].getSheetValues());
    expect(values).toContain(row.patientUuid);
    expect(values).toContain('reconciled');
    expect(values).not.toContain(row.normalized.dni);
    expect(values).not.toContain(row.normalized.givenName);
    expect(values).not.toContain(row.normalized.domicilio);
  });

  it('counts created and reconciled patients separately', () => {
    const createdRow = { ...buildImportRow(), status: 'created' as const };
    const reconciledRow = { ...buildImportRow(), id: 'approved-file-hash:3', status: 'reconciled' as const };
    const skippedRow = { ...buildImportRow(), id: 'approved-file-hash:4', status: 'skipped' as const };

    expect(summarizeImportRows([createdRow, reconciledRow, skippedRow])).toMatchObject({
      created: 1,
      reconciled: 1,
      skipped: 1,
    });
  });
});

describe('bulk patient import workbook manifest', () => {
  it('hashes the exact workbook bytes and assigns deterministic row and patient UUIDs', async () => {
    const file = await buildWorkbookFile();
    const expectedSha256 = createHash('sha256')
      .update(Buffer.from(await file.arrayBuffer()))
      .digest('hex');

    const firstManifest = await parseSantaClotildeWorkbook(file);
    const secondManifest = await parseSantaClotildeWorkbook(file);

    expect(await calculateFileSha256(file)).toBe(expectedSha256);
    expect(firstManifest).toMatchObject({
      schemaVersion: 1,
      fileName: 'patients.xlsx',
      fileSize: file.size,
      fileSha256: expectedSha256,
    });
    expect(firstManifest.rows).toHaveLength(1);
    expect(firstManifest.rows[0]).toMatchObject({
      id: `${expectedSha256}:2`,
      patientUuid: v5(`${expectedSha256}:2:11111111`, patientImportUuidNamespace),
      rowNumber: 2,
      status: 'valid',
    });
    expect(secondManifest.rows[0]?.id).toBe(firstManifest.rows[0]?.id);
    expect(secondManifest.rows[0]?.patientUuid).toBe(firstManifest.rows[0]?.patientUuid);
  });

  it('reads Excel calendar dates through UTC without shifting the day in Peru', async () => {
    const previousTimezone = process.env.TZ;
    process.env.TZ = 'America/Lima';

    try {
      const values: Array<unknown> = rawRowValues();
      values[santaClotildeHeaders.indexOf('F.N.')] = new Date(Date.UTC(1990, 0, 2));
      const file = await buildWorkbookFile({ rows: [values] });

      const manifest = await parseSantaClotildeWorkbook(file);

      expect(manifest.rows[0]?.raw['F.N.']).toBe('02/01/1990');
      expect(manifest.rows[0]?.normalized.birthdate).toBe('1990-01-02');
    } finally {
      if (previousTimezone === undefined) {
        delete process.env.TZ;
      } else {
        process.env.TZ = previousTimezone;
      }
    }
  });

  it('rejects duplicate logical headers even when one uses an alias', async () => {
    const file = await buildWorkbookFile({
      headers: [...santaClotildeHeaders, 'FECHA NACIMIENTO'],
      rows: [[...rawRowValues(), '01/01/1990']],
    });

    await expect(parseSantaClotildeWorkbook(file)).rejects.toThrow('Duplicate logical columns: F.N.');
  });

  it('rejects a hidden row that contains patient data', async () => {
    const file = await buildWorkbookFile({
      updateWorksheet: (worksheet) => {
        worksheet.getRow(2).hidden = true;
      },
    });

    await expect(parseSantaClotildeWorkbook(file)).rejects.toThrow('Row 2 is hidden and contains data.');
  });

  it('rejects a hidden row with data only in an extra column', async () => {
    const file = await buildWorkbookFile({
      rows: [],
      updateWorksheet: (worksheet) => {
        worksheet.getCell('J2').value = 'SYNTHETIC HIDDEN VALUE';
        worksheet.getRow(2).hidden = true;
      },
    });

    await expect(parseSantaClotildeWorkbook(file)).rejects.toThrow('Row 2 is hidden and contains data.');
  });

  it('rejects a hidden patient worksheet even when another worksheet is visible', async () => {
    const workbook = new Workbook();
    const patientWorksheet = workbook.addWorksheet('Patients');
    patientWorksheet.addRow(santaClotildeHeaders);
    patientWorksheet.addRow(rawRowValues());
    workbook.addWorksheet('Visible instructions');
    patientWorksheet.state = 'veryHidden';
    const buffer = await workbook.xlsx.writeBuffer();
    const file = new File([buffer as BlobPart], 'patients.xlsx', { type: excelContentType });

    await expect(parseSantaClotildeWorkbook(file)).rejects.toThrow('The patient worksheet must be visible.');
  });

  it('allows exactly 250 non-empty rows regardless of blank formatted rows', async () => {
    const rows = Array.from({ length: 250 }, (_, index) =>
      rawRowValues({
        DNI: String(10000001 + index),
        NOMBRES: `PACIENTE ${alphabeticSuffix(index)}`,
        ORDEN: String(index + 1),
      }),
    );
    const file = await buildWorkbookFile({
      rows,
      updateWorksheet: (worksheet) => {
        worksheet.getRow(1000).height = 20;
      },
    });

    const manifest = await parseSantaClotildeWorkbook(file);

    expect(manifest.rows).toHaveLength(250);
    expect(manifest.rows.every((row) => row.status === 'valid')).toBe(true);
  });

  it('rejects the 251st non-empty row', async () => {
    const rows = Array.from({ length: 251 }, (_, index) =>
      rawRowValues({
        DNI: String(10000001 + index),
        NOMBRES: `PACIENTE ${alphabeticSuffix(index)}`,
        ORDEN: String(index + 1),
      }),
    );
    const file = await buildWorkbookFile({ rows });

    await expect(parseSantaClotildeWorkbook(file)).rejects.toThrow(
      'The template allows a maximum of 250 non-empty rows per file.',
    );
  });

  it('treats matching demographics with different DNIs as blocking errors', async () => {
    const file = await buildWorkbookFile({
      rows: [rawRowValues({ DNI: '11111111' }), rawRowValues({ DNI: '22222222', ORDEN: '2' })],
    });

    const manifest = await parseSantaClotildeWorkbook(file);

    expect(manifest.rows).toHaveLength(2);
    for (const row of manifest.rows) {
      expect(row.status).toBe('error');
      expect(row.errors).toContain('Duplicate patient within the file: same name, birthdate, and sex.');
    }
  });

  it('rejects empty inputs, header-only workbooks, and oversized files', async () => {
    await expect(parseSantaClotildeWorkbook(new File([], 'patients.xlsx', { type: excelContentType }))).rejects.toThrow(
      'The file is empty.',
    );

    const headerOnlyFile = await buildWorkbookFile({ rows: [] });
    await expect(parseSantaClotildeWorkbook(headerOnlyFile)).rejects.toThrow(
      'The file does not contain any patient rows.',
    );

    const { maxFileSizeBytes } = getImportLimits();
    const oversizedFile = new File([new Uint8Array(maxFileSizeBytes + 1)], 'patients.xlsx', {
      type: excelContentType,
    });
    await expect(parseSantaClotildeWorkbook(oversizedFile)).rejects.toThrow(
      'The file exceeds the maximum size allowed.',
    );
  });
});

describe('bulk patient import birthdates', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 13, 12));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ['13/07/1886', '1886-07-13'],
    ['29/02/2024', '2024-02-29'],
  ])('normalizes valid birthdate %s', (input, expected) => {
    expect(normalizeDate(input)).toBe(expected);
  });

  it.each(['12/07/1886', '14/07/2026', '31/04/2020', '01/01/100000'])('rejects invalid birthdate %s', (input) => {
    expect(normalizeDate(input)).toBe('');
  });
});
