import { openmrsFetch } from '@openmrs/esm-framework';
import isNull from 'lodash-es/isNull';
import { useCallback, useMemo } from 'react';
import useSWRImmutable from 'swr';

import type { OpenmrsEncounter } from './types';

/**
 * OpenMRS custom representation string for encounter queries.
 *
 * Fetches only the fields needed by the clinical dashboard components, keeping
 * the payload small. The representation includes:
 * - Encounter metadata (uuid, datetime, type, location, patient, providers)
 * - Observations with concept names and coded values
 * - The associated form name/uuid (used to open the right O3 form on edit)
 */
export const encounterRepresentation =
  'custom:(uuid,encounterDatetime,encounterType,location:(uuid,name),' +
  'patient:(uuid,display),encounterProviders:(uuid,provider:(uuid,name)),' +
  'obs:(uuid,obsDatetime,voided,groupMembers,concept:(uuid,name:(uuid,name)),value:(uuid,name:(uuid,name),' +
  'names:(uuid,conceptNameType,name))),form:(uuid,name))';

/**
 * Fetches, sorts, and optionally filters the encounter history for a patient.
 *
 * Results are sorted newest-first and are cached immutably (no revalidation on
 * focus/reconnect) because encounter data changes only when the user explicitly
 * saves a form — in that case, call `onFormSave()` to trigger a revalidation.
 *
 * @param patientUuid   UUID of the patient whose encounters to fetch.
 * @param encounterType UUID of the encounter type to filter by.
 * @param encounterFilter Optional predicate applied after fetching — use this to
 *   further narrow encounters by obs values, date ranges, etc.
 *
 * @returns
 * - `encounters` — sorted + filtered array, empty array while loading or on error
 * - `isLoading` — true on first fetch
 * - `error` — fetch error if any
 * - `onFormSave` — stable callback; call it from a form submission handler to
 *   re-fetch and refresh the table without a full page reload
 * - `mutate` — raw SWR mutate for advanced invalidation scenarios
 *
 * @example
 * ```tsx
 * const { encounters, isLoading, onFormSave } = useEncounterRows(
 *   patientUuid,
 *   PRENATAL_ENCOUNTER_TYPE_UUID,
 *   (enc) => enc.obs.some((o) => o.concept.uuid === GESTATIONAL_AGE_UUID),
 * );
 * ```
 */
export function useEncounterRows(
  patientUuid: string,
  encounterType: string,
  encounterFilter: (encounter: OpenmrsEncounter) => boolean,
) {
  const url = `/ws/rest/v1/encounter?encounterType=${encounterType}&patient=${patientUuid}&v=${encounterRepresentation}`;

  const { data, error, isLoading, mutate } = useSWRImmutable<{ data: { results: Array<OpenmrsEncounter> } }, Error>(
    url,
    openmrsFetch,
  );

  const sortedAndFilteredEncounters = useMemo(() => {
    if (isNull(data?.data?.results) || !isLoading) {
      const sortedEncounters = sortEncounters(data?.data?.results);
      return encounterFilter ? sortedEncounters.filter(encounterFilter) : sortedEncounters;
    }
    return [];
  }, [data, encounterFilter, isLoading]);

  /** Stable callback — safe to pass as a prop or include in a dependency array. */
  const onFormSave = useCallback(() => {
    mutate();
  }, [mutate]);

  return {
    encounters: sortedAndFilteredEncounters,
    isLoading,
    error,
    onFormSave,
    mutate,
  };
}

/**
 * Returns a copy of `encounters` sorted descending by `encounterDatetime`.
 * Returns an empty array when the input is falsy or empty.
 */
function sortEncounters(encounters: OpenmrsEncounter[] | undefined): OpenmrsEncounter[] {
  if (!encounters?.length) return [];
  return [...encounters].sort(
    (a, b) => new Date(b.encounterDatetime).getTime() - new Date(a.encounterDatetime).getTime(),
  );
}
