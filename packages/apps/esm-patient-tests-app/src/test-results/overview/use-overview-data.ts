import { type OBSERVATION_INTERPRETATION, type ObsRecord, type PatientData } from '@openmrs/esm-patient-common-lib';
import { useEffect, useState } from 'react';

import usePatientResultsData from '../load-patient-test-data/use-patient-results-data';

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
  const interpretation = entry.meta?.assessValue ? entry.meta.assessValue(interpretationInput) : '--';

  return {
    interpretation,
    value: normalizedValue,
  };
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
        range: entry.meta?.range || '--',
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
        range: groupMember.meta?.range || '--',
        interpretation: overviewValue.interpretation,
        value: overviewValue,
      };
    });
  }
}

function useOverviewData(patientUuid: string) {
  const { sortedObs, loaded, error } = usePatientResultsData(patientUuid);
  const [overviewData, setDisplayData] = useState<Array<OverviewPanelEntry>>([]);

  useEffect(() => {
    setDisplayData(
      Object.entries(sortedObs)
        .flatMap(([panelName, { entries, type, uuid }]): Array<OverviewPanelEntry> => {
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
    );
  }, [sortedObs]);

  return { overviewData, loaded, error };
}

export default useOverviewData;
