import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(timezone);

const trimTrailingSlash = (path: string) => path.replace(/\/+$/, '');
const getSpaBasePath = () =>
  trimTrailingSlash(globalThis.getOpenmrsSpaBase?.() ?? globalThis.spaBase ?? '/openmrs/spa');

export const spaRoot = window['getOpenmrsSpaBase'];
export const spaBasePath = `${getSpaBasePath()}/home`;
export const serviceQueuesBasePath = `${spaBasePath}/service-queues`;
export const omrsDateFormat = 'YYYY-MM-DDTHH:mm:ss.SSSZZ';
export const timeZone = 'America/Lima';
export const getStartOfDay = () => dayjs().tz(timeZone).startOf('day').toISOString();
export const serviceQueuesPrivilege = 'app:home.colasAtencion';
export const serviceQueuesEditPrivilege = 'app:home.colasAtencion.editar';

export const datePickerPlaceHolder = 'dd/mm/yyyy';
export const datePickerFormat = 'd/m/Y';
export const time12HourFormatRegexPattern = '^(1[0-2]|0?[1-9]):[0-5][0-9]$';

export const serviceQueuesPatientSearchWorkspace = 'queue-patient-search-add-to-queue-workspace';
export const serviceQueuesStartVisitWorkspace = 'queue-patient-search-start-visit-workspace';
export const serviceQueuesVisitNotesWorkspace = 'service-queues-visit-notes-workspace';
export const serviceQueuesPatientVitalsWorkspace = 'service-queues-patient-vitals-workspace';

export const queueEntryCustomRepresentation =
  'custom:(uuid,display,queue:(uuid,display,name,location:(uuid,display),service:(uuid,display),allowedPriorities:(uuid,display),allowedStatuses:(uuid,display)),status,patient:(uuid,display),visit:(uuid,display,startDatetime),priority,priorityComment,sortWeight,startedAt,endedAt,locationWaitingFor,queueComingFrom,providerWaitingFor,previousQueueEntry)';

export const DUPLICATE_QUEUE_ENTRY_ERROR_CODE = '[queue.entry.error.duplicate]';
export const QUEUE_ENTRY_ALREADY_ENDED_ERROR = 'queue entry that has already ended';
