import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import useSWR from 'swr';

interface TreatmentPlanEntry {
  encounterUuid: string;
  encounterDatetime: string;
  provider: string | null;
  labOrders: string | null;
  procedures: string | null;
  prescriptions: string | null;
  therapeuticIndications: string | null;
  referral: string | null;
  nextAppointment: string | null;
}

interface Obs {
  uuid: string;
  concept: { uuid: string; display: string };
  value: string | { display: string } | null;
  display?: string;
  formFieldPath?: string;
}

interface Encounter {
  uuid: string;
  encounterDatetime: string;
  encounterProviders: Array<{ display: string }>;
  obs: Obs[];
}

const visitNotesConceptUuids = {
  labOrdersUuid: '01fe9e3c-7150-42ca-87db-8813fa630129',
  proceduresUuid: '162169AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  prescriptionsUuid: '1e9c5e02-b09f-41c6-83aa-dfed81bd0df5',
  referralUuid: '3f573194-bade-46bc-b5fd-59c36f5f697a',
  nextAppointmentUuid: '47ce3ee6-ee9f-4037-901b-2a6381c4b340',
} as const;

function uniqueConceptUuids(values: Array<string | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

export function useTreatmentPlan(patientUuid: string, encounterTypeUuid: string, concepts: Record<string, string>) {
  const url =
    patientUuid && encounterTypeUuid
      ? `${restBaseUrl}/encounter?patient=${patientUuid}&encounterType=${encounterTypeUuid}&v=custom:(uuid,encounterDatetime,encounterProviders:(display),obs:(uuid,concept:(uuid,display),value,display,formFieldPath))&limit=20`
      : null;

  const { data, error, isLoading, mutate } = useSWR<{ data: { results: Encounter[] } }>(url, openmrsFetch);

  const getObsValue = (
    obs: Obs[] | undefined,
    conceptUuids: Array<string | undefined>,
    formFieldPath?: string | null,
  ) => {
    if (!obs) return null;
    const candidateUuids = uniqueConceptUuids(conceptUuids);
    const match = obs.find(
      (o) =>
        candidateUuids.includes(o.concept?.uuid) &&
        (formFieldPath === undefined
          ? true
          : formFieldPath === null
            ? !o.formFieldPath
            : o.formFieldPath === formFieldPath),
    );
    if (!match) return null;
    return typeof match.value === 'string' ? match.value : (match.value?.display ?? match.display ?? null);
  };

  const treatmentPlans: TreatmentPlanEntry[] = (data?.data?.results ?? [])
    .map((encounter) => ({
      encounterUuid: encounter.uuid,
      encounterDatetime: encounter.encounterDatetime,
      provider: encounter.encounterProviders?.[0]?.display?.split(' - ')?.[0] ?? null,
      labOrders: getObsValue(encounter.obs, [concepts?.labOrdersUuid, visitNotesConceptUuids.labOrdersUuid]),
      procedures:
        getObsValue(encounter.obs, [visitNotesConceptUuids.proceduresUuid], 'procedures') ??
        getObsValue(encounter.obs, [concepts?.proceduresUuid], null),
      prescriptions: getObsValue(encounter.obs, [concepts?.prescriptionsUuid, visitNotesConceptUuids.prescriptionsUuid]),
      therapeuticIndications:
        getObsValue(encounter.obs, [visitNotesConceptUuids.proceduresUuid], 'soap-plan') ??
        getObsValue(encounter.obs, [concepts?.therapeuticIndicationsUuid], null),
      referral: getObsValue(encounter.obs, [concepts?.referralUuid, visitNotesConceptUuids.referralUuid]),
      nextAppointment: getObsValue(encounter.obs, [concepts?.nextAppointmentUuid, visitNotesConceptUuids.nextAppointmentUuid]),
    }))
    .filter(
      (entry) =>
        entry.labOrders ||
        entry.procedures ||
        entry.prescriptions ||
        entry.therapeuticIndications ||
        entry.referral ||
        entry.nextAppointment,
    );

  return {
    treatmentPlans,
    isLoading,
    error,
    mutate,
  };
}
