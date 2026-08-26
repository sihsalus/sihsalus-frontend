import { restBaseUrl } from '@openmrs/esm-framework';
import { useCallback } from 'react';
import { parseReferralDestination } from '../consulta-externa/institutional-referral.resource';
import { useMergedClinicalHistoryPagination } from './useClinicalHistoryPagination';

export interface ReferralEntry {
  uuid: string;
  visitUuid: string | null;
  encounterDatetime: string;
  provider: string | null;
  // OBS values — populated once the CE-REF form maps these concepts
  referralType: string | null; // Tipo: Emergencia | Urgencia | Electiva
  referralReason: string | null; // Motivo de referencia (texto libre)
  referralDestination: string | null; // Establecimiento destino
  referralDestinationCode: string | null; // Código RENIPRESS persistido con el destino
  referralDestinationSpecialty: string | null;
  referralDestinationSpecialtyOther: string | null;
  referralPatientCondition: string | null;
  referralTransportMode: string | null;
  counterReferralResponse: string | null; // Respuesta de contrarreferencia
  counterReferralCondition: string | null; // Condición del paciente al retorno
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
  visit?: string | { uuid?: string; visitType?: string | { uuid?: string } | null } | null;
  encounterProviders: Array<{ display: string }>;
  obs: Obs[];
}

interface ReferralConcepts {
  referralTypeUuid?: string;
  referralReasonUuid?: string;
  referralDestinationUuid?: string;
  referralDestinationSpecialtyUuid?: string;
  referralDestinationSpecialtyOtherUuid?: string;
  referralPatientConditionUuid?: string;
  referralTransportModeUuid?: string;
  counterReferralResponseUuid?: string;
  counterReferralConditionUuid?: string;
}

export type ReferralHistoryView = 'all' | 'referrals' | 'counterReferrals';

function getObsValue(obs: Obs[], conceptUuid: string | undefined): string | null {
  if (!obs || !conceptUuid) return null;
  const match = obs.find((o) => o.concept?.uuid === conceptUuid);
  if (!match) return null;
  return typeof match.value === 'string' ? match.value : (match.value?.display ?? match.display ?? null);
}

function getEncounterTypeUuid(encounter: Encounter): string | undefined {
  return typeof encounter.encounterType === 'string' ? encounter.encounterType : encounter.encounterType?.uuid;
}

function getEncounterVisitUuid(encounter: Encounter): string | null {
  if (!encounter.visit) return null;
  return typeof encounter.visit === 'string' ? encounter.visit : (encounter.visit.uuid ?? null);
}

export function useReferralCounterReferral(
  patientUuid: string,
  referralCounterReferralEncounterTypeUuid: string,
  concepts: ReferralConcepts,
  view: ReferralHistoryView = 'all',
) {
  const sources =
    patientUuid && referralCounterReferralEncounterTypeUuid
      ? [
          {
            url:
              `${restBaseUrl}/encounter?patient=${patientUuid}&encounterType=${referralCounterReferralEncounterTypeUuid}` +
              `&v=custom:(uuid,encounterDatetime,encounterType:(uuid),visit:(uuid),encounterProviders:(display),obs:(concept:(uuid),value,display))&order=desc`,
          },
        ]
      : null;

  const isRelevant = useCallback(
    (encounter: Encounter) => {
      if (getEncounterTypeUuid(encounter) !== referralCounterReferralEncounterTypeUuid) return false;
      if (view === 'all') return true;

      const hasCounterReferralData = Boolean(
        getObsValue(encounter.obs, concepts.counterReferralResponseUuid) ||
          getObsValue(encounter.obs, concepts.counterReferralConditionUuid),
      );
      if (view === 'counterReferrals') return hasCounterReferralData;

      const hasReferralData = Boolean(
        getObsValue(encounter.obs, concepts.referralTypeUuid) ||
          getObsValue(encounter.obs, concepts.referralReasonUuid) ||
          getObsValue(encounter.obs, concepts.referralDestinationUuid),
      );
      // Keep legacy/empty referral encounters visible so a missing form mapping
      // is not silently presented as an empty clinical history.
      return hasReferralData || !hasCounterReferralData;
    },
    [
      concepts.counterReferralConditionUuid,
      concepts.counterReferralResponseUuid,
      concepts.referralDestinationUuid,
      concepts.referralReasonUuid,
      concepts.referralTypeUuid,
      referralCounterReferralEncounterTypeUuid,
      view,
    ],
  );
  const { data, error, isLoading, isValidating, mutate, pagination, sourceErrors } =
    useMergedClinicalHistoryPagination<Encounter>(sources, isRelevant);

  const entries: Array<ReferralEntry> = data
    .filter((encounter) => getEncounterTypeUuid(encounter) === referralCounterReferralEncounterTypeUuid)
    .map((encounter) => {
      const destination = parseReferralDestination(getObsValue(encounter.obs, concepts.referralDestinationUuid));
      return {
        uuid: encounter.uuid,
        visitUuid: getEncounterVisitUuid(encounter),
        encounterDatetime: encounter.encounterDatetime,
        provider: encounter.encounterProviders?.[0]?.display?.split(' - ')?.[0] ?? null,
        referralType: getObsValue(encounter.obs, concepts.referralTypeUuid),
        referralReason: getObsValue(encounter.obs, concepts.referralReasonUuid),
        referralDestination: destination.name || null,
        referralDestinationCode: destination.renaesCode,
        referralDestinationSpecialty: getObsValue(encounter.obs, concepts.referralDestinationSpecialtyUuid),
        referralDestinationSpecialtyOther: getObsValue(encounter.obs, concepts.referralDestinationSpecialtyOtherUuid),
        referralPatientCondition: getObsValue(encounter.obs, concepts.referralPatientConditionUuid),
        referralTransportMode: getObsValue(encounter.obs, concepts.referralTransportModeUuid),
        counterReferralResponse: getObsValue(encounter.obs, concepts.counterReferralResponseUuid),
        counterReferralCondition: getObsValue(encounter.obs, concepts.counterReferralConditionUuid),
      };
    });

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
