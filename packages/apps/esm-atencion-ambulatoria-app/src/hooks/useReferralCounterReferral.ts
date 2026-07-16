import { restBaseUrl } from '@openmrs/esm-framework';
import { useClinicalHistoryPagination } from './useClinicalHistoryPagination';

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
}

interface Encounter {
  uuid: string;
  encounterDatetime: string;
  encounterProviders: Array<{ display: string }>;
  obs: Obs[];
}

const visitNotesReferralConceptUuid = '3f573194-bade-46bc-b5fd-59c36f5f697a';
const legacyReferralConceptUuid = '1272AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

function uniqueConceptUuids(values: Array<string | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function getObsValue(obs: Obs[], conceptUuid: string | undefined): string | null {
  if (!obs || !conceptUuid) return null;
  const match = obs.find((o) => o.concept?.uuid === conceptUuid);
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

export function useReferralCounterReferral(
  patientUuid: string,
  referralCounterReferralEncounterTypeUuid: string,
  externalConsultationEncounterTypeUuid: string,
  concepts: {
    referralUuid?: string;
    referralConceptUuid?: string;
    referralTypeUuid?: string;
    referralReasonUuid?: string;
    referralDestinationUuid?: string;
    counterReferralResponseUuid?: string;
  },
) {
  const referralCounterReferralUrl =
    patientUuid && referralCounterReferralEncounterTypeUuid
      ? `${restBaseUrl}/encounter?patient=${patientUuid}&encounterType=${referralCounterReferralEncounterTypeUuid}` +
        `&v=custom:(uuid,encounterDatetime,encounterProviders:(display),obs:(concept:(uuid),value))&order=desc`
      : null;
  const interconsultationOrdersUrl =
    patientUuid && externalConsultationEncounterTypeUuid
      ? `${restBaseUrl}/encounter?patient=${patientUuid}&encounterType=${externalConsultationEncounterTypeUuid}` +
        `&v=custom:(uuid,encounterDatetime,encounterProviders:(display),obs:(concept:(uuid),value,display))&order=desc`
      : null;

  const {
    data: referralEncounters,
    error: referralError,
    isLoading: isLoadingReferrals,
    isValidating: isValidatingReferrals,
    mutate: mutateReferrals,
    pagination: referralPagination,
  } = useClinicalHistoryPagination<Encounter>(referralCounterReferralUrl);
  const {
    data: orderEncounters,
    error: orderError,
    isLoading: isLoadingOrders,
    isValidating: isValidatingOrders,
    mutate: mutateOrders,
    pagination: orderPagination,
  } = useClinicalHistoryPagination<Encounter>(interconsultationOrdersUrl);

  const referralTotalPages = Number.isFinite(referralPagination.totalPages) ? referralPagination.totalPages : 0;
  const orderTotalPages = Number.isFinite(orderPagination.totalPages) ? orderPagination.totalPages : 0;
  const currentPage = Math.max(referralPagination.currentPage, orderPagination.currentPage);
  const totalPages = Math.max(referralTotalPages, orderTotalPages);

  const visibleReferralEncounters =
    referralPagination.currentPage === currentPage ? referralEncounters : ([] as Encounter[]);
  const visibleOrderEncounters = orderPagination.currentPage === currentPage ? orderEncounters : ([] as Encounter[]);

  const structuredReferrals: ReferralEntry[] = visibleReferralEncounters.map((enc) => ({
    uuid: enc.uuid,
    encounterDatetime: enc.encounterDatetime,
    provider: enc.encounterProviders?.[0]?.display?.split(' - ')?.[0] ?? null,
    source: 'referralCounterReferral',
    referralType: getObsValue(enc.obs, concepts.referralTypeUuid),
    referralReason: getObsValue(enc.obs, concepts.referralReasonUuid),
    referralDestination: getObsValue(enc.obs, concepts.referralDestinationUuid),
    counterReferralResponse: getObsValue(enc.obs, concepts.counterReferralResponseUuid),
    interconsultationOrder: null,
  }));

  const interconsultationOrders: ReferralEntry[] = visibleOrderEncounters
    .map((enc): ReferralEntry | null => {
      const order = getFirstObsValue(enc.obs, [
        concepts.referralUuid,
        concepts.referralConceptUuid,
        visitNotesReferralConceptUuid,
        legacyReferralConceptUuid,
      ]);
      if (!order) {
        return null;
      }

      return {
        uuid: `${enc.uuid}-interconsultation-order`,
        encounterDatetime: enc.encounterDatetime,
        provider: enc.encounterProviders?.[0]?.display?.split(' - ')?.[0] ?? null,
        source: 'interconsultationOrder',
        referralType: null,
        referralReason: null,
        referralDestination: null,
        counterReferralResponse: null,
        interconsultationOrder: order,
      } satisfies ReferralEntry;
    })
    .filter((entry): entry is ReferralEntry => Boolean(entry));

  const entries = [...structuredReferrals, ...interconsultationOrders].sort(
    (a, b) => new Date(b.encounterDatetime).getTime() - new Date(a.encounterDatetime).getTime(),
  );

  return {
    entries,
    isLoading: isLoadingReferrals || isLoadingOrders,
    isValidating: isValidatingReferrals || isValidatingOrders,
    error: referralError || orderError,
    mutate: () => {
      void mutateReferrals();
      void mutateOrders();
    },
    pagination: {
      currentPage,
      totalPages,
      onPageChange: (page: number) => {
        if (page <= referralTotalPages) {
          referralPagination.onPageChange(page);
        }
        if (page <= orderTotalPages) {
          orderPagination.onPageChange(page);
        }
      },
    },
  };
}
