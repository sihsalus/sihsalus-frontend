import { restBaseUrl } from '@openmrs/esm-framework';
import { useCallback } from 'react';
import { useMergedClinicalHistoryPagination } from './useClinicalHistoryPagination';

export interface ReferralEntry {
  uuid: string;
  encounterDatetime: string;
  provider: string | null;
  // OBS values — populated once the CE-REF form maps these concepts
  referralType: string | null; // Tipo: Emergencia | Urgencia | Electiva
  referralReason: string | null; // Motivo de referencia (texto libre)
  referralDestination: string | null; // Establecimiento destino
  counterReferralResponse: string | null; // Respuesta de contrarreferencia
}

interface Obs {
  concept: { uuid: string };
  value: string | { display?: string; uuid?: string } | null;
  display?: string;
}

interface Encounter {
  uuid: string;
  encounterDatetime: string;
  encounterType?: string | { uuid?: string };
  encounterProviders: Array<{ display: string }>;
  obs: Obs[];
}

interface ReferralConcepts {
  referralTypeUuid?: string;
  referralReasonUuid?: string;
  referralDestinationUuid?: string;
  counterReferralResponseUuid?: string;
}

function getObsValue(obs: Obs[], conceptUuid: string | undefined): string | null {
  if (!obs || !conceptUuid) return null;
  const match = obs.find((o) => o.concept?.uuid === conceptUuid);
  if (!match) return null;
  return typeof match.value === 'string' ? match.value : (match.value?.display ?? match.display ?? null);
}

function getEncounterTypeUuid(encounter: Encounter): string | undefined {
  return typeof encounter.encounterType === 'string' ? encounter.encounterType : encounter.encounterType?.uuid;
}

export function useReferralCounterReferral(
  patientUuid: string,
  referralCounterReferralEncounterTypeUuid: string,
  concepts: ReferralConcepts,
) {
  const sources =
    patientUuid && referralCounterReferralEncounterTypeUuid
      ? [
          {
            url:
              `${restBaseUrl}/encounter?patient=${patientUuid}&encounterType=${referralCounterReferralEncounterTypeUuid}` +
              `&v=custom:(uuid,encounterDatetime,encounterType:(uuid),encounterProviders:(display),obs:(concept:(uuid),value,display))&order=desc`,
          },
        ]
      : null;

  const isRelevant = useCallback(
    (encounter: Encounter) => getEncounterTypeUuid(encounter) === referralCounterReferralEncounterTypeUuid,
    [referralCounterReferralEncounterTypeUuid],
  );
  const { data, error, isLoading, isValidating, mutate, pagination, sourceErrors } =
    useMergedClinicalHistoryPagination<Encounter>(sources, isRelevant);

  const entries: Array<ReferralEntry> = data
    .filter((encounter) => getEncounterTypeUuid(encounter) === referralCounterReferralEncounterTypeUuid)
    .map((encounter) => ({
      uuid: encounter.uuid,
      encounterDatetime: encounter.encounterDatetime,
      provider: encounter.encounterProviders?.[0]?.display?.split(' - ')?.[0] ?? null,
      referralType: getObsValue(encounter.obs, concepts.referralTypeUuid),
      referralReason: getObsValue(encounter.obs, concepts.referralReasonUuid),
      referralDestination: getObsValue(encounter.obs, concepts.referralDestinationUuid),
      counterReferralResponse: getObsValue(encounter.obs, concepts.counterReferralResponseUuid),
    }));

  return {
    entries,
    isLoading,
    isValidating,
    error,
    mutate,
    pagination,
    sourceErrors,
  };
}
