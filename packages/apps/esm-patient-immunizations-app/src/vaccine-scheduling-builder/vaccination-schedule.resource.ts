import { type FetchResponse, openmrsFetch } from '@openmrs/esm-framework';
import useSWR from 'swr';
import type { ImmunizationSequenceDefinition } from '../types/fhir-immunization-domain';

const SETTING_PROPERTY = 'vaccinationschedule.schedule.PE';
const SETTING_DESCRIPTION = 'Esquema nacional de vacunación Perú (NIS)';

export const AGE_PERIODS = [
  { id: 'rn', label: 'RN', ageRange: '0 días', minAgeInDays: 0 },
  { id: '2m', label: '2m', ageRange: '2 meses', minAgeInDays: 60 },
  { id: '4m', label: '4m', ageRange: '4 meses', minAgeInDays: 120 },
  { id: '6m', label: '6m', ageRange: '6 meses', minAgeInDays: 180 },
  { id: '12m', label: '12m', ageRange: '12 meses', minAgeInDays: 365 },
  { id: '15m', label: '15m', ageRange: '15 meses', minAgeInDays: 456 },
  { id: '18m', label: '18m', ageRange: '18 meses', minAgeInDays: 548 },
  { id: '2a', label: '2a', ageRange: '2 años', minAgeInDays: 730 },
  { id: '4a', label: '4a', ageRange: '4 años', minAgeInDays: 1460 },
  { id: '5a', label: '5a', ageRange: '5 años', minAgeInDays: 1825 },
] as const;

type AgePeriodId = (typeof AGE_PERIODS)[number]['id'];
type DoseStatus = 'required' | 'optional' | 'empty';

export interface ScheduleEntry {
  conceptUuid: string;
  name: string;
  schedule: Partial<Record<AgePeriodId, DoseStatus>>;
}

export interface ScheduleVersion {
  version: number;
  status: 'published' | 'retired';
  updatedAt: string;
  updatedBy?: string;
  entries: ScheduleEntry[];
}

export interface VersionedScheduleData {
  activeVersion: number | null;
  versions: ScheduleVersion[];
}

export type ScheduleData = ScheduleVersion;

interface SystemSetting {
  uuid: string;
  property: string;
  value: string;
  description: string;
}

interface SystemSettingResults {
  results: SystemSetting[];
}

function isLegacyScheduleData(value: unknown): value is Omit<ScheduleVersion, 'status'> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as ScheduleVersion).version === 'number' &&
    Array.isArray((value as ScheduleVersion).entries)
  );
}

function isVersionedScheduleData(value: unknown): value is VersionedScheduleData {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as VersionedScheduleData).versions) &&
    ('activeVersion' in value || (value as VersionedScheduleData).versions.length > 0)
  );
}

export function normalizeScheduleData(value: unknown): VersionedScheduleData | null {
  if (isVersionedScheduleData(value)) {
    return {
      activeVersion:
        value.activeVersion ?? value.versions.find((version) => version.status === 'published')?.version ?? null,
      versions: value.versions.map((version) => ({
        ...version,
        status: version.status ?? 'retired',
      })),
    };
  }

  if (isLegacyScheduleData(value)) {
    return {
      activeVersion: value.version,
      versions: [
        {
          ...value,
          status: 'published',
        },
      ],
    };
  }

  return null;
}

function parseScheduleData(value: string): VersionedScheduleData | null {
  try {
    return normalizeScheduleData(JSON.parse(value));
  } catch {
    return null;
  }
}

export function getActiveScheduleVersion(scheduleStore: VersionedScheduleData | null | undefined) {
  if (!scheduleStore?.versions.length) {
    return null;
  }

  return (
    scheduleStore.versions.find((version) => version.version === scheduleStore.activeVersion) ??
    scheduleStore.versions.find((version) => version.status === 'published') ??
    scheduleStore.versions.at(-1) ??
    null
  );
}

export function useVaccinationSchedule() {
  const url = `/ws/rest/v1/systemsetting?q=${SETTING_PROPERTY}&v=default`;
  const { data, error, isLoading, mutate } = useSWR<FetchResponse<SystemSettingResults>, Error>(url, openmrsFetch);

  const setting = data?.data?.results?.find((s) => s.property === SETTING_PROPERTY);
  const scheduleStore = setting?.value ? parseScheduleData(setting.value) : null;
  const scheduleData = getActiveScheduleVersion(scheduleStore);

  return {
    scheduleData,
    scheduleStore,
    versions: scheduleStore?.versions ?? [],
    settingUuid: setting?.uuid ?? null,
    isLoading,
    error,
    mutate,
  };
}

interface SaveScheduleInput {
  entries: ScheduleEntry[];
  updatedBy?: string;
}

export function createNextScheduleStore(
  currentStore: VersionedScheduleData | null | undefined,
  { entries, updatedBy }: SaveScheduleInput,
): VersionedScheduleData {
  const versions = currentStore?.versions ?? [];
  const nextVersion = Math.max(0, ...versions.map((version) => version.version)) + 1;
  const nextScheduleVersion: ScheduleVersion = {
    version: nextVersion,
    status: 'published',
    updatedAt: new Date().toISOString(),
    updatedBy,
    entries,
  };

  return {
    activeVersion: nextVersion,
    versions: [
      ...versions.map((version) =>
        version.status === 'published'
          ? {
              ...version,
              status: 'retired' as const,
            }
          : version,
      ),
      nextScheduleVersion,
    ],
  };
}

export async function saveScheduleData(
  settingUuid: string | null,
  currentStore: VersionedScheduleData | null | undefined,
  input: SaveScheduleInput,
): Promise<void> {
  const value = JSON.stringify(createNextScheduleStore(currentStore, input));

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

export function scheduleEntriesToSequenceDefinitions(
  scheduleData: ScheduleData | null | undefined,
): Array<ImmunizationSequenceDefinition> {
  return (
    scheduleData?.entries
      .map((entry) => {
        const scheduledPeriods = AGE_PERIODS.filter((period) => entry.schedule[period.id] !== undefined);

        return {
          vaccineConceptUuid: entry.conceptUuid,
          sequences: scheduledPeriods.map((period, index) => {
            const previousPeriod = scheduledPeriods[index - 1];
            const status = entry.schedule[period.id];

            return {
              sequenceLabel: status === 'optional' ? `${period.label} opcional` : period.label,
              sequenceNumber: index + 1,
              intervalInDaysAfterPreviousDose: previousPeriod
                ? period.minAgeInDays - previousPeriod.minAgeInDays
                : undefined,
              minAgeInDays: period.minAgeInDays,
              minsaLabel: period.ageRange,
            };
          }),
        };
      })
      .filter((definition) => definition.sequences.length > 0) ?? []
  );
}
