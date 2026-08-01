export const spaRoot = window['getOpenmrsSpaBase'];
export const basePath = '/appointments';
export const spaHomePage = `${globalThis.spaBase}/home`;
export const omrsDateFormat = 'YYYY-MM-DDTHH:mm:ss.SSSZZ';
export const appointmentLocationTagName = 'Appointment Location';
export const appointmentsPrivilege = 'app:home.citas';
export const appointmentsEditPrivilege = 'app:home.citas.editar';
export const clinicalChartPrivilege = 'app:hoja.clinica';
export const appointmentStartDateEditPrivilege = 'app:appointments.startDate.edit';
// Backdating when an appointment was issued rewrites the administrative record
// of who scheduled what and when, so it is gated separately from moving the
// appointment itself. Without this privilege the field stays at today's date.
export const appointmentIssueDateEditPrivilege = 'app:appointments.issueDate.edit';
export const chartAppointmentsReadPrivilege = 'app:hoja.clinica.citas';
export const chartAppointmentsEditPrivilege = 'app:hoja.clinica.citas.editar';
// The appointments backend persists patient_appointment.comments as VARCHAR(255).
export const appointmentNoteMaxLength = 255;
// Keep the input controls, form schema, and resource guards on the same
// clinical bounds. A full-day appointment is represented as exactly 1,440
// minutes ([start of day, start of next day)).
export const appointmentDurationMinutesRange = { min: 1, max: 1440 } as const;
export const recurringPatternPeriodRange = { min: 1, max: 356 } as const;

export const moduleName = '@sihsalus/esm-appointments-app';

export const datePickerPlaceHolder = 'dd/mm/yyyy';
export const dateFormat = 'DD/MM/YYYY';
export const datePickerFormat = 'd/m/Y';
export const weekDays = [
  {
    id: 'MONDAY',
    label: 'Monday',
    labelCode: 'monday',
    order: 0,
  },
  {
    id: 'TUESDAY',
    label: 'Tuesday',
    labelCode: 'tuesday',
    order: 1,
  },
  {
    id: 'WEDNESDAY',
    label: 'Wednesday',
    labelCode: 'wednesday',
    order: 2,
  },
  {
    id: 'THURSDAY',
    label: 'Thursday',
    labelCode: 'thursday',
    order: 3,
  },
  {
    id: 'FRIDAY',
    label: 'Friday',
    labelCode: 'friday',
    order: 4,
  },
  {
    id: 'SATURDAY',
    label: 'Saturday',
    labelCode: 'saturday',
    order: 5,
  },
  {
    id: 'SUNDAY',
    label: 'Sunday',
    labelCode: 'sunday',
    order: 6,
  },
];
