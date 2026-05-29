import { fetchCurrentPatient, formatDate, getConfig } from '@openmrs/esm-framework';
import type { CellValue, Workbook } from 'exceljs';

import type { ConfigObject } from '../config-schema';
import type { Appointment } from '../types';

import { moduleName } from './constants';

type RowData = {
  id: string; // Corresponds to the UUIDof an appointment
  identifier?: string; // Optional identifier property
} & Record<string, unknown>; // Allow for other dynamic properties

/**
 * Exports the provided appointments as an Excel spreadsheet.
 * @param {Array<Appointment>} appointments - The list of appointments to export.
 * @param {Array} rowData - The current rows of the table as rendered in the UI.
 * @param {string} [fileName] - The name of the downloaded file
 */
export async function exportAppointmentsToSpreadsheet(
  appointments: Array<Appointment>,
  rowData: Array<RowData>,
  fileName = 'Appointments',
): Promise<void> {
  const _config = await getConfig<ConfigObject>(moduleName);
  // const includePhoneNumbers = config.includePhoneNumberInExcelSpreadsheet ?? false;
  const includePhoneNumbers = false;

  const appointmentsJSON = await Promise.all(
    appointments.map(async (appointment: Appointment) => {
      const matchingAppointment = rowData.find((row) => row.id === appointment.uuid);
      const identifier = matchingAppointment?.identifier ?? appointment.patient.identifier;

      const patientInfo = await fetchCurrentPatient(appointment.patient.uuid);
      const phoneNumber =
        includePhoneNumbers && patientInfo?.telecom
          ? patientInfo.telecom.map((telecomObj) => telecomObj?.value).join(', ')
          : '';

      return {
        'Patient name': appointment.patient.name,
        Gender: appointment.patient.gender === 'F' ? 'Female' : 'Male',
        Age: appointment.patient.age,
        Identifier: identifier,
        'Appointment type': appointment.service?.name,
        Date: formatDate(new Date(appointment.startDateTime), { mode: 'wide' }),
        ...(includePhoneNumbers ? { 'Telephone number': phoneNumber } : {}),
      };
    }),
  );

  await writeSpreadsheet(appointmentsJSON, 'Appointment list', `${fileName}.xlsx`);
}

/**
Exports unscheduled appointments as an Excel spreadsheet.
@param {Array<Object>} unscheduledAppointments - The list of unscheduled appointments to export.
@param {string} fileName - The name of the file to download. Defaults to 'Unscheduled appointments {current date and time}'.
*/
export function exportUnscheduledAppointmentsToSpreadsheet(
  unscheduledAppointments: Array<Record<string, unknown>>,
  fileName = `Unscheduled appointments ${formatDate(new Date(), { year: true, time: true })}`,
): Promise<void> {
  const appointmentsJSON = unscheduledAppointments?.map((appointment) => ({
    'Patient name': appointment.name,
    Gender: appointment.gender === 'F' ? 'Female' : 'Male',
    Age: appointment.age,
    'Phone Number': appointment.phoneNumber ?? '--',
    Identifier: appointment.identifier ?? '--',
  }));

  return writeSpreadsheet(appointmentsJSON, 'Appointment list', `${fileName}.xlsx`);
}

function getFirstColumnWidth(data: Array<Record<string, unknown>>) {
  const max_width = data.reduce((w, r) => Math.max(w, String(r['Patient name'] ?? '').length), 30);
  return max_width;
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
  const worksheet = workbook.addWorksheet(sheetName);
  const columnNames = getColumnNames(data);

  worksheet.columns = columnNames.map((columnName, index) => ({
    header: columnName,
    key: columnName,
    ...(index === 0 ? { width: getFirstColumnWidth(data) } : {}),
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
