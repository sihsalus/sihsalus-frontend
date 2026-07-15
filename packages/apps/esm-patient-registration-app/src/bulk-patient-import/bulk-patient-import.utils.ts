import { getUserFacingErrorMessage } from '@openmrs/esm-framework';
import { getLocalCalendarDate, validatePatientBirthdate } from '@openmrs/esm-utils';
import type { Workbook } from 'exceljs';
import { v4 } from 'uuid';

import { generateIdentifier, savePatient } from '../patient-registration/patient-registration.resource';
import { searchLocalIdentityByDocument } from '../patient-registration/identity/identity-search.resource';
import { documentTypeConceptUuids } from '../patient-registration/identity/identity-documents';
import {
  patientFamilyNameMaxLength,
  patientGivenNameMaxLength,
  patientNamePattern,
} from '../patient-registration/patient-name-limits';
import type {
  Patient,
  PatientIdentifier,
  PatientIdentifierType,
} from '../patient-registration/patient-registration.types';
import { peruDniPatientIdentifierTypeUuid } from '../patient-registration/peru-registration-config';

import {
  type ImportSummary,
  type ParsedPatientImportRow,
  type SantaClotildeHeader,
  santaClotildeHeaders,
} from './bulk-patient-import.types';

const maxRows = 250;
const maxFileSizeBytes = 5 * 1024 * 1024;
const dangerousSpreadsheetFormulaStart = /^[=+\-@\t\r]/;

export class PatientImportUserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PatientImportUserError';
  }
}

export function getImportErrorMessage(
  error: unknown,
  fallback: string,
  logContext: string,
  options: { log?: boolean } = {},
) {
  return error instanceof PatientImportUserError
    ? error.message
    : getUserFacingErrorMessage(error, fallback, { log: options.log, logContext });
}

const headerAliases: Record<SantaClotildeHeader, Array<string>> = {
  ORDEN: ['ORDEN'],
  DNI: ['DNI'],
  SEXO: ['SEXO'],
  'F.N.': ['F.N.', 'FN', 'FECHA DE NACIMIENTO', 'FECHA NACIMIENTO', 'F NACIMIENTO'],
  'A.PATERNO': ['A.PATERNO', 'A. PATERNO', 'APELLIDO PATERNO'],
  'A.MATERNO': ['A.MATERNO', 'A. MATERNO', 'AP-MATERNO', 'APELLIDO MATERNO'],
  NOMBRES: ['NOMBRES', 'NOMBRE'],
  PARENTESCO: ['PARENTESCO'],
  DOMICILIO: ['DOMICILIO', 'DIRECCION', 'DIRECCIÓN'],
};

export function getImportLimits() {
  return {
    maxRows,
    maxFileSizeBytes,
  };
}

export async function downloadSantaClotildeTemplate() {
  const workbook = await createWorkbook();
  const worksheet = workbook.addWorksheet('Patients');

  worksheet.columns = santaClotildeHeaders.map((header) => ({
    header,
    key: header,
    width: header === 'DOMICILIO' ? 32 : 18,
  }));
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).alignment = { vertical: 'middle' };

  worksheet.getColumn('DNI').numFmt = '@';
  worksheet.getColumn('F.N.').numFmt = 'dd/mm/yyyy';
  for (let rowNumber = 2; rowNumber <= maxRows + 1; rowNumber++) {
    worksheet.getCell(`C${rowNumber}`).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: ['"M,F,O,D"'],
    };
  }
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];

  const exampleSheet = workbook.addWorksheet('Example');
  exampleSheet.columns = santaClotildeHeaders.map((header) => ({
    header,
    key: header,
    width: header === 'DOMICILIO' ? 32 : 18,
  }));
  exampleSheet.getRow(1).font = { bold: true };
  exampleSheet.addRow({
    ORDEN: 'V.1.1.1',
    DNI: '44708773',
    SEXO: 'M',
    'F.N.': '12/10/1985',
    'A.PATERNO': 'SANDI',
    'A.MATERNO': 'ROMAÑOL',
    NOMBRES: 'AHIBAR',
    PARENTESCO: 'JEFE',
    DOMICILIO: 'SAN ANTONIO',
  });

  await downloadWorkbook(workbook, 'santa-clotilde-patient-import-template.xlsx');
}

export async function downloadImportReport(rows: Array<ParsedPatientImportRow>) {
  const workbook = await createWorkbook();
  const worksheet = workbook.addWorksheet('Report');
  const reportHeaders = ['ROW', ...santaClotildeHeaders, 'STATUS', 'PATIENT UUID', 'ERRORS', 'WARNINGS', 'MESSAGE'];

  worksheet.columns = reportHeaders.map((header) => ({
    header,
    key: header,
    width: header === 'ERRORS' || header === 'WARNINGS' || header === 'MESSAGE' ? 42 : 18,
  }));
  worksheet.getRow(1).font = { bold: true };

  rows.forEach((row) => {
    worksheet.addRow({
      ROW: row.rowNumber,
      ...Object.fromEntries(santaClotildeHeaders.map((header) => [header, sanitizeSpreadsheetText(row.raw[header])])),
      STATUS: row.status,
      'PATIENT UUID': row.patientUuid ?? '',
      ERRORS: sanitizeSpreadsheetText(row.errors.join(' | ')),
      WARNINGS: sanitizeSpreadsheetText(row.warnings.join(' | ')),
      MESSAGE: sanitizeSpreadsheetText(row.importMessage ?? ''),
    });
  });

  await downloadWorkbook(workbook, 'patient-import-report.xlsx');
}

export async function parseSantaClotildeWorkbook(file: File): Promise<Array<ParsedPatientImportRow>> {
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    throw new PatientImportUserError('Only .xlsx Excel files are supported.');
  }

  if (file.size > maxFileSizeBytes) {
    throw new PatientImportUserError('The file exceeds the maximum size allowed.');
  }

  const workbook = await createWorkbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const worksheet = workbook.worksheets[0];

  if (!worksheet) {
    throw new PatientImportUserError('The file does not contain any worksheets.');
  }

  const headerMap = readHeaderMap(worksheet.getRow(1));
  const missingHeaders = santaClotildeHeaders.filter((header) => !headerMap[header]);

  if (missingHeaders.length) {
    throw new PatientImportUserError(`Missing required columns: ${missingHeaders.join(', ')}.`);
  }

  const rows: Array<ParsedPatientImportRow> = [];
  const duplicateDniRows = new Map<string, Array<number>>();
  const duplicateDemographicRows = new Map<string, Array<number>>();

  worksheet.eachRow((excelRow, rowNumber) => {
    if (rowNumber === 1 || rows.length >= maxRows) {
      return;
    }

    const raw = Object.fromEntries(
      santaClotildeHeaders.map((header) => [header, getCellText(excelRow.getCell(headerMap[header]))]),
    ) as Record<SantaClotildeHeader, string>;

    if (Object.values(raw).every((value) => !value.trim())) {
      return;
    }

    const row = normalizeAndValidateImportRow(raw, rowNumber);
    rows.push(row);

    if (row.normalized.dni) {
      const existing = duplicateDniRows.get(row.normalized.dni) ?? [];
      duplicateDniRows.set(row.normalized.dni, [...existing, rowNumber]);
    }

    const demographicKey = getDemographicDuplicateKey(row);
    if (demographicKey) {
      const existing = duplicateDemographicRows.get(demographicKey) ?? [];
      duplicateDemographicRows.set(demographicKey, [...existing, rowNumber]);
    }
  });

  if (worksheet.actualRowCount - 1 > maxRows) {
    throw new PatientImportUserError(`The template allows a maximum of ${maxRows} rows per file.`);
  }

  applyDuplicateMessages(rows, duplicateDniRows, 'Duplicate DNI within the file.', 'error');
  applyDuplicateMessages(
    rows,
    duplicateDemographicRows,
    'Possible duplicate patient within the file: same name, birthdate, and sex.',
    'warning',
  );

  return rows.map((row) => ({
    ...row,
    status: row.errors.length ? 'error' : row.warnings.length ? 'warning' : 'valid',
  }));
}

export async function createPatientFromImportRow(
  row: ParsedPatientImportRow,
  identifierTypes: Array<PatientIdentifierType>,
  locationUuid: string,
) {
  row.patientUuid ??= v4();
  const existingMatches = await searchLocalIdentityByDocument(row.normalized.dni, undefined, {
    patientIdentifierTypeUuid: peruDniPatientIdentifierTypeUuid,
    personDocumentTypeConceptUuid: documentTypeConceptUuids.dni,
  });
  const existingPatient = existingMatches.find((match) => match.kind === 'patient');
  const existingPerson = existingMatches.find((match) => match.kind === 'person');

  if (existingPatient?.uuid === row.patientUuid) {
    return row.patientUuid;
  }

  if (existingPatient) {
    throw new PatientImportUserError(`Ya existe un paciente con DNI ${row.normalized.dni}.`);
  }

  if (existingPerson) {
    throw new PatientImportUserError(
      `Ya existe una persona con DNI ${row.normalized.dni}. Regístrela mediante el flujo manual para evitar duplicados.`,
    );
  }

  const identifiers = await buildPatientIdentifiers(row, identifierTypes, locationUuid);
  const patient = buildPatientPayload(row, identifiers, row.patientUuid);
  const response = await savePatient(patient);
  return response.data.uuid as string;
}

export function summarizeImportRows(rows: Array<ParsedPatientImportRow>): ImportSummary {
  return {
    total: rows.length,
    valid: rows.filter((row) => row.status === 'valid').length,
    warnings: rows.filter((row) => row.warnings.length && !row.errors.length).length,
    errors: rows.filter((row) => row.errors.length).length,
    created: rows.filter((row) => row.status === 'created').length,
    failed: rows.filter((row) => row.status === 'failed').length,
  };
}

async function createWorkbook(): Promise<Workbook> {
  const { Workbook } = await import('exceljs');
  return new Workbook();
}

async function downloadWorkbook(workbook: Workbook, fileName: string): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  try {
    link.href = url;
    link.download = fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    URL.revokeObjectURL(url);
  }
}

function readHeaderMap(row): Record<SantaClotildeHeader, number> {
  const map = {} as Record<SantaClotildeHeader, number>;

  row.eachCell((cell, columnNumber) => {
    const normalizedHeader = normalizeHeader(getCellText(cell));
    const matchingHeader = santaClotildeHeaders.find((header) =>
      headerAliases[header].some((alias) => normalizeHeader(alias) === normalizedHeader),
    );

    if (matchingHeader && !map[matchingHeader]) {
      map[matchingHeader] = columnNumber;
    }
  });

  return map;
}

export function normalizeAndValidateImportRow(
  raw: Record<SantaClotildeHeader, string>,
  rowNumber: number,
): ParsedPatientImportRow {
  const dni = raw.DNI.trim();
  const gender = normalizeGender(raw.SEXO);
  const birthdate = normalizeDate(raw['F.N.']);
  const nameParts = raw.NOMBRES.trim().split(/\s+/).filter(Boolean);
  const normalized = {
    orden: raw.ORDEN.trim(),
    dni,
    gender,
    birthdate,
    familyName: raw['A.PATERNO'].trim().toUpperCase(),
    familyName2: raw['A.MATERNO'].trim().toUpperCase(),
    givenName: (nameParts[0] ?? '').toUpperCase(),
    middleName: nameParts.slice(1).join(' ').toUpperCase(),
    parentesco: raw.PARENTESCO.trim().toUpperCase(),
    domicilio: raw.DOMICILIO.trim().toUpperCase(),
  };
  const errors: Array<string> = [];
  const warnings: Array<string> = [];

  if (!normalized.orden) {
    warnings.push('ORDEN is empty.');
  }

  if (!/^\d{8}$/.test(dni)) {
    errors.push('DNI must have exactly 8 digits.');
  }

  if (!gender) {
    errors.push('SEXO must be M, F, O, or D.');
  }

  if (!birthdate) {
    errors.push('F.N. must use DD/MM/YYYY format and be a valid date.');
  }

  if (!normalized.familyName) {
    errors.push('A.PATERNO is required.');
  }

  if (!normalized.familyName2) {
    errors.push('A.MATERNO is required.');
  }

  if (!normalized.givenName) {
    errors.push('NOMBRES is required.');
  }

  validateImportedName(normalized.givenName, 'NOMBRES', patientGivenNameMaxLength, errors, true);
  validateImportedName(normalized.middleName, 'NOMBRES', patientGivenNameMaxLength, errors, false);
  validateImportedName(normalized.familyName, 'A.PATERNO', patientFamilyNameMaxLength, errors);
  validateImportedName(normalized.familyName2, 'A.MATERNO', patientFamilyNameMaxLength, errors);

  if (birthdate && isMinorBirthdate(birthdate)) {
    errors.push('Los pacientes menores de edad deben registrarse manualmente junto con su responsable.');
  }

  if (!normalized.domicilio) {
    warnings.push('DOMICILIO is empty.');
  }

  if (raw.PARENTESCO.trim()) {
    warnings.push('PARENTESCO is kept only in the report; it is not saved to the patient record.');
  }

  return {
    id: String(rowNumber),
    rowNumber,
    raw,
    normalized,
    errors,
    warnings,
    status: 'pending',
  };
}

async function buildPatientIdentifiers(
  row: ParsedPatientImportRow,
  identifierTypes: Array<PatientIdentifierType>,
  locationUuid: string,
): Promise<Array<PatientIdentifier>> {
  const identifiers: Array<PatientIdentifier> = [];

  const generatedIdentifierTypes = identifierTypes
    .filter((type) => type.uuid !== peruDniPatientIdentifierTypeUuid)
    .filter((type) => type.isPrimary || type.required)
    .sort((left, right) => Number(right.isPrimary) - Number(left.isPrimary));

  for (const identifierType of generatedIdentifierTypes) {
    const source =
      identifierType.identifierSources?.find((source) => source.autoGenerationOption?.automaticGenerationEnabled) ??
      identifierType.identifierSources?.[0];

    if (!source) {
      throw new PatientImportUserError(`No generation source is configured for ${identifierType.name}.`);
    }

    const generated = await generateIdentifier(source.uuid);
    identifiers.push({
      identifier: generated.data.identifier,
      identifierType: identifierType.uuid,
      location: locationUuid,
      preferred: identifierType.isPrimary,
    });
  }

  identifiers.push({
    identifier: row.normalized.dni,
    identifierType: peruDniPatientIdentifierTypeUuid,
    location: locationUuid,
    preferred: !identifiers.length,
  });

  return identifiers;
}

function buildPatientPayload(
  row: ParsedPatientImportRow,
  identifiers: Array<PatientIdentifier>,
  patientUuid: string,
): Patient {
  return {
    uuid: patientUuid,
    identifiers,
    person: {
      uuid: patientUuid,
      names: [
        {
          preferred: true,
          givenName: row.normalized.givenName,
          middleName: row.normalized.middleName,
          familyName: row.normalized.familyName,
          familyName2: row.normalized.familyName2,
        },
      ],
      gender: row.normalized.gender,
      birthdate: row.normalized.birthdate,
      birthdateEstimated: false,
      attributes: [],
      addresses: row.normalized.domicilio
        ? [
            {
              address1: row.normalized.domicilio,
              preferred: true,
            },
          ]
        : [],
      dead: false,
    },
  } as Patient;
}

function validateImportedName(
  value: string,
  field: string,
  maxLength: number,
  errors: Array<string>,
  requireMinimumLength = true,
) {
  if (!value) {
    return;
  }
  if (requireMinimumLength && value.length < 2) {
    errors.push(`${field} must have at least 2 characters.`);
  }
  if (value.length > maxLength) {
    errors.push(`${field} exceeds the maximum length of ${maxLength} characters.`);
  }
  if (!patientNamePattern.test(value)) {
    errors.push(`${field} contains invalid characters.`);
  }
}

function isMinorBirthdate(birthdate: string) {
  const [year, month, day] = birthdate.split('-').map(Number);
  const today = new Date();
  let age = today.getFullYear() - year;
  if (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)) {
    age -= 1;
  }
  return age < 18;
}

function applyDuplicateMessages(
  rows: Array<ParsedPatientImportRow>,
  duplicates: Map<string, Array<number>>,
  message: string,
  severity: 'error' | 'warning',
) {
  const duplicatedRowNumbers = new Set(
    Array.from(duplicates.values())
      .filter((rowNumbers) => rowNumbers.length > 1)
      .flat(),
  );

  rows
    .filter((row) => duplicatedRowNumbers.has(row.rowNumber))
    .forEach((row) => {
      if (severity === 'error') {
        row.errors.push(message);
      } else {
        row.warnings.push(message);
      }
    });
}

function getDemographicDuplicateKey(row: ParsedPatientImportRow) {
  const { givenName, middleName, familyName, familyName2, birthdate, gender } = row.normalized;
  if (!givenName || !familyName || !familyName2 || !birthdate || !gender) {
    return '';
  }

  return normalizeForDuplicate(`${givenName} ${middleName} ${familyName} ${familyName2} ${birthdate} ${gender}`);
}

export function normalizeDate(value: string) {
  const trimmed = value.trim();
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);

  if (!match) {
    return '';
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (validatePatientBirthdate({ year, month, day }, getLocalCalendarDate()) !== 'valid') {
    return '';
  }

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function normalizeGender(value: string): ParsedPatientImportRow['normalized']['gender'] {
  const normalized = normalizeForDuplicate(value);

  if (['M', 'MASCULINO', 'HOMBRE'].includes(normalized)) {
    return 'M';
  }

  if (['F', 'FEMENINO', 'MUJER'].includes(normalized)) {
    return 'F';
  }

  if (['O', 'OTRO'].includes(normalized)) {
    return 'O';
  }

  if (['D', 'DESCONOCIDO', 'U', 'UNKNOWN'].includes(normalized)) {
    return 'U';
  }

  return '';
}

function getCellText(cell): string {
  const value = cell.value;

  if (value == null) {
    return '';
  }

  if (typeof value === 'object' && 'formula' in value) {
    throw new PatientImportUserError(`Cell ${cell.address} contains a formula. The file only supports values.`);
  }

  if (value instanceof Date) {
    return `${String(value.getDate()).padStart(2, '0')}/${String(value.getMonth() + 1).padStart(2, '0')}/${value.getFullYear()}`;
  }

  if (typeof value === 'object' && 'text' in value) {
    return String(value.text);
  }

  if (typeof value === 'object' && 'richText' in value) {
    return value.richText.map((part) => part.text).join('');
  }

  return String(value).trim();
}

function normalizeHeader(value: string) {
  return normalizeForDuplicate(value).replace(/\s+/g, '');
}

function normalizeForDuplicate(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function sanitizeSpreadsheetText(value: string) {
  if (dangerousSpreadsheetFormulaStart.test(value)) {
    return `'${value}`;
  }

  return value;
}
