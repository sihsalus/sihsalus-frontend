import { restBaseUrl } from '@openmrs/esm-framework';
import { useCallback } from 'react';
import {
  type EncounterTypeSourceInput,
  toEncounterTypeSources,
  useMergedClinicalHistoryPagination,
} from './useClinicalHistoryPagination';

export interface ReferralEntry {
  uuid: string;
  encounterDatetime: string;
  provider: string | null;
  source: 'referralCounterReferral' | 'interconsultationOrder';
  // OBS values — populated once the CE-REF form maps these concepts
  referralType: string | null; // Tipo: Emergencia | Urgencia | Electiva
  referralReason: string | null; // Motivo de referencia (texto libre)
  referralDestination: string | null; // Establecimiento destino
  counterReferralResponse: string | null; // Respuesta de contrarreferencia
  interconsultationOrder: string | null;
}

interface Obs {
  concept: { uuid: string };
  value: string | { display?: string; uuid?: string } | null;
  display?: string;
  formFieldPath?: string;
}

interface Encounter {
  uuid: string;
  encounterDatetime: string;
  encounterType?: string | { uuid?: string };
  encounterProviders: Array<{ display: string }>;
  obs: Obs[];
}

interface ReferralConcepts {
  referralUuid?: string;
  referralConceptUuid?: string;
  referralTypeUuid?: string;
  referralReasonUuid?: string;
  referralDestinationUuid?: string;
  counterReferralResponseUuid?: string;
}

const visitNotesReferralConceptUuid = '3f573194-bade-46bc-b5fd-59c36f5f697a';
const legacyReferralConceptUuid = '1272AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const ce001ReferralConceptUuid = 'f0000205-0000-4000-8000-000000000205';
const legacyEncounterNoteConceptUuid = '162169AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const ce001ReferralFieldPath = 'rfe-forms-referencia';

function uniqueConceptUuids(values: Array<string | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function getObsValue(obs: Obs[], conceptUuid: string | undefined): string | null {
  if (!obs || !conceptUuid) return null;
  const match = obs.find((o) => o.concept?.uuid === conceptUuid);
  if (!match) return null;
  return typeof match.value === 'string' ? match.value : (match.value?.display ?? match.display ?? null);
}

function getObsValueByFieldPath(obs: Obs[], conceptUuid: string, formFieldPath: string): string | null {
  const match = obs?.find((item) => item.concept?.uuid === conceptUuid && item.formFieldPath === formFieldPath);
  if (!match) return null;
  return typeof match.value === 'string' ? match.value : (match.value?.display ?? match.display ?? null);
}

function getFirstObsValue(obs: Obs[], conceptUuids: Array<string | undefined>): string | null {
  for (const conceptUuid of uniqueConceptUuids(conceptUuids)) {
    const value = getObsValue(obs, conceptUuid);
    if (value?.trim()) {
      return value;
    }
  }

  return null;
}

function getEncounterTypeUuid(encounter: Encounter): string | undefined {
  return typeof encounter.encounterType === 'string' ? encounter.encounterType : encounter.encounterType?.uuid;
}

function getInterconsultationOrder(encounter: Encounter, concepts: ReferralConcepts): string | null {
  return (
    getFirstObsValue(encounter.obs, [
      concepts.referralUuid,
      concepts.referralConceptUuid,
      visitNotesReferralConceptUuid,
      ce001ReferralConceptUuid,
      legacyReferralConceptUuid,
    ]) ?? getObsValueByFieldPath(encounter.obs, legacyEncounterNoteConceptUuid, ce001ReferralFieldPath)
  );
}

export function useReferralCounterReferral(
  patientUuid: string,
  referralCounterReferralEncounterTypeUuid: string,
  externalConsultationEncounterType: EncounterTypeSourceInput | Array<EncounterTypeSourceInput>,
  concepts: ReferralConcepts,
) {
  const interconsultationEncounterTypes = toEncounterTypeSources(externalConsultationEncounterType);
  const sources = patientUuid
    ? [
        ...(referralCounterReferralEncounterTypeUuid
          ? [
              {
                url:
                  `${restBaseUrl}/encounter?patient=${patientUuid}&encounterType=${referralCounterReferralEncounterTypeUuid}` +
                  `&v=custom:(uuid,encounterDatetime,form:(uuid),encounterType:(uuid),encounterProviders:(display),obs:(concept:(uuid),value,display,formFieldPath))&order=desc`,
              },
            ]
          : []),
        ...interconsultationEncounterTypes.map(({ encounterTypeUuid, formUuid, visitTypeUuid }) => ({
          url:
            `${restBaseUrl}/encounter?patient=${patientUuid}&encounterType=${encounterTypeUuid}` +
            `&v=custom:(uuid,encounterDatetime,form:(uuid),visit:(uuid,visitType:(uuid)),encounterType:(uuid),encounterProviders:(display),obs:(concept:(uuid),value,display,formFieldPath))&order=desc`,
          expectedFormUuid: formUuid,
          expectedVisitTypeUuid: visitTypeUuid,
        })),
      ]
    : null;

  const isRelevant = useCallback(
    (encounter: Encounter) =>
      getEncounterTypeUuid(encounter) === referralCounterReferralEncounterTypeUuid ||
      Boolean(getInterconsultationOrder(encounter, concepts)),
    [concepts, referralCounterReferralEncounterTypeUuid],
  );
  const { data, error, isLoading, isValidating, mutate, pagination, sourceErrors } =
    useMergedClinicalHistoryPagination<Encounter>(sources, isRelevant);

  const entries = data
    .map((encounter): ReferralEntry | null => {
      const provider = encounter.encounterProviders?.[0]?.display?.split(' - ')?.[0] ?? null;
      if (getEncounterTypeUuid(encounter) === referralCounterReferralEncounterTypeUuid) {
        return {
          uuid: encounter.uuid,
          encounterDatetime: encounter.encounterDatetime,
          provider,
          source: 'referralCounterReferral',
          referralType: getObsValue(encounter.obs, concepts.referralTypeUuid),
          referralReason: getObsValue(encounter.obs, concepts.referralReasonUuid),
          referralDestination: getObsValue(encounter.obs, concepts.referralDestinationUuid),
          counterReferralResponse: getObsValue(encounter.obs, concepts.counterReferralResponseUuid),
          interconsultationOrder: null,
        };
      }

      const order = getInterconsultationOrder(encounter, concepts);
      return order
        ? {
            uuid: `${encounter.uuid}-interconsultation-order`,
            encounterDatetime: encounter.encounterDatetime,
            provider,
            source: 'interconsultationOrder',
            referralType: null,
            referralReason: null,
            referralDestination: null,
            counterReferralResponse: null,
            interconsultationOrder: order,
          }
        : null;
    })
    .filter((entry): entry is ReferralEntry => Boolean(entry));

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
