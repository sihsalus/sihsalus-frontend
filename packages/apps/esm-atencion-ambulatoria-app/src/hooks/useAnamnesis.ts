import { restBaseUrl } from '@openmrs/esm-framework';
import {
  type AnamnesisConceptMap,
  type AnamnesisEncounter,
  hasAnamnesisData,
  mapEncounterToAnamnesisEntry,
} from '../anamnesis/anamnesis';
import { useClinicalHistoryPagination } from './useClinicalHistoryPagination';

export function useAnamnesis(patientUuid: string, encounterTypeUuid: string, concepts: AnamnesisConceptMap) {
  const url =
    patientUuid && encounterTypeUuid
      ? `${restBaseUrl}/encounter?patient=${patientUuid}&encounterType=${encounterTypeUuid}&order=desc&v=custom:(uuid,encounterDatetime,encounterProviders:(display),obs:(uuid,concept:(uuid,display),value,display))`
      : null;

  const { data, error, isLoading, isValidating, mutate, pagination } =
    useClinicalHistoryPagination<AnamnesisEncounter>(url);

  // Anamnesis is a clinical subdomain of the encounter. We derive it from
  // encounter obs so specialty forms can contribute without a separate app.
  const anamnesisEntries = data
    .map((encounter) => mapEncounterToAnamnesisEntry(encounter, concepts))
    .filter(hasAnamnesisData);

  return {
    anamnesisEntries,
    isLoading,
    isValidating,
    error,
    mutate,
    pagination,
  };
}
