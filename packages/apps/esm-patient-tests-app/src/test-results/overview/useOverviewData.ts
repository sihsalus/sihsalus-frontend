import { type OBSERVATION_INTERPRETATION, type ObsRecord, type PatientData } from '@openmrs/esm-patient-common-lib';
import { useMemo } from 'react';

import { extractObservationInterpretation } from '../loadPatientTestData/helpers';
import usePatientResultsData from '../loadPatientTestData/usePatientResultsData';

export interface OverviewPanelData {
  id: string;
  key?: string;
  name: string;
  range: string;
  interpretation: OBSERVATION_INTERPRETATION;
  value?: {
    interpretation: string;
    value: string | number;
  };
  valueCodeableConcept?: Coding;
}

interface Coding {
  coding: Array<{ code: string; display: string }>;
}

export type OverviewPanelEntry = [string, string, Array<OverviewPanelData>, Date, Date, string];

const getOverviewValue = (entry: ObsRecord) => {
  const value = entry.value ?? '--';
  const normalizedValue = typeof value === 'number' || typeof value === 'string' ? value : String(value);
  const interpretationInput = typeof normalizedValue === 'number' ? `${normalizedValue}` : normalizedValue;
  const hasComparator = Boolean((entry.valueQuantity as { comparator?: string } | undefined)?.comparator);
  const interpretation =
    extractObservationInterpretation(entry) ??
    (hasComparator ? '--' : (entry.meta?.assessValue?.(interpretationInput) ?? '--'));
  const units = entry.valueQuantity?.unit ?? entry.meta?.units;

  return {
    interpretation,
    value: units && normalizedValue !== '--' ? `${normalizedValue} ${units}` : normalizedValue,
  };
};

const getOverviewRange = (entry: ObsRecord) => {
  const range = entry.meta?.range;
  const units = entry.valueQuantity?.unit ?? entry.meta?.units;
  return range ? `${range}${units && !range.trimEnd().endsWith(units) ? ` ${units}` : ''}` : '--';
};

export function parseSingleEntry(
  entry: ObsRecord,
  type: PatientData[string]['type'],
  panelName: string,
): Array<OverviewPanelData> {
  if (type === 'Test') {
    const overviewValue = getOverviewValue(entry);
    return [
      {
        id: entry.id,
        name: panelName,
        range: getOverviewRange(entry),
        interpretation: overviewValue.interpretation,
        value: overviewValue,
      },
    ];
  } else {
    return (entry.members ?? []).map((groupMember) => {
      const overviewValue = getOverviewValue(groupMember);
      return {
        id: groupMember.id,
        key: groupMember.id,
        name: groupMember.name ?? groupMember.id,
        range: getOverviewRange(groupMember),
        interpretation: overviewValue.interpretation,
        value: overviewValue,
      };
    });
  }
}

function useOverviewData(patientUuid: string) {
  const { sortedObs, loaded, error, isOffline, retry } = usePatientResultsData(patientUuid);
  const overviewData = useMemo(
    () =>
      Object.values(sortedObs)
        .flatMap(({ name: panelName, entries, type, uuid }): Array<OverviewPanelEntry> => {
          const newestEntry = entries[0];

          if (!newestEntry) {
            return [];
          }

          return [
            [
              panelName,
              type,
              parseSingleEntry(newestEntry, type, panelName),
              new Date(newestEntry.effectiveDateTime),
              new Date(newestEntry.issued ?? newestEntry.effectiveDateTime),
              uuid,
            ],
          ];
        })
        .sort(([, , , date1], [, , , date2]) => date2.getTime() - date1.getTime()),
    [sortedObs],
  );

  return { overviewData, loaded, error, isOffline, retry };
}

export default useOverviewData;
