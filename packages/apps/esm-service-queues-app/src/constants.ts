import dayjs from 'dayjs';

const trimTrailingSlash = (path: string) => path.replace(/\/+$/, '');
const getSpaBasePath = () =>
  trimTrailingSlash(globalThis.getOpenmrsSpaBase?.() ?? globalThis.spaBase ?? '/openmrs/spa');

export const spaRoot = window['getOpenmrsSpaBase'];
export const spaBasePath = `${getSpaBasePath()}/home`;
export const serviceQueuesBasePath = `${spaBasePath}/service-queues`;
export const omrsDateFormat = 'YYYY-MM-DDTHH:mm:ss.SSSZZ';
export const startOfDay = dayjs(new Date().setUTCHours(0, 0, 0, 0)).format(omrsDateFormat);
export const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

export const datePickerPlaceHolder = 'dd/mm/yyyy';
export const datePickerFormat = 'd/m/Y';
export const time12HourFormatRegexPattern = '^(1[0-2]|0?[1-9]):[0-5][0-9]$';

export const serviceQueuesVisitNotesWorkspace = 'service-queues-visit-notes-workspace';
export const serviceQueuesPatientVitalsWorkspace = 'service-queues-patient-vitals-workspace';
