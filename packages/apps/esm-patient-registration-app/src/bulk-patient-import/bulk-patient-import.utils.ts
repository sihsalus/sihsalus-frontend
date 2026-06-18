import type { Workbook } from 'exceljs';
import { v4 } from 'uuid';

import { generateIdentifier, savePatient } from '../patient-registration/patient-registration.resource';
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
  const worksheet = workbook.addWorksheet('Pacientes');

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

  const exampleSheet = workbook.addWorksheet('Ejemplo');
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

  await downloadWorkbook(workbook, 'plantilla-importacion-pacientes-santa-clotilde.xlsx');
}

export async function downloadImportReport(rows: Array<ParsedPatientImportRow>) {
  const workbook = await createWorkbook();
  const worksheet = workbook.addWorksheet('Reporte');
  const reportHeaders = [
    'FILA',
    ...santaClotildeHeaders,
    'ESTADO',
    'UUID PACIENTE',
    'ERRORES',
    'ADVERTENCIAS',
    'MENSAJE',
  ];

  worksheet.columns = reportHeaders.map((header) => ({
    header,
    key: header,
    width: header === 'ERRORES' || header === 'ADVERTENCIAS' || header === 'MENSAJE' ? 42 : 18,
  }));
  worksheet.getRow(1).font = { bold: true };

  rows.forEach((row) => {
    worksheet.addRow({
      FILA: row.rowNumber,
      ...Object.fromEntries(santaClotildeHeaders.map((header) => [header, sanitizeSpreadsheetText(row.raw[header])])),
      ESTADO: row.status,
      'UUID PACIENTE': row.patientUuid ?? '',
      ERRORES: sanitizeSpreadsheetText(row.errors.join(' | ')),
      ADVERTENCIAS: sanitizeSpreadsheetText(row.warnings.join(' | ')),
      MENSAJE: sanitizeSpreadsheetText(row.importMessage ?? ''),
    });
  });

  await downloadWorkbook(workbook, 'reporte-importacion-pacientes.xlsx');
}

export async function parseSantaClotildeWorkbook(file: File): Promise<Array<ParsedPatientImportRow>> {
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    throw new Error('Solo se admite archivo Excel .xlsx para este PoC.');
  }

  if (file.size > maxFileSizeBytes) {
    throw new Error('El archivo supera el tamaño máximo permitido para el PoC.');
  }

  const workbook = await createWorkbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const worksheet = workbook.worksheets[0];

  if (!worksheet) {
    throw new Error('El archivo no contiene hojas.');
  }

  const headerMap = readHeaderMap(worksheet.getRow(1));
  const missingHeaders = santaClotildeHeaders.filter((header) => !headerMap[header]);

  if (missingHeaders.length) {
    throw new Error(`Faltan columnas requeridas: ${missingHeaders.join(', ')}.`);
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

    const row = normalizeAndValidateRow(raw, rowNumber);
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
    throw new Error(`El PoC permite como máximo ${maxRows} filas por archivo.`);
  }

  applyDuplicateMessages(rows, duplicateDniRows, 'DNI duplicado dentro del archivo.', 'error');
  applyDuplicateMessages(
    rows,
    duplicateDemographicRows,
    'Posible paciente duplicado dentro del archivo: mismo nombre, fecha de nacimiento y sexo.',
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
  const identifiers = await buildPatientIdentifiers(row, identifierTypes, locationUuid);
  const patient = buildPatientPayload(row, identifiers);
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

function normalizeAndValidateRow(raw: Record<SantaClotildeHeader, string>, rowNumber: number): ParsedPatientImportRow {
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
    warnings.push('ORDEN esta vacio.');
  }

  if (!/^\d{8}$/.test(dni)) {
    errors.push('DNI debe tener exactamente 8 digitos.');
  }

  if (!gender) {
    errors.push('SEXO debe ser M, F, O o D.');
  }

  if (!birthdate) {
    errors.push('F.N. debe tener formato DD/MM/AAAA y ser una fecha valida.');
  }

  if (!normalized.familyName) {
    errors.push('A.PATERNO es requerido.');
  }

  if (!normalized.familyName2) {
    errors.push('A.MATERNO es requerido.');
  }

  if (!normalized.givenName) {
    errors.push('NOMBRES es requerido.');
  }

  if (!normalized.domicilio) {
    warnings.push('DOMICILIO esta vacio.');
  }

  if (raw.PARENTESCO.trim()) {
    warnings.push('PARENTESCO se conserva solo en el reporte del PoC; no se guarda en el paciente.');
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
      throw new Error(`No hay fuente de generacion configurada para ${identifierType.name}.`);
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

function buildPatientPayload(row: ParsedPatientImportRow, identifiers: Array<PatientIdentifier>): Patient {
  const patientUuid = v4();

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

function normalizeDate(value: string) {
  const trimmed = value.trim();
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);

  if (!match) {
    return '';
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  const today = new Date();

  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return '';
  }

  if (date > today) {
    return '';
  }

  if (today.getUTCFullYear() - year > 140) {
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
    throw new Error(`La celda ${cell.address} contiene una formula. El PoC solo admite valores.`);
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
