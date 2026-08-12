import { restBaseUrl } from '@openmrs/esm-framework';
import { useCallback } from 'react';
import {
  type EncounterTypeSourceInput,
  toEncounterTypeSources,
  useMergedClinicalHistoryPagination,
} from './useClinicalHistoryPagination';

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
  form?: string | { uuid?: string } | null;
  encounterProviders: Array<{ display: string }>;
  obs: Obs[];
}

const visitNotesConceptUuids = {
  labOrdersUuid: '01fe9e3c-7150-42ca-87db-8813fa630129',
  proceduresUuid: 'f0000206-0000-4000-8000-000000000206',
  legacyProceduresUuid: '1651AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  legacyProceduresTextUuid: '162169AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  soapPlanUuid: '162169AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  // Consulta Externa stored therapeutic indications in the generic encounter-note
  // concept before the forms moved to a dedicated one. Encounters recorded then
  // still carry it, so both concepts stay readable.
  legacyTherapeuticIndicationsUuid: '162169AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  prescriptionsUuid: '1e9c5e02-b09f-41c6-83aa-dfed81bd0df5',
  referralUuid: '3f573194-bade-46bc-b5fd-59c36f5f697a',
  nextAppointmentUuid: '47ce3ee6-ee9f-4037-901b-2a6381c4b340',
} as const;

/** The form engine records each obs under `rfe-forms-<question id>`. */
const LEGACY_THERAPEUTIC_INDICATIONS_FIELD_PATH = 'rfe-forms-indicacionesTerapeuticas';
const FORM_ENGINE_FIELD_PATH_PREFIX = 'rfe-forms-';

/**
 * Question ids of the published CE-001 form whose answers the legacy concept
 * compatibility map still funnels into the generic encounter-note concept
 * (162169…). They are only distinguishable by formFieldPath, so each one must
 * be declared explicitly (via config) to become readable here.
 */
export interface LegacyCe001FieldPaths {
  labOrders?: string;
  prescriptions?: string;
  referral?: string;
  nextAppointment?: string;
}

function uniqueConceptUuids(values: Array<string | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

export function useTreatmentPlan(
  patientUuid: string,
  encounterType: EncounterTypeSourceInput | Array<EncounterTypeSourceInput>,
  concepts: Record<string, string>,
  legacyCe001FieldPaths: LegacyCe001FieldPaths = {},
) {
  const encounterTypes = toEncounterTypeSources(encounterType);
  const restrictedFormUuidKey = uniqueConceptUuids(encounterTypes.map(({ formUuid }) => formUuid))
    .sort()
    .join('|');
  const isEncounterFromRestrictedForm = useCallback(
    (encounter: Encounter) => {
      const formUuid = typeof encounter.form === 'string' ? encounter.form : encounter.form?.uuid;
      return Boolean(formUuid && restrictedFormUuidKey.split('|').includes(formUuid));
    },
    [restrictedFormUuidKey],
  );
  const sources = patientUuid
    ? encounterTypes.map(({ encounterTypeUuid, formUuid, visitTypeUuid }) => ({
        url: `${restBaseUrl}/encounter?patient=${patientUuid}&encounterType=${encounterTypeUuid}&order=desc&v=custom:(uuid,encounterDatetime,form:(uuid),visit:(uuid,visitType:(uuid)),encounterProviders:(display),obs:(uuid,concept:(uuid,display),value,display,formFieldPath))`,
        expectedFormUuid: formUuid,
        expectedVisitTypeUuid: visitTypeUuid,
      }))
    : null;

  const isRelevant = useCallback(
    (encounter: Encounter) => {
      const directConceptUuids = uniqueConceptUuids([
        concepts?.labOrdersUuid,
        concepts?.proceduresUuid,
        concepts?.prescriptionsUuid,
        concepts?.therapeuticIndicationsUuid,
        concepts?.referralUuid,
        concepts?.nextAppointmentUuid,
        visitNotesConceptUuids.labOrdersUuid,
        visitNotesConceptUuids.proceduresUuid,
        visitNotesConceptUuids.legacyProceduresUuid,
        visitNotesConceptUuids.prescriptionsUuid,
        visitNotesConceptUuids.referralUuid,
        visitNotesConceptUuids.nextAppointmentUuid,
      ]);
      const legacyPaths = new Set(
        [
          legacyCe001FieldPaths.labOrders,
          legacyCe001FieldPaths.prescriptions,
          legacyCe001FieldPaths.referral,
          legacyCe001FieldPaths.nextAppointment,
        ]
          .filter((path): path is string => Boolean(path))
          .map((path) => `${FORM_ENGINE_FIELD_PATH_PREFIX}${path}`),
      );
      return encounter.obs?.some((obs) => {
        if (directConceptUuids.includes(obs.concept?.uuid)) return true;
        if (obs.concept?.uuid !== visitNotesConceptUuids.legacyTherapeuticIndicationsUuid) return false;
        if (!obs.formFieldPath) return !isEncounterFromRestrictedForm(encounter);
        return (
          obs.formFieldPath === LEGACY_THERAPEUTIC_INDICATIONS_FIELD_PATH ||
          obs.formFieldPath === 'soap-plan' ||
          obs.formFieldPath === 'procedures' ||
          legacyPaths.has(obs.formFieldPath)
        );
      });
    },
    [concepts, isEncounterFromRestrictedForm, legacyCe001FieldPaths],
  );
  const { data, error, isLoading, isValidating, mutate, pagination, sourceErrors } =
    useMergedClinicalHistoryPagination<Encounter>(sources, isRelevant);

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

  // CE-001 answers rerouted into the generic note concept are only readable
  // through their question's formFieldPath; without it, nothing is read (the
  // concept alone also backs the free-text diagnosis).
  const getLegacyCe001Value = (obs: Obs[] | undefined, questionId: string | undefined) => {
    if (!questionId) return null;
    return getObsValue(
      obs,
      [visitNotesConceptUuids.legacyTherapeuticIndicationsUuid],
      `${FORM_ENGINE_FIELD_PATH_PREFIX}${questionId}`,
    );
  };

  const treatmentPlans: TreatmentPlanEntry[] = data
    .map((encounter) => ({
      encounterUuid: encounter.uuid,
      encounterDatetime: encounter.encounterDatetime,
      provider: encounter.encounterProviders?.[0]?.display?.split(' - ')?.[0] ?? null,
      labOrders:
        getObsValue(encounter.obs, [concepts?.labOrdersUuid, visitNotesConceptUuids.labOrdersUuid]) ??
        getLegacyCe001Value(encounter.obs, legacyCe001FieldPaths.labOrders),
      procedures:
        getObsValue(encounter.obs, [concepts?.proceduresUuid, visitNotesConceptUuids.proceduresUuid]) ??
        getObsValue(
          encounter.obs,
          [visitNotesConceptUuids.legacyProceduresTextUuid, visitNotesConceptUuids.legacyProceduresUuid],
          'procedures',
        ) ??
        getObsValue(encounter.obs, [concepts?.proceduresUuid, visitNotesConceptUuids.legacyProceduresUuid], null),
      prescriptions:
        getObsValue(encounter.obs, [concepts?.prescriptionsUuid, visitNotesConceptUuids.prescriptionsUuid]) ??
        getLegacyCe001Value(encounter.obs, legacyCe001FieldPaths.prescriptions),
      therapeuticIndications:
        getObsValue(encounter.obs, [visitNotesConceptUuids.soapPlanUuid], 'soap-plan') ??
        getObsValue(encounter.obs, [concepts?.therapeuticIndicationsUuid]) ??
        // The legacy concept also backs the free-text diagnosis, so it is only read
        // through the field that recorded indications — never by concept alone.
        getObsValue(
          encounter.obs,
          [visitNotesConceptUuids.legacyTherapeuticIndicationsUuid],
          LEGACY_THERAPEUTIC_INDICATIONS_FIELD_PATH,
        ) ??
        (isEncounterFromRestrictedForm(encounter)
          ? null
          : getObsValue(encounter.obs, [visitNotesConceptUuids.legacyTherapeuticIndicationsUuid], null)),
      referral:
        getObsValue(encounter.obs, [concepts?.referralUuid, visitNotesConceptUuids.referralUuid]) ??
        getLegacyCe001Value(encounter.obs, legacyCe001FieldPaths.referral),
      nextAppointment:
        getObsValue(encounter.obs, [concepts?.nextAppointmentUuid, visitNotesConceptUuids.nextAppointmentUuid]) ??
        getLegacyCe001Value(encounter.obs, legacyCe001FieldPaths.nextAppointment),
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
    isValidating,
    error,
    mutate,
    pagination,
    sourceErrors,
  };
}
