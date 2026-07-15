import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';

import { type AppointmentService } from '../../types';

export interface AppointmentServiceCreatePayload {
  name: string;
  startTime: string;
  endTime: string;
  durationMins: number;
  color: string;
  locationUuid: string;
}

export class AppointmentServiceCatalogInvalidError extends Error {
  constructor() {
    super('The appointment service catalog returned an invalid response.');
    this.name = 'AppointmentServiceCatalogInvalidError';
  }
}

const appointmentServiceInitialValue: AppointmentService = {
  appointmentServiceId: 0,
  creatorName: '',
  description: '',
  durationMins: 0,
  endTime: '',
  initialAppointmentStatus: '',
  location: { uuid: '', display: '' },
  maxAppointmentsLimit: 0,
  name: '',
  startTime: '',
  uuid: '',
  color: '',
  startTimeTimeFormat: new Date().getHours() >= 12 ? 'PM' : 'AM',
  endTimeTimeFormat: new Date().getHours() >= 12 ? 'PM' : 'AM',
};

const addNewAppointmentService = (payload: AppointmentServiceCreatePayload) => {
  return openmrsFetch(`${restBaseUrl}/appointmentService`, {
    method: 'POST',
    body: payload,
    headers: { 'Content-Type': 'application/json' },
  });
};

const normalizeText = (value: string) => value.normalize('NFC').trim().replace(/\s+/gu, ' ').toLowerCase();
const validCatalogTimePattern = /^(?:[01]?\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/u;
const normalizeTime = (value: string) => {
  const [hours = '', minutes = '', seconds = '00'] = value.trim().split(':');
  return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')}`;
};

export function toTwentyFourHourServiceTime(value: string, timeFormat: string) {
  const match = /^(\d{1,2}):(\d{2})$/u.exec(value.trim());
  const hours = match ? Number(match[1]) : Number.NaN;
  const minutes = match ? Number(match[2]) : Number.NaN;
  if (!match || hours < 1 || hours > 12 || minutes < 0 || minutes > 59 || !['AM', 'PM'].includes(timeFormat)) {
    throw new Error('Invalid appointment service time.');
  }

  const twentyFourHour = (hours % 12) + (timeFormat === 'PM' ? 12 : 0);
  return `${String(twentyFourHour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
}

export function isSameAppointmentService(
  service: AppointmentService,
  payload: AppointmentServiceCreatePayload,
) {
  if (
    typeof service.name !== 'string' ||
    typeof service.location?.uuid !== 'string' ||
    !service.location.uuid.trim() ||
    typeof service.startTime !== 'string' ||
    typeof service.endTime !== 'string' ||
    !validCatalogTimePattern.test(service.startTime) ||
    !validCatalogTimePattern.test(service.endTime) ||
    !Number.isInteger(service.durationMins) ||
    service.durationMins < 1 ||
    service.durationMins > 1440 ||
    typeof service.color !== 'string' ||
    !/^#[0-9a-f]{6}$/iu.test(service.color)
  ) {
    return false;
  }
  return (
    normalizeText(service.name) === normalizeText(payload.name) &&
    service.location?.uuid === payload.locationUuid &&
    normalizeTime(service.startTime) === normalizeTime(payload.startTime) &&
    normalizeTime(service.endTime) === normalizeTime(payload.endTime) &&
    service.durationMins === payload.durationMins &&
    service.color?.toLowerCase() === payload.color.toLowerCase()
  );
}

export function areSameAppointmentServicePayloads(
  left: AppointmentServiceCreatePayload,
  right: AppointmentServiceCreatePayload,
) {
  return (
    normalizeText(left.name) === normalizeText(right.name) &&
    left.locationUuid === right.locationUuid &&
    normalizeTime(left.startTime) === normalizeTime(right.startTime) &&
    normalizeTime(left.endTime) === normalizeTime(right.endTime) &&
    left.durationMins === right.durationMins &&
    left.color.toLowerCase() === right.color.toLowerCase()
  );
}

export function hasSameAppointmentServiceName(service: AppointmentService, name: string) {
  return typeof service.name === 'string' && normalizeText(service.name) === normalizeText(name);
}

export async function fetchAppointmentServices(): Promise<Array<AppointmentService>> {
  const response = await openmrsFetch<unknown>(`${restBaseUrl}/appointmentService/all/full`);
  if (!Array.isArray(response.data)) {
    throw new AppointmentServiceCatalogInvalidError();
  }

  const services = response.data as Array<Partial<AppointmentService>>;
  const hasInvalidIdentity = services.some(
    (service) =>
      !service ||
      typeof service.uuid !== 'string' ||
      !service.uuid.trim() ||
      typeof service.name !== 'string' ||
      !service.name.trim(),
  );
  const serviceUuids = services.map((service) => service.uuid);
  if (hasInvalidIdentity || new Set(serviceUuids).size !== serviceUuids.length) {
    throw new AppointmentServiceCatalogInvalidError();
  }

  return services as Array<AppointmentService>;
}

export const useAppointmentServices = () => {
  return { appointmentServiceInitialValue, addNewAppointmentService };
};
