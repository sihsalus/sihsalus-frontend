import { getLocalCalendarDate, validatePatientBirthdate } from '@openmrs/esm-utils';
import type { Row, Workbook } from 'exceljs';
import { v5 } from 'uuid';
import { getIdentifierLocationPayload } from '../patient-registration/identifier-location-behavior';
import { documentTypeConceptUuids } from '../patient-registration/identity/identity-documents';
import {
  type FreshPatientIdentity,
  fetchFreshPatientIdentityByUuid,
  searchLocalIdentityByDocument,
} from '../patient-registration/identity/identity-search.resource';
import {
  patientFamilyNameMaxLength,
  patientGivenNameMaxLength,
  patientNamePattern,
} from '../patient-registration/patient-name-limits';
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
  type PatientImportManifest,
  type PatientImportRowResult,
  type SantaClotildeHeader,
  santaClotildeHeaders,
} from './bulk-patient-import.types';

const maxRows = 250;
const maxFileSizeBytes = 5 * 1024 * 1024;
const dangerousSpreadsheetFormulaStart = /^[=+\-@\t\r]/;
// This namespace is part of the import manifest contract. Do not change it:
// the same exact workbook row must keep the same patient UUID across retries.
const patientImportUuidNamespace = 'a56257d4-7d7b-4f6b-946e-c28fc970c916';
export const bulkPatientImportRowErrorMessage = 'The patient row could not be safely imported.';

export interface BulkPatientImportRowOptions {
  domicilioTarget: 'address4' | 'cityVillage';
  signal?: AbortSignal;
  assertBeforeWrite: () => Promise<void>;
}

export interface BulkPatientImportPreflightResult {
  reconciledRowIds: Set<string>;
}

export interface BulkPatientImportPreflightOptions {
  domicilioTarget: BulkPatientImportRowOptions['domicilioTarget'];
  signal?: AbortSignal;
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

  const exampleSheet = workbook.addWorksheet('Synthetic example');
  exampleSheet.columns = santaClotildeHeaders.map((header) => ({
    header,
    key: header,
    width: header === 'DOMICILIO' ? 32 : 18,
  }));
  exampleSheet.getRow(1).font = { bold: true };
  exampleSheet.addRow({
    ORDEN: 'EJEMPLO-NO-IMPORTAR',
    DNI: '00000000',
    SEXO: 'M',
    'F.N.': '01/01/1990',
    'A.PATERNO': 'SINTETICO',
    'A.MATERNO': 'PRUEBA',
    NOMBRES: 'PACIENTE FICTICIO',
    PARENTESCO: 'NO IMPORTAR',
    DOMICILIO: 'DATO SINTETICO',
  });

  await downloadWorkbook(workbook, 'santa-clotilde-patient-import-template.xlsx');
}

export async function downloadImportReport(rows: Array<ParsedPatientImportRow>) {
  const workbook = await createWorkbook();
  const worksheet = workbook.addWorksheet('Protected report');
  // Do not duplicate the source workbook's names, DNI, birthdates, or address.
  // The row number joins this reconciliation report back to the separately
  // controlled approved workbook when an authorized operator needs it.
  const reportHeaders = ['ROW', 'STATUS', 'PATIENT UUID', 'ERRORS', 'WARNINGS', 'MESSAGE'];

  worksheet.columns = reportHeaders.map((header) => ({
    header,
    key: header,
    width: header === 'ERRORS' || header === 'WARNINGS' || header === 'MESSAGE' ? 42 : 18,
  }));
  worksheet.getRow(1).font = { bold: true };

  rows.forEach((row) => {
    worksheet.addRow({
      ROW: row.rowNumber,
      STATUS: row.status,
      'PATIENT UUID': row.patientUuid ?? '',
      ERRORS: sanitizeSpreadsheetText(row.errors.join(' | ')),
      WARNINGS: sanitizeSpreadsheetText(row.warnings.join(' | ')),
      MESSAGE: sanitizeSpreadsheetText(row.importMessage ?? ''),
    });
  });

  await downloadWorkbook(workbook, 'patient-import-report.xlsx');
}

export async function calculateFileSha256(file: File): Promise<string> {
  return calculateSha256(await file.arrayBuffer());
}

export async function parseSantaClotildeWorkbook(file: File): Promise<PatientImportManifest> {
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    throw new Error('Only .xlsx Excel files are supported.');
  }

  if (!file.size) {
    throw new Error('The file is empty.');
  }

  if (file.size > maxFileSizeBytes) {
    throw new Error('The file exceeds the maximum size allowed.');
  }

  const fileBytes = await file.arrayBuffer();
  const fileSha256 = await calculateSha256(fileBytes);
  const workbook = await createWorkbook();
  await workbook.xlsx.load(fileBytes);
  const worksheet = workbook.worksheets[0];

  if (!worksheet) {
    throw new Error('The file does not contain any worksheets.');
  }
  if (worksheet.state !== 'visible') {
    throw new Error('The patient worksheet must be visible.');
  }

  const headerRow = worksheet.getRow(1);
  if (headerRow.hidden) {
    throw new Error('The header row cannot be hidden.');
  }

  const headerMap = readHeaderMap(headerRow);
  const missingHeaders = santaClotildeHeaders.filter((header) => !headerMap[header]);

  if (missingHeaders.length) {
    throw new Error(`Missing required columns: ${missingHeaders.join(', ')}.`);
  }

  const hiddenHeaders = santaClotildeHeaders.filter((header) => worksheet.getColumn(headerMap[header]).hidden);
  if (hiddenHeaders.length) {
    throw new Error(`Required columns cannot be hidden: ${hiddenHeaders.join(', ')}.`);
  }

  const rows: Array<ParsedPatientImportRow> = [];
  const duplicateDniRows = new Map<string, Array<number>>();
  const duplicateDemographicRows = new Map<string, Array<number>>();

  worksheet.eachRow((excelRow, rowNumber) => {
    if (rowNumber === 1) {
      return;
    }

    if (excelRow.hidden && rowContainsAnyValue(excelRow)) {
      throw new Error(`Row ${rowNumber} is hidden and contains data.`);
    }

    const raw = Object.fromEntries(
      santaClotildeHeaders.map((header) => [header, getCellText(excelRow.getCell(headerMap[header]))]),
    ) as Record<SantaClotildeHeader, string>;

    if (Object.values(raw).every((value) => !value.trim())) {
      return;
    }

    if (rows.length >= maxRows) {
      throw new Error(`The template allows a maximum of ${maxRows} non-empty rows per file.`);
    }

    const row = normalizeAndValidateImportRow(raw, rowNumber);
    row.id = `${fileSha256}:${rowNumber}`;
    row.patientUuid = v5(`${fileSha256}:${rowNumber}:${row.normalized.dni}`, patientImportUuidNamespace);
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

  if (!rows.length) {
    throw new Error('The file does not contain any patient rows.');
  }

  applyDuplicateMessages(rows, duplicateDniRows, 'Duplicate DNI within the file.', 'error');
  applyDuplicateMessages(
    rows,
    duplicateDemographicRows,
    'Duplicate patient within the file: same name, birthdate, and sex.',
    'error',
  );

  return {
    schemaVersion: 1,
    fileName: file.name,
    fileSize: file.size,
    fileSha256,
    rows: rows.map((row) => ({
      ...row,
      status: row.errors.length ? 'error' : row.warnings.length ? 'warning' : 'valid',
    })),
  };
}

export async function createPatientFromImportRow(
  row: ParsedPatientImportRow,
  identifierTypes: Array<PatientIdentifierType>,
  locationUuid: string,
  options: BulkPatientImportRowOptions,
): Promise<PatientImportRowResult> {
  try {
    const operationSignal = withRequestTimeout(options.signal, 30_000);
    assertImportableRow(row);
    const patientUuid = requireDeterministicPatientUuid(row);
    const identifierPlans = validateBulkPatientImportMetadata(identifierTypes, locationUuid);
    const existingState = await inspectExistingPatient(
      row,
      options.domicilioTarget,
      identifierPlans,
      'before-create',
      undefined,
      operationSignal,
    );

    if (existingState === 'reconciled') {
      return { patientUuid, outcome: 'reconciled' };
    }

    const identifiers = await buildPatientIdentifiers(row, identifierPlans, options.assertBeforeWrite, operationSignal);
    const patient = buildPatientPayload(row, identifiers, patientUuid, options.domicilioTarget);

    let responseUuid: string | undefined;
    await options.assertBeforeWrite();
    try {
      const response = await savePatient(patient, undefined, operationSignal);
      if (!response.ok) {
        throw new Error(bulkPatientImportRowErrorMessage);
      }
      responseUuid = response.data?.uuid;
    } catch {
      // A lost POST response is ambiguous. Reconcile the deterministic UUID/DNI
      // from a new network request before deciding whether it actually failed.
      if (
        (await inspectExistingPatient(row, options.domicilioTarget, identifierPlans, 'after-create', identifiers)) ===
        'reconciled'
      ) {
        return { patientUuid, outcome: 'reconciled' };
      }
      throw new Error(bulkPatientImportRowErrorMessage);
    }

    if (responseUuid !== patientUuid) {
      throw new Error(bulkPatientImportRowErrorMessage);
    }

    if (
      (await inspectExistingPatient(
        row,
        options.domicilioTarget,
        identifierPlans,
        'after-create',
        identifiers,
        operationSignal,
      )) !== 'reconciled'
    ) {
      throw new Error(bulkPatientImportRowErrorMessage);
    }
    return { patientUuid, outcome: 'created' };
  } catch {
    throw new Error(bulkPatientImportRowErrorMessage);
  }
}

/**
 * Performs the complete live duplicate/metadata pass before the first IdGen or
 * Patient POST. Any one unsafe row blocks the whole file.
 */
export async function preflightBulkPatientImportRows(
  rows: Array<ParsedPatientImportRow>,
  identifierTypes: Array<PatientIdentifierType>,
  locationUuid: string,
  options: BulkPatientImportPreflightOptions,
): Promise<BulkPatientImportPreflightResult> {
  try {
    const identifierPlans = validateBulkPatientImportMetadata(identifierTypes, locationUuid);
    const reconciledRowIds = new Set<string>();

    for (const row of rows) {
      assertImportableRow(row);
      requireDeterministicPatientUuid(row);
      if (
        (await inspectExistingPatient(
          row,
          options.domicilioTarget,
          identifierPlans,
          'before-create',
          undefined,
          options.signal,
        )) === 'reconciled'
      ) {
        reconciledRowIds.add(row.id);
      }
    }

    return { reconciledRowIds };
  } catch {
    throw new Error(bulkPatientImportRowErrorMessage);
  }
}

export function summarizeImportRows(rows: Array<ParsedPatientImportRow>): ImportSummary {
  return {
    total: rows.length,
    valid: rows.filter((row) => row.status === 'valid').length,
    warnings: rows.filter((row) => row.warnings.length && !row.errors.length).length,
    errors: rows.filter((row) => row.errors.length).length,
    created: rows.filter((row) => row.status === 'created').length,
    reconciled: rows.filter((row) => row.status === 'reconciled').length,
    failed: rows.filter((row) => row.status === 'failed').length,
    skipped: rows.filter((row) => row.status === 'skipped').length,
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
  const duplicateHeaders = new Set<SantaClotildeHeader>();

  row.eachCell((cell, columnNumber) => {
    const normalizedHeader = normalizeHeader(getCellText(cell));
    const matchingHeader = santaClotildeHeaders.find((header) =>
      headerAliases[header].some((alias) => normalizeHeader(alias) === normalizedHeader),
    );

    if (!matchingHeader) {
      return;
    }

    if (map[matchingHeader]) {
      duplicateHeaders.add(matchingHeader);
    } else {
      map[matchingHeader] = columnNumber;
    }
  });

  if (duplicateHeaders.size) {
    throw new Error(`Duplicate logical columns: ${Array.from(duplicateHeaders).join(', ')}.`);
  }

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
  } else if (normalized.orden.length > 100) {
    errors.push('ORDEN exceeds the maximum length of 100 characters.');
  }

  if (!/^\d{8}$/.test(dni)) {
    errors.push('DNI must have exactly 8 digits.');
  } else if (dni === '00000000') {
    errors.push('DNI 00000000 is reserved for the synthetic template and cannot be imported.');
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
  } else if (normalized.domicilio.length > 255) {
    errors.push('DOMICILIO exceeds the maximum length of 255 characters.');
  }

  if (raw.PARENTESCO.trim()) {
    warnings.push('PARENTESCO is not saved; retain it only in the separately controlled approved workbook.');
    if (normalized.parentesco.length > 100) {
      errors.push('PARENTESCO exceeds the maximum length of 100 characters.');
    }
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

interface IdentifierPlan {
  identifierType: PatientIdentifierType;
  locationPayload: Pick<PatientIdentifier, 'location'>;
  sourceUuid?: string;
}

export function validateBulkPatientImportMetadata(
  identifierTypes: Array<PatientIdentifierType>,
  locationUuid: string,
): Array<IdentifierPlan> {
  try {
    const dniType = identifierTypes.find((type) => type.uuid === peruDniPatientIdentifierTypeUuid);
    if (!dniType || dniType.uniquenessBehavior !== 'UNIQUE') {
      throw new Error(bulkPatientImportRowErrorMessage);
    }

    const generatedTypes = identifierTypes
      .filter((type) => type.uuid !== peruDniPatientIdentifierTypeUuid)
      .filter((type) => type.isPrimary || type.required)
      .sort((left, right) => Number(right.isPrimary) - Number(left.isPrimary) || left.uuid.localeCompare(right.uuid));
    if ([...generatedTypes, dniType].filter((identifierType) => identifierType.isPrimary).length !== 1) {
      throw new Error(bulkPatientImportRowErrorMessage);
    }
    const plans = generatedTypes.map((identifierType) => {
      const source = identifierType.identifierSources?.find(
        (candidate) => candidate.autoGenerationOption?.automaticGenerationEnabled,
      );
      if (!source) {
        throw new Error(bulkPatientImportRowErrorMessage);
      }
      return {
        identifierType,
        locationPayload: getIdentifierLocationPayload(identifierType.uuid, identifierTypes, locationUuid),
        sourceUuid: source.uuid,
      };
    });

    return [
      ...plans,
      {
        identifierType: dniType,
        locationPayload: getIdentifierLocationPayload(dniType.uuid, identifierTypes, locationUuid),
      },
    ];
  } catch {
    throw new Error(bulkPatientImportRowErrorMessage);
  }
}

async function buildPatientIdentifiers(
  row: ParsedPatientImportRow,
  plans: Array<IdentifierPlan>,
  assertBeforeWrite: () => Promise<void>,
  signal?: AbortSignal,
): Promise<Array<PatientIdentifier>> {
  const identifiers: Array<PatientIdentifier> = [];

  for (const plan of plans) {
    if (plan.identifierType.uuid === peruDniPatientIdentifierTypeUuid) {
      identifiers.push({
        identifier: row.normalized.dni,
        identifierType: plan.identifierType.uuid,
        ...plan.locationPayload,
        preferred: Boolean(plan.identifierType.isPrimary),
      });
      continue;
    }

    if (!plan.sourceUuid) {
      throw new Error(bulkPatientImportRowErrorMessage);
    }
    await assertBeforeWrite();
    const generated = await generateIdentifier(plan.sourceUuid, signal);
    if (!generated.ok || typeof generated.data?.identifier !== 'string' || !generated.data.identifier.trim()) {
      throw new Error(bulkPatientImportRowErrorMessage);
    }
    identifiers.push({
      identifier: generated.data.identifier,
      identifierType: plan.identifierType.uuid,
      ...plan.locationPayload,
      preferred: plan.identifierType.isPrimary,
    });
  }

  return identifiers;
}

function buildPatientPayload(
  row: ParsedPatientImportRow,
  identifiers: Array<PatientIdentifier>,
  patientUuid: string,
  domicilioTarget: BulkPatientImportRowOptions['domicilioTarget'],
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
              [domicilioTarget]: row.normalized.domicilio,
              preferred: true,
            },
          ]
        : [],
      dead: false,
    },
  } as Patient;
}

function assertImportableRow(row: ParsedPatientImportRow) {
  if (row.errors.length || !row.normalized.dni || !row.normalized.birthdate || !row.normalized.gender) {
    throw new Error(bulkPatientImportRowErrorMessage);
  }
}

function requireDeterministicPatientUuid(row: ParsedPatientImportRow): string {
  if (
    !row.patientUuid ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-5[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(row.patientUuid)
  ) {
    throw new Error(bulkPatientImportRowErrorMessage);
  }
  return row.patientUuid;
}

async function inspectExistingPatient(
  row: ParsedPatientImportRow,
  domicilioTarget: BulkPatientImportRowOptions['domicilioTarget'],
  identifierPlans: Array<IdentifierPlan>,
  phase: 'before-create' | 'after-create',
  expectedIdentifiers?: Array<PatientIdentifier>,
  signal?: AbortSignal,
): Promise<'ready' | 'reconciled'> {
  const requestSignal = withRequestTimeout(signal, 15_000);
  const [matches, patient] = await Promise.all([
    searchLocalIdentityByDocument(
      row.normalized.dni,
      undefined,
      {
        patientIdentifierTypeUuid: peruDniPatientIdentifierTypeUuid,
        personDocumentTypeConceptUuid: documentTypeConceptUuids.dni,
      },
      { requireFreshNetwork: true, signal: requestSignal },
    ),
    fetchFreshPatientIdentityByUuid(requireDeterministicPatientUuid(row), requestSignal),
  ]);

  if (phase === 'before-create' && matches.length === 0 && patient === null) {
    return 'ready';
  }

  if (
    matches.length === 1 &&
    matches[0].kind === 'patient' &&
    matches[0].uuid === row.patientUuid &&
    matches[0].identifier === row.normalized.dni &&
    matches[0].identifierTypeUuid === peruDniPatientIdentifierTypeUuid &&
    patient !== null &&
    isExactImportedPatient(row, patient, domicilioTarget, identifierPlans, expectedIdentifiers)
  ) {
    return 'reconciled';
  }

  throw new Error(bulkPatientImportRowErrorMessage);
}

function isExactImportedPatient(
  row: ParsedPatientImportRow,
  patient: FreshPatientIdentity,
  domicilioTarget: BulkPatientImportRowOptions['domicilioTarget'],
  identifierPlans: Array<IdentifierPlan>,
  expectedIdentifiers?: Array<PatientIdentifier>,
) {
  const person = patient.person;
  if (
    patient.voided ||
    patient.uuid !== row.patientUuid ||
    !person ||
    person.voided ||
    person.uuid !== row.patientUuid ||
    person.gender !== row.normalized.gender ||
    person.birthdateEstimated !== false ||
    person.dead !== false ||
    (person.attributes ?? []).some((attribute) => !attribute.voided) ||
    getResponseCalendarDate(person.birthdate) !== row.normalized.birthdate
  ) {
    return false;
  }

  const activeIdentifiers = (patient.identifiers ?? []).filter((identifier) => !identifier.voided);
  if (activeIdentifiers.length !== identifierPlans.length) {
    return false;
  }

  for (const plan of identifierPlans) {
    const matchingIdentifiers = activeIdentifiers.filter(
      (identifier) => identifier.identifierType?.uuid === plan.identifierType.uuid,
    );
    const identifier = matchingIdentifiers[0];
    const expectedIdentifier = expectedIdentifiers?.find(
      (candidate) => candidate.identifierType === plan.identifierType.uuid,
    );
    const expectedLocation = plan.locationPayload.location;

    if (
      matchingIdentifiers.length !== 1 ||
      !identifier?.identifier?.trim() ||
      identifier.preferred !== Boolean(plan.identifierType.isPrimary) ||
      getResponseIdentifierLocation(identifier.location) !== (expectedLocation ?? '') ||
      (plan.identifierType.uuid === peruDniPatientIdentifierTypeUuid && identifier.identifier !== row.normalized.dni) ||
      (expectedIdentifier && identifier.identifier !== expectedIdentifier.identifier)
    ) {
      return false;
    }
  }

  const activeNames = (person.names ?? []).filter((name) => !name.voided);
  if (
    activeNames.length !== 1 ||
    !activeNames[0].preferred ||
    (activeNames[0].givenName ?? '') !== row.normalized.givenName ||
    (activeNames[0].middleName ?? '') !== row.normalized.middleName ||
    (activeNames[0].familyName ?? '') !== row.normalized.familyName ||
    (activeNames[0].familyName2 ?? '') !== row.normalized.familyName2
  ) {
    return false;
  }

  const activeAddresses = (person.addresses ?? []).filter((address) => !address.voided);
  if (!row.normalized.domicilio) {
    return activeAddresses.length === 0;
  }

  return (
    activeAddresses.length === 1 &&
    activeAddresses[0].preferred === true &&
    (activeAddresses[0][domicilioTarget] ?? '') === row.normalized.domicilio
  );
}

function getResponseIdentifierLocation(value: NonNullable<FreshPatientIdentity['identifiers']>[number]['location']) {
  if (typeof value === 'string') {
    return value;
  }
  return value?.uuid ?? '';
}

function getResponseCalendarDate(value?: string) {
  return /^(\d{4}-\d{2}-\d{2})(?:T.*)?$/.exec(value ?? '')?.[1] ?? '';
}

function rowContainsAnyValue(row: Row) {
  let containsValue = false;
  row.eachCell({ includeEmpty: false }, (cell) => {
    if (cell.value !== null && cell.value !== undefined && String(cell.value).trim() !== '') {
      containsValue = true;
    }
  });
  return containsValue;
}

function withRequestTimeout(signal: AbortSignal | undefined, milliseconds: number) {
  const timeoutSignal = AbortSignal.timeout(milliseconds);
  return signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
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
    throw new Error(`Cell ${cell.address} contains a formula. The file only supports values.`);
  }

  if (value instanceof Date) {
    return `${String(value.getUTCDate()).padStart(2, '0')}/${String(value.getUTCMonth() + 1).padStart(2, '0')}/${value.getUTCFullYear()}`;
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

async function calculateSha256(bytes: ArrayBuffer): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
