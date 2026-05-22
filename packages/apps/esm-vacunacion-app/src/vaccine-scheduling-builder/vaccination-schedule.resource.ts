import { type FetchResponse, openmrsFetch } from '@openmrs/esm-framework';
import useSWR from 'swr';

const SETTING_PROPERTY = 'vaccinationschedule.schedule.PE';
const SETTING_DESCRIPTION = 'Esquema nacional de vacunación Perú (NIS)';

export interface ScheduleEntry {
  conceptUuid: string;
  name: string;
  schedule: Record<string, 'required' | 'optional' | 'empty'>;
}

export interface ScheduleData {
  version: number;
  updatedAt: string;
  entries: ScheduleEntry[];
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

function parseScheduleData(value: string): ScheduleData | null {
  try {
    return JSON.parse(value) as ScheduleData;
  } catch {
    return null;
  }
}

export function useVaccinationSchedule() {
  const url = `/ws/rest/v1/systemsetting?q=${SETTING_PROPERTY}&v=default`;
  const { data, error, isLoading, mutate } = useSWR<FetchResponse<SystemSettingResults>, Error>(url, openmrsFetch);

  const setting = data?.data?.results?.find((s) => s.property === SETTING_PROPERTY);
  const scheduleData = setting?.value ? parseScheduleData(setting.value) : null;

  return {
    scheduleData,
    settingUuid: setting?.uuid ?? null,
    isLoading,
    error,
    mutate,
  };
}

export async function saveScheduleData(settingUuid: string | null, data: ScheduleData): Promise<void> {
  const value = JSON.stringify(data);

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
