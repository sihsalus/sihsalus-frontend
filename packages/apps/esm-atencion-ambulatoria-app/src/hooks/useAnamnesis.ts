import { restBaseUrl } from '@openmrs/esm-framework';
import { useCallback } from 'react';
import {
  type AnamnesisConceptMap,
  type AnamnesisEncounter,
  hasAnamnesisData,
  mapEncounterToAnamnesisEntry,
} from '../anamnesis/anamnesis';
import {
  type EncounterTypeSourceInput,
  toEncounterTypeSources,
  useMergedClinicalHistoryPagination,
} from './useClinicalHistoryPagination';

export function useAnamnesis(
  patientUuid: string,
  encounterType: EncounterTypeSourceInput | Array<EncounterTypeSourceInput>,
  concepts: AnamnesisConceptMap,
) {
  const encounterTypes = toEncounterTypeSources(encounterType);
  const sources = patientUuid
    ? encounterTypes.map(({ encounterTypeUuid, formUuid, visitTypeUuid }) => ({
        url: `${restBaseUrl}/encounter?patient=${patientUuid}&encounterType=${encounterTypeUuid}&order=desc&v=custom:(uuid,encounterDatetime,form:(uuid),visit:(uuid,visitType:(uuid)),encounterProviders:(display),obs:(uuid,concept:(uuid,display),value,display))`,
        expectedFormUuid: formUuid,
        expectedVisitTypeUuid: visitTypeUuid,
      }))
    : null;

  const isRelevant = useCallback(
    (encounter: AnamnesisEncounter) => hasAnamnesisData(mapEncounterToAnamnesisEntry(encounter, concepts)),
    [concepts],
  );
  const { data, error, isLoading, isValidating, mutate, pagination } =
    useMergedClinicalHistoryPagination<AnamnesisEncounter>(sources, isRelevant);

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
