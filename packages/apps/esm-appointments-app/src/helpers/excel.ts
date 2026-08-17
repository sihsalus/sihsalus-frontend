import { fetchCurrentPatient, formatDatetime, getConfig } from '@openmrs/esm-framework';
import type { CellValue, Workbook } from 'exceljs';
import type { TFunction } from 'i18next';

import { type ConfigObject } from '../config-schema';
import { moduleName } from '../constants';
import { type Appointment, type Identifier } from '../types';
import { getAppointmentProviderName } from './appointment-provider';
import { getAppointmentKindLabel, getGender } from './functions';
import { formatPatientIdentifiers } from './patient-identifiers';

type UnscheduledAppointment = {
  name: string;
  gender?: string;
  age?: string | number;
  phoneNumber?: string | null;
  identifier?: string | null;
  identifiers?: Array<Identifier>;
};

function getPhoneNumbers(patientInfo?: fhir.Patient | null): string {
  return (
    patientInfo?.telecom
      ?.filter((contact) => !contact.system || contact.system === 'phone')
      .map((contact) => contact.value?.trim())
      .filter((value): value is string => Boolean(value))
      .join(', ') ?? ''
  );
}

export function createAppointmentSpreadsheetRow(
  appointment: Appointment,
  patientInfo: fhir.Patient | null,
  includePhoneNumbers: boolean,
  t: TFunction,
): Record<string, string | number> {
  return {
    [t('patientName', 'Patient name')]: appointment.patient.name,
    [t('gender', 'Gender')]: getGender(appointment.patient.gender ?? '', t),
    [t('age', 'Age')]: appointment.patient.age ?? '',
    [t('patientIdentifiers', 'Patient identifiers')]: formatPatientIdentifiers(
      appointment.patient.identifiers,
      patientInfo?.identifier,
      appointment.patient.identifier,
    ),
    [t('serviceType', 'Service type')]: appointment.service?.name ?? '',
    [t('appointmentType', 'Appointment type')]: getAppointmentKindLabel(appointment.appointmentKind, t),
    [t('responsibleProvider', 'Responsible provider')]:
      getAppointmentProviderName(appointment) ?? t('unassignedProvider', 'No provider assigned'),
    [t('appointmentDateTime', 'Appointment date and time')]: formatDatetime(new Date(appointment.startDateTime)),
    ...(includePhoneNumbers ? { [t('phoneNumber', 'Phone number')]: getPhoneNumbers(patientInfo) } : {}),
  };
}

export function createAppointmentsExportFileName(prefix: string, section: string, date: string): string {
  const normalizedPrefix = prefix.trim();
  const normalizedSection = section.trim();
  const hasPrefix = normalizedSection.toLocaleLowerCase().includes(normalizedPrefix.toLocaleLowerCase());
  const rawName = [hasPrefix ? '' : normalizedPrefix, normalizedSection, date].filter(Boolean).join('_');
  const safeName = rawName
    .split('')
    .map((character) => (character.charCodeAt(0) < 32 ? '-' : character))
    .join('')
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_');

  return `${safeName || 'citas'}.xlsx`;
}

/**
 * Exports the provided appointments as an Excel spreadsheet.
 * @param {Array<Appointment>} appointments - The list of appointments to export.
 * @param {string} [fileName] - The name of the downloaded file
 */
export async function exportAppointmentsToSpreadsheet(
  appointments: Array<Appointment>,
  t: TFunction,
  fileName = `${t('appointmentsExportFilename', 'Appointments')}.xlsx`,
) {
  const config = await getConfig<ConfigObject>(moduleName);
  const includePhoneNumbers = config.includePhoneNumberInExcelSpreadsheet ?? false;

  const appointmentsJSON = await Promise.all(
    appointments.map(async (appointment: Appointment) => {
      const patientInfo = await fetchCurrentPatient(appointment.patient.uuid).catch(() => null);
      return createAppointmentSpreadsheetRow(appointment, patientInfo, includePhoneNumbers, t);
    }),
  );

  await writeSpreadsheet(appointmentsJSON, t('appointmentList', 'Appointment list'), fileName);
}

/**
Exports unscheduled appointments as an Excel spreadsheet.
@param {Array<Object>} unscheduledAppointments - The list of unscheduled appointments to export.
@param {string} fileName - The name of the file to download. Defaults to 'Unscheduled appointments {current date and time}'.
*/
export function exportUnscheduledAppointmentsToSpreadsheet(
  unscheduledAppointments: Array<UnscheduledAppointment>,
  t: TFunction,
  fileName = `${t('unscheduledAppointments', 'Unscheduled appointments')}.xlsx`,
): Promise<void> {
  const appointmentsJSON = unscheduledAppointments?.map((appointment) => ({
    [t('patientName', 'Patient name')]: appointment.name,
    [t('gender', 'Gender')]: getGender(appointment.gender ?? '', t),
    [t('age', 'Age')]: appointment.age ?? '',
    [t('phoneNumber', 'Phone number')]: appointment.phoneNumber ?? '--',
    [t('patientIdentifiers', 'Patient identifiers')]:
      formatPatientIdentifiers(appointment.identifiers, [], appointment.identifier) || '--',
  }));

  return writeSpreadsheet(appointmentsJSON, t('appointmentList', 'Appointment list'), fileName);
}

function getColumnWidth(data: Array<Record<string, unknown>>, columnName: string) {
  return Math.min(
    data.reduce(
      (width, row) => Math.max(width, String(row[columnName] ?? '').length),
      Math.max(columnName.length, 12),
    ) + 2,
    60,
  );
}

function toSpreadsheetCell(value: unknown): CellValue {
  if (value == null) {
    return '';
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value instanceof Date) {
    return value;
  }

  return String(value);
}

function getColumnNames(data: Array<Record<string, unknown>>) {
  return Object.keys(data[0] ?? {});
}

async function writeSpreadsheet(
  data: Array<Record<string, unknown>>,
  sheetName: string,
  fileName: string,
): Promise<void> {
  const { Workbook } = await import('exceljs');
  const workbook = new Workbook();
  const worksheet = workbook.addWorksheet(sheetName.slice(0, 31));
  const columnNames = getColumnNames(data);

  worksheet.columns = columnNames.map((columnName) => ({
    header: columnName,
    key: columnName,
    width: getColumnWidth(data, columnName),
  }));
  worksheet.getRow(1).font = { bold: true };

  for (const row of data) {
    worksheet.addRow(
      Object.fromEntries(columnNames.map((columnName) => [columnName, toSpreadsheetCell(row[columnName])])),
    );
  }

  await downloadWorkbook(workbook, fileName);
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
