import type { TFunction } from 'i18next';

import { type Appointment, AppointmentKind, AppointmentStatus } from '../types';
import { createAppointmentsExportFileName, createAppointmentSpreadsheetRow } from './excel';

const translations: Record<string, string> = {
  age: 'Edad',
  appointmentDateTime: 'Fecha y hora de la cita',
  appointmentType: 'Modalidad de cita',
  female: 'Femenino',
  gender: 'Sexo',
  patientIdentifiers: 'Identificadores del paciente',
  patientName: 'Nombre del paciente',
  phoneNumber: 'Número de teléfono',
  responsibleProvider: 'Personal de salud responsable',
  serviceType: 'Tipo de servicio',
  unassignedProvider: 'Sin personal de salud asignado',
};
const t = ((key: string, defaultValue: string) => translations[key] ?? defaultValue) as TFunction;

const appointment = {
  uuid: 'appointment-uuid',
  patient: {
    identifier: '',
    identifiers: [{ identifier: '100009C', identifierName: 'N° Historia Clínica' }],
    name: 'Paciente Prueba',
    uuid: 'patient-uuid',
    gender: 'F',
    age: '25',
  },
  service: { name: 'Medicina general' },
  startDateTime: '2026-07-31T09:30:00-05:00',
  appointmentKind: AppointmentKind.SCHEDULED,
  status: AppointmentStatus.SCHEDULED,
} as Appointment;

describe('appointment spreadsheet localization', () => {
  it('creates localized rows using complete patient identifiers and telephone numbers', () => {
    const row = createAppointmentSpreadsheetRow(
      appointment,
      {
        resourceType: 'Patient',
        identifier: [{ value: '87654321', type: { text: 'DNI' } }],
        telecom: [
          { system: 'phone', value: '999888777' },
          { system: 'email', value: 'paciente@example.org' },
        ],
      },
      true,
      t,
    );

    expect(row).toMatchObject({
      'Nombre del paciente': 'Paciente Prueba',
      Sexo: 'Femenino',
      Edad: '25',
      'Identificadores del paciente': 'HC: 100009C; DNI: 87654321',
      'Tipo de servicio': 'Medicina general',
      'Modalidad de cita': 'Programada presencial',
      'Personal de salud responsable': 'Sin personal de salud asignado',
      'Número de teléfono': '999888777',
    });
    expect(row['Fecha y hora de la cita']).toEqual(expect.any(String));
  });

  it('creates a filesystem-safe localized filename without repeating the prefix', () => {
    expect(createAppointmentsExportFileName('Citas', 'Citas programadas hoy', '2026-07-31')).toBe(
      'Citas_programadas_hoy_2026-07-31.xlsx',
    );
    expect(createAppointmentsExportFileName('Citas', 'Esperadas / mañana', '2026-08-01')).toBe(
      'Citas_Esperadas_-_mañana_2026-08-01.xlsx',
    );
  });
});
