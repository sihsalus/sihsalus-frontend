import { type FetchResponse, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import useSWR from 'swr';

const SETTING_PROPERTY = 'sihsalus.staffScheduling.roster';
const SETTING_DESCRIPTION = 'Programación de turnos de personal de salud, ambientes y cupos ofertables';

export const DAYS_OF_WEEK = [
  { id: 1, label: 'Lunes' },
  { id: 2, label: 'Martes' },
  { id: 3, label: 'Miércoles' },
  { id: 4, label: 'Jueves' },
  { id: 5, label: 'Viernes' },
  { id: 6, label: 'Sábado' },
  { id: 0, label: 'Domingo' },
];

export type ShiftStatus = 'draft' | 'published' | 'suspended';

export interface Provider {
  uuid: string;
  display: string;
  person?: {
    display?: string;
  };
}

export interface Location {
  uuid: string;
  display: string;
  name?: string;
}

export interface AppointmentService {
  uuid: string;
  name: string;
  display?: string;
  description?: string;
}

export interface ResourceAvailability {
  id: string;
  locationUuid: string;
  locationName: string;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  active: boolean;
}

export interface StaffShift {
  id: string;
  date: string;
  providerUuid: string;
  providerName: string;
  locationUuid: string;
  locationName: string;
  serviceUuid: string;
  serviceName: string;
  startTime: string;
  endTime: string;
  slotMinutes: number;
  capacityPerSlot: number;
  status: ShiftStatus;
  notes?: string;
}

export interface GeneratedSlot {
  id: string;
  shiftId: string;
  date: string;
  startDateTime: string;
  endDateTime: string;
  providerUuid: string;
  providerName: string;
  locationUuid: string;
  locationName: string;
  serviceUuid: string;
  serviceName: string;
  capacity: number;
  status: ShiftStatus;
}

export interface StaffSchedulingData {
  version: number;
  updatedAt: string;
  resourceAvailabilities: ResourceAvailability[];
  shifts: StaffShift[];
}

interface SystemSetting {
  uuid: string;
  property: string;
  value: string;
  description: string;
}

interface SystemSettingResults {
  results: SystemSetting[];
}

function defaultSchedulingData(): StaffSchedulingData {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    resourceAvailabilities: [],
    shifts: [],
  };
}

function parseSchedulingData(value?: string): StaffSchedulingData {
  if (!value) {
    return defaultSchedulingData();
  }

  try {
    const parsed = JSON.parse(value) as Partial<StaffSchedulingData>;
    return {
      version: parsed.version ?? 1,
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
      resourceAvailabilities: parsed.resourceAvailabilities ?? [],
      shifts: parsed.shifts ?? [],
    };
  } catch {
    return defaultSchedulingData();
  }
}

export function createClientId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function useStaffSchedulingData() {
  const url = `/ws/rest/v1/systemsetting?q=${SETTING_PROPERTY}&v=default`;
  const { data, error, isLoading, mutate } = useSWR<FetchResponse<SystemSettingResults>, Error>(url, openmrsFetch);
  const setting = data?.data?.results?.find((item) => item.property === SETTING_PROPERTY);

  return {
    schedulingData: parseSchedulingData(setting?.value),
    settingUuid: setting?.uuid ?? null,
    isLoading,
    error,
    mutate,
  };
}

export async function saveStaffSchedulingData(settingUuid: string | null, data: StaffSchedulingData): Promise<void> {
  const payload = {
    ...data,
    version: data.version + 1,
    updatedAt: new Date().toISOString(),
  };
  const value = JSON.stringify(payload);

  if (settingUuid) {
    await openmrsFetch(`/ws/rest/v1/systemsetting/${settingUuid}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    });
  } else {
    await openmrsFetch('/ws/rest/v1/systemsetting', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        property: SETTING_PROPERTY,
        description: SETTING_DESCRIPTION,
        value,
      }),
    });
  }
}

export function useSchedulingReferenceData() {
  const providersUrl = `${restBaseUrl}/provider?v=custom:(uuid,display,person:(uuid,display))`;
  const locationsUrl = `${restBaseUrl}/location?v=custom:(uuid,display,name)`;
  const servicesUrl = `${restBaseUrl}/appointmentService/all/full`;

  const providers = useSWR<FetchResponse<{ results: Provider[] }>, Error>(providersUrl, openmrsFetch);
  const locations = useSWR<FetchResponse<{ results: Location[] }>, Error>(locationsUrl, openmrsFetch);
  const services = useSWR<FetchResponse<AppointmentService[]>, Error>(servicesUrl, openmrsFetch);

  return {
    providers: providers.data?.data?.results ?? [],
    locations: locations.data?.data?.results ?? [],
    services: services.data?.data ?? [],
    isLoading: providers.isLoading || locations.isLoading || services.isLoading,
    error: providers.error || locations.error || services.error,
  };
}

export function buildGeneratedSlots(shifts: StaffShift[]): GeneratedSlot[] {
  return shifts.flatMap((shift) => {
    if (shift.status === 'suspended') {
      return [];
    }

    const start = dayjs(`${shift.date}T${shift.startTime}`);
    const end = dayjs(`${shift.date}T${shift.endTime}`);
    const slotMinutes = Math.max(1, Number(shift.slotMinutes) || 1);
    const slots: GeneratedSlot[] = [];

    let cursor = start;
    while (cursor.add(slotMinutes, 'minute').isSame(end) || cursor.add(slotMinutes, 'minute').isBefore(end)) {
      const slotEnd = cursor.add(slotMinutes, 'minute');
      slots.push({
        id: `${shift.id}-${cursor.format('HHmm')}`,
        shiftId: shift.id,
        date: shift.date,
        startDateTime: cursor.toISOString(),
        endDateTime: slotEnd.toISOString(),
        providerUuid: shift.providerUuid,
        providerName: shift.providerName,
        locationUuid: shift.locationUuid,
        locationName: shift.locationName,
        serviceUuid: shift.serviceUuid,
        serviceName: shift.serviceName,
        capacity: Math.max(1, Number(shift.capacityPerSlot) || 1),
        status: shift.status,
      });
      cursor = slotEnd;
    }

    return slots;
  });
}

export function isShiftInsideAvailability(shift: StaffShift, availabilities: ResourceAvailability[]) {
  const dayOfWeek = dayjs(shift.date).day();
  return availabilities.some(
    (availability) =>
      availability.active &&
      availability.locationUuid === shift.locationUuid &&
      availability.daysOfWeek.includes(dayOfWeek) &&
      availability.startTime <= shift.startTime &&
      availability.endTime >= shift.endTime,
  );
}
