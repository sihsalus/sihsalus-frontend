import { openmrsFetch, restBaseUrl, useOpenmrsFetchAll } from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import { useMemo } from 'react';
import { type CREDEncounter, encounterMatchesFormIdentifier } from './useEncountersCRED';

interface FormRecord extends CREDEncounter {
  patient?: { uuid: string };
  voided?: boolean;
  obs?: Array<{
    voided?: boolean;
    concept?: { uuid: string };
    value?: string | number | boolean | { display?: string } | null;
  }>;
}

/** Keep a summary's fields within the latest active record of its configured form. */
export function useCREDFormRecord(patientUuid: string, formIdentifier: string | undefined) {
  const params = new URLSearchParams({
    patient: patientUuid,
    v: 'custom:(uuid,encounterDatetime,voided,patient:(uuid),form:(uuid,name,display),obs:(voided,concept:(uuid),value:(uuid,display)))',
  });
  const { data, isLoading, error } = useOpenmrsFetchAll<FormRecord>(
    patientUuid && formIdentifier ? `${restBaseUrl}/encounter?${params.toString()}` : null,
    { fetcher: openmrsFetch, swrInfiniteConfig: { keepPreviousData: false } },
  );
  const record = useMemo(
    () =>
      data
        ?.filter(
          (entry) =>
            !entry.voided &&
            entry.patient?.uuid === patientUuid &&
            Number.isFinite(Date.parse(entry.encounterDatetime ?? '')) &&
            encounterMatchesFormIdentifier(entry, formIdentifier),
        )
        .sort((a, b) => Date.parse(b.encounterDatetime ?? '') - Date.parse(a.encounterDatetime ?? ''))[0],
    [data, patientUuid, formIdentifier],
  );
  const readValue = (conceptUuid: string | undefined): string | null => {
    if (!conceptUuid) return null;
    const observations = record?.obs?.filter((obs) => !obs.voided && obs.concept?.uuid === conceptUuid);
    if (observations?.length !== 1) return null;
    const value = observations[0].value;
    return value != null ? (typeof value === 'object' ? (value.display ?? null) : String(value)) : null;
  };
  return {
    readValue,
    date: record?.encounterDatetime ? dayjs(record.encounterDatetime).format('DD/MM/YYYY') : null,
    isLoading,
    error,
  };
}
