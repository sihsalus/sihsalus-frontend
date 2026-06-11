import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import useSWR from 'swr';
import {
  type AnamnesisConceptMap,
  type AnamnesisEncounter,
  hasAnamnesisData,
  mapEncounterToAnamnesisEntry,
} from '../anamnesis/anamnesis';

export function useAnamnesis(patientUuid: string, encounterTypeUuid: string, concepts: AnamnesisConceptMap) {
  const url =
    patientUuid && encounterTypeUuid
      ? `${restBaseUrl}/encounter?patient=${patientUuid}&encounterType=${encounterTypeUuid}&v=custom:(uuid,encounterDatetime,encounterProviders:(display),obs:(uuid,concept:(uuid,display),value,display))&limit=20`
      : null;

  const { data, error, isLoading, mutate } = useSWR<{ data: { results: AnamnesisEncounter[] } }>(url, openmrsFetch);

  // Anamnesis is a clinical subdomain of the encounter. We derive it from
  // encounter obs so specialty forms can contribute without a separate app.
  const anamnesisEntries = (data?.data?.results ?? [])
    .map((encounter) => mapEncounterToAnamnesisEntry(encounter, concepts))
    .filter(hasAnamnesisData);

  return {
    anamnesisEntries,
    isLoading,
    error,
    mutate,
  };
}
