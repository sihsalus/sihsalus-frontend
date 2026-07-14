import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { searchLocalIdentityByDocument } from '../patient-registration/identity/identity-search.resource';
import { savePatient } from '../patient-registration/patient-registration.resource';
import { peruDniPatientIdentifierTypeUuid } from '../patient-registration/peru-registration-config';
import type { PatientIdentifierType } from '../patient-registration/patient-registration.types';
import type { SantaClotildeHeader } from './bulk-patient-import.types';
import { createPatientFromImportRow, normalizeAndValidateImportRow, normalizeDate } from './bulk-patient-import.utils';

vi.mock('../patient-registration/identity/identity-search.resource', () => ({
  searchLocalIdentityByDocument: vi.fn(),
}));

vi.mock('../patient-registration/patient-registration.resource', async () => ({
  ...(await vi.importActual('../patient-registration/patient-registration.resource')),
  generateIdentifier: vi.fn(),
  savePatient: vi.fn(),
}));

const mockSearchLocalIdentityByDocument = vi.mocked(searchLocalIdentityByDocument);
const mockSavePatient = vi.mocked(savePatient);
const identifierTypes = [
  {
    fieldName: 'dni',
    isPrimary: true,
    name: 'DNI',
    required: true,
    uuid: peruDniPatientIdentifierTypeUuid,
  },
] as Array<PatientIdentifierType>;

function buildRawRow(overrides: Partial<Record<SantaClotildeHeader, string>> = {}) {
  return {
    ORDEN: '1',
    DNI: '12345678',
    SEXO: 'F',
    'F.N.': '01/01/1990',
    'A.PATERNO': 'QUISPE',
    'A.MATERNO': 'ROJAS',
    NOMBRES: 'ANA MARIA',
    PARENTESCO: '',
    DOMICILIO: 'JR PRINCIPAL 123',
    ...overrides,
  } as Record<SantaClotildeHeader, string>;
}

describe('bulk patient import safety checks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchLocalIdentityByDocument.mockResolvedValue([]);
    mockSavePatient.mockResolvedValue({ data: { uuid: 'created-patient-uuid' }, ok: true } as never);
  });

  it('accepts a valid adult row', () => {
    const row = normalizeAndValidateImportRow(buildRawRow(), 2);

    expect(row.errors).toEqual([]);
    expect(row.normalized).toMatchObject({
      birthdate: '1990-01-01',
      familyName: 'QUISPE',
      givenName: 'ANA',
      middleName: 'MARIA',
    });
  });

  it('accepts a one-letter optional middle name like the manual form', () => {
    const row = normalizeAndValidateImportRow(buildRawRow({ NOMBRES: 'ANA M' }), 2);

    expect(row.errors).toEqual([]);
    expect(row.normalized.middleName).toBe('M');
  });

  it('rejects invalid name characters and minors that require a responsible person', () => {
    const row = normalizeAndValidateImportRow(buildRawRow({ NOMBRES: 'ANA@', 'F.N.': '01/01/2015' }), 2);

    expect(row.errors).toEqual(
      expect.arrayContaining([
        'NOMBRES contains invalid characters.',
        'Los pacientes menores de edad deben registrarse manualmente junto con su responsable.',
      ]),
    );
  });

  it('checks OpenMRS for an existing document before creating the patient', async () => {
    const row = normalizeAndValidateImportRow(buildRawRow(), 2);
    mockSearchLocalIdentityByDocument.mockResolvedValue([
      {
        kind: 'patient',
        uuid: 'existing-patient-uuid',
        display: 'Ana Quispe',
        identifier: '12345678',
        identifierTypeUuid: peruDniPatientIdentifierTypeUuid,
      },
    ]);

    await expect(createPatientFromImportRow(row, identifierTypes, 'location-uuid')).rejects.toThrow(
      'Ya existe un paciente con DNI 12345678',
    );
    expect(mockSavePatient).not.toHaveBeenCalled();
  });

  it('reuses the row UUID when a previous request succeeded but its response was lost', async () => {
    const row = normalizeAndValidateImportRow(buildRawRow(), 2);
    row.patientUuid = 'same-import-attempt-uuid';
    mockSearchLocalIdentityByDocument.mockResolvedValue([
      {
        kind: 'patient',
        uuid: 'same-import-attempt-uuid',
        display: 'Ana Quispe',
        identifier: '12345678',
        identifierTypeUuid: peruDniPatientIdentifierTypeUuid,
      },
    ]);

    await expect(createPatientFromImportRow(row, identifierTypes, 'location-uuid')).resolves.toBe(
      'same-import-attempt-uuid',
    );
    expect(mockSavePatient).not.toHaveBeenCalled();
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
