import { openmrsFetch, useConfig } from '@openmrs/esm-framework';
import { useMemo } from 'react';
import useSWR from 'swr';

import type { OdontogramConfig } from '../config-schema';
import { getAmpathOdontogramFormUuid } from '../odontogram/ampath-form-odontogram-config';
import {
  getOdontogramDataFromEncounter,
  getOdontogramRecordTypeFromEncounter,
  getParentBaseEncounterUuidFromEncounter,
  type OdontogramEncounter,
} from '../odontogram/ampath-form-odontogram-mapper';
import type { OdontogramData } from '../odontogram/types/odontogram';
import { getEncountersByTypeUrl } from '../odontogram.resource';
import type { OdontogramBaseGroup, OdontogramRecord, OdontogramRecordType } from '../types/odontogram-record';

interface EncounterResponse {
  results: Array<OdontogramEncounter>;
}

function formatBaseLabel(isoDate: string, index: number, total: number): string {
  const d = new Date(isoDate);
  const dateStr = d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
  // If only one base ever, keep it simple
  return total === 1 ? 'Odontograma base' : `Base ${index + 1} – ${dateStr}`;
}

function formatAttentionLabel(isoDate: string): string {
  const d = new Date(isoDate);
  return `Atención – ${d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}`;
}

/**
 * Groups attention records under their parent base using chronological proximity:
 * an attention belongs to the most recent base that precedes it in time.
 * Attentions that predate all bases fall under the oldest base as a safety fallback.
 */
function groupByBase(bases: OdontogramRecord[], attentions: OdontogramRecord[]): OdontogramBaseGroup[] {
  // bases are already sorted oldest→newest
  const groups: OdontogramBaseGroup[] = bases.map((base) => ({ base, attentions: [] }));
  const groupIndexByBaseUuid = new Map(bases.map((base, index) => [base.encounterUuid, index]));

  for (const attention of attentions) {
    const explicitParentIndex = attention.parentBaseEncounterUuid
      ? groupIndexByBaseUuid.get(attention.parentBaseEncounterUuid)
      : undefined;

    if (explicitParentIndex != null) {
      groups[explicitParentIndex].attentions.push(attention);
      continue;
    }

    // Find the latest base whose date is <= the attention date
    let targetGroupIndex = 0; // fallback: oldest base
    for (let i = 0; i < bases.length; i++) {
      if (bases[i].date <= attention.date) {
        targetGroupIndex = i;
      }
    }
    groups[targetGroupIndex].attentions.push(attention);
  }

  return groups;
}

function hasMatchingRecordType(
  encounter: OdontogramEncounter,
  config: OdontogramConfig,
  recordType: OdontogramRecordType,
): boolean {
  const oppositeFallback = recordType === 'base' ? 'attention' : 'base';
  return getOdontogramRecordTypeFromEncounter(encounter, config, oppositeFallback) === recordType;
}

export function buildOdontogramRecords(
  encounters: OdontogramEncounter[],
  config: OdontogramConfig,
  recordType: OdontogramRecordType,
): OdontogramRecord[] {
  const recordsWithData: Array<{ encounter: OdontogramEncounter; data: OdontogramData }> = [...encounters]
    .sort((a, b) => a.encounterDatetime.localeCompare(b.encounterDatetime))
    .flatMap((encounter) => {
      const data = getOdontogramDataFromEncounter(encounter, config);

      if (!data || !hasMatchingRecordType(encounter, config, recordType)) {
        return [];
      }

      return [{ encounter, data }];
    });

  return recordsWithData.map(({ encounter, data }, index) => ({
    encounterUuid: encounter.uuid,
    type: recordType,
    date: encounter.encounterDatetime,
    label:
      recordType === 'base'
        ? formatBaseLabel(encounter.encounterDatetime, index, recordsWithData.length)
        : formatAttentionLabel(encounter.encounterDatetime),
    data,
    parentBaseEncounterUuid:
      recordType === 'attention' ? getParentBaseEncounterUuidFromEncounter(encounter, config) : undefined,
  }));
}

/**
 * Fetches the full odontogram history for a patient and returns it as
 * grouped base→attentions pairs, sorted oldest-first.
 */
export function useOdontogramHistory(patientUuid: string | null) {
  const config = useConfig<OdontogramConfig>();
  const { baseEncounterTypeUuid, attentionEncounterTypeUuid } = config;
  const baseFormUuid = getAmpathOdontogramFormUuid(config, 'base');
  const attentionFormUuid = getAmpathOdontogramFormUuid(config, 'attention');

  const canFetch = Boolean(patientUuid && baseEncounterTypeUuid && attentionEncounterTypeUuid);

  const baseUrl = canFetch ? getEncountersByTypeUrl(patientUuid, baseEncounterTypeUuid, 50, baseFormUuid) : null;
  const attentionUrl = canFetch
    ? getEncountersByTypeUrl(patientUuid, attentionEncounterTypeUuid, 100, attentionFormUuid)
    : null;

  const swrOptions = {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 60_000,
  };

  const {
    data: baseData,
    error: baseError,
    isLoading: isLoadingBase,
    mutate: mutateBase,
  } = useSWR<{ data: EncounterResponse }>(baseUrl, openmrsFetch, swrOptions);

  const {
    data: attentionData,
    error: attentionError,
    isLoading: isLoadingAttentions,
    mutate: mutateAttentions,
  } = useSWR<{ data: EncounterResponse }>(attentionUrl, openmrsFetch, swrOptions);

  const baseResults = baseData?.data?.results;
  const attentionResults = attentionData?.data?.results;

  const baseRecords = useMemo(
    () => buildOdontogramRecords(baseResults ?? [], config, 'base'),
    [baseResults, config],
  );
  const attentionRecords = useMemo(
    () => buildOdontogramRecords(attentionResults ?? [], config, 'attention'),
    [attentionResults, config],
  );

  const groups: OdontogramBaseGroup[] = useMemo(
    () => (baseRecords.length > 0 ? groupByBase(baseRecords, attentionRecords) : []),
    [baseRecords, attentionRecords],
  );

  const mutate = () => Promise.all([mutateBase(), mutateAttentions()]);

  return {
    groups,
    /** Flat list of base records (oldest→newest) */
    baseRecords,
    /** Flat list of all attention records (oldest→newest) */
    attentionRecords,
    isLoading: isLoadingBase || isLoadingAttentions,
    error: baseError ?? attentionError ?? null,
    mutate,
  };
}
