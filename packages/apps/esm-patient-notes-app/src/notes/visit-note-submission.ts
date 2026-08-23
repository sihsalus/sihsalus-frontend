import type {
  Diagnosis,
  EncounterDiagnosisPayload,
  ObsPayload,
  VisitNotePayload,
} from "../types";
import {
  buildTipoDxObs,
  getCertaintyForTipo,
  TIPO_DX_FIELD_PREFIX,
  TIPO_DX_FORM_FIELD_NAMESPACE,
} from "./visit-notes.resource";

type ResourceReference = string | { uuid?: string } | null | undefined;

export interface ExistingEncounterDiagnosis {
  uuid?: string;
  diagnosis?: {
    coded?: ResourceReference;
  };
  voided?: boolean;
}

export interface ExistingEncounterObs {
  concept?: {
    uuid?: string;
  };
  formFieldNamespace?: string;
  formFieldPath?: string;
  uuid?: string;
  value?: unknown;
  voided?: boolean;
}

export interface ExistingEncounterProvider {
  uuid?: string;
  encounterRole?: ResourceReference;
  provider?: ResourceReference;
}

export function getReferenceUuid(
  reference: ResourceReference,
): string | undefined {
  return typeof reference === "string" ? reference : reference?.uuid;
}

export function reconcileEncounterProviders(
  isEditing: boolean,
  existingProviders: Array<ExistingEncounterProvider>,
  currentProviderUuid: string | undefined,
  clinicianEncounterRole: string,
): VisitNotePayload["encounterProviders"] {
  const originalProviders = existingProviders.flatMap((encounterProvider) => {
    const provider = getReferenceUuid(encounterProvider.provider);
    const encounterRole = getReferenceUuid(encounterProvider.encounterRole);

    return provider && encounterRole
      ? [
          {
            ...(encounterProvider.uuid ? { uuid: encounterProvider.uuid } : {}),
            encounterRole,
            provider,
          },
        ]
      : [];
  });

  if (isEditing && originalProviders.length) {
    return originalProviders;
  }

  return currentProviderUuid && clinicianEncounterRole
    ? [{ encounterRole: clinicianEncounterRole, provider: currentProviderUuid }]
    : [];
}

function matchesObservation(
  observation: ExistingEncounterObs,
  conceptUuid: string,
  formFieldPath?: string,
): boolean {
  const hasMatchingPath = formFieldPath
    ? observation.formFieldPath === formFieldPath
    : !observation.formFieldPath;

  return (
    !observation.voided &&
    observation.concept?.uuid === conceptUuid &&
    hasMatchingPath
  );
}

export function findActiveObservation(
  encounterObs: Array<ExistingEncounterObs>,
  conceptUuid: string,
  formFieldPath?: string,
): ExistingEncounterObs | undefined {
  return encounterObs.find((observation) =>
    matchesObservation(observation, conceptUuid, formFieldPath),
  );
}

export function reconcileObservation(
  encounterObs: Array<ExistingEncounterObs>,
  conceptUuid: string,
  value?: string,
  formFieldPath?: string,
): Array<ObsPayload> {
  const activeMatches = encounterObs.filter((observation) =>
    matchesObservation(observation, conceptUuid, formFieldPath),
  );
  const trimmedValue = value?.trim();

  if (!trimmedValue) {
    return activeMatches.flatMap((observation) =>
      observation.uuid
        ? [{ uuid: observation.uuid, voided: true as const }]
        : [],
    );
  }

  const existingObservation = activeMatches[0];
  const updatedObservation: ObsPayload = {
    concept: { uuid: conceptUuid, display: "" },
    value: trimmedValue,
    ...(formFieldPath && {
      formFieldNamespace: TIPO_DX_FORM_FIELD_NAMESPACE,
      formFieldPath,
    }),
    ...(existingObservation?.uuid ? { uuid: existingObservation.uuid } : {}),
  };
  const duplicateVoids = activeMatches
    .slice(1)
    .flatMap((observation) =>
      observation.uuid
        ? [{ uuid: observation.uuid, voided: true as const }]
        : [],
    );

  return [updatedObservation, ...duplicateVoids];
}

function getDiagnosisCodedUuid(
  diagnosis: ExistingEncounterDiagnosis,
): string | undefined {
  return getReferenceUuid(diagnosis.diagnosis?.coded);
}

export function reconcileEncounterDiagnoses(
  selectedDiagnoses: Array<Diagnosis>,
  existingDiagnoses: Array<ExistingEncounterDiagnosis>,
  diagnosisTipos: Record<string, string>,
  diagnosisTypePresuntivoUuid: string,
  diagnosisTypeDefinitivoUuid: string,
  patientUuid: string,
): Array<EncounterDiagnosisPayload> {
  const activeExistingDiagnoses = existingDiagnoses.filter(
    (diagnosis) => !diagnosis.voided,
  );
  const usedExistingIndexes = new Set<number>();
  const selectedCodedUuids = new Set<string>();
  const payload: Array<EncounterDiagnosisPayload> = [];

  for (const selectedDiagnosis of selectedDiagnoses) {
    const codedUuid = selectedDiagnosis.diagnosis.coded;
    if (!codedUuid || selectedCodedUuids.has(codedUuid)) {
      continue;
    }
    selectedCodedUuids.add(codedUuid);

    const existingIndex = activeExistingDiagnoses.findIndex(
      (diagnosis, index) =>
        !usedExistingIndexes.has(index) &&
        getDiagnosisCodedUuid(diagnosis) === codedUuid,
    );
    const existingDiagnosis =
      existingIndex >= 0 ? activeExistingDiagnoses[existingIndex] : undefined;
    if (existingIndex >= 0) {
      usedExistingIndexes.add(existingIndex);
    }
    const tipoUuid = diagnosisTipos[codedUuid] ?? diagnosisTypePresuntivoUuid;

    payload.push({
      ...(existingDiagnosis?.uuid ? { uuid: existingDiagnosis.uuid } : {}),
      patient: patientUuid,
      condition: null,
      diagnosis: { coded: codedUuid },
      certainty: getCertaintyForTipo(tipoUuid, diagnosisTypeDefinitivoUuid),
      rank: selectedDiagnosis.rank,
    });
  }

  activeExistingDiagnoses.forEach((diagnosis, index) => {
    if (!usedExistingIndexes.has(index) && diagnosis.uuid) {
      payload.push({ uuid: diagnosis.uuid, voided: true });
    }
  });

  return payload;
}

export function reconcileDiagnosisTypeObservations(
  selectedDiagnoses: Array<Diagnosis>,
  encounterObs: Array<ExistingEncounterObs>,
  diagnosisTipos: Record<string, string>,
  diagnosisTypeConceptUuid: string,
  diagnosisTypePresuntivoUuid: string,
): Array<ObsPayload> {
  const selectedPaths = new Set<string>();
  const payload: Array<ObsPayload> = [];

  selectedDiagnoses.forEach((diagnosis) => {
    const codedUuid = diagnosis.diagnosis.coded;
    if (!codedUuid) {
      return;
    }
    const formFieldPath = `${TIPO_DX_FIELD_PREFIX}${codedUuid}`;
    if (selectedPaths.has(formFieldPath)) {
      return;
    }
    selectedPaths.add(formFieldPath);

    const tipoObs = buildTipoDxObs(
      diagnosisTypeConceptUuid,
      codedUuid,
      diagnosisTipos[codedUuid] ?? diagnosisTypePresuntivoUuid,
    );
    payload.push(
      ...reconcileObservation(
        encounterObs,
        tipoObs.concept.uuid,
        tipoObs.value,
        tipoObs.formFieldPath,
      ),
    );
  });

  encounterObs.forEach((observation) => {
    if (
      !observation.voided &&
      observation.uuid &&
      observation.concept?.uuid === diagnosisTypeConceptUuid &&
      observation.formFieldNamespace === TIPO_DX_FORM_FIELD_NAMESPACE &&
      observation.formFieldPath?.startsWith(TIPO_DX_FIELD_PREFIX) &&
      !selectedPaths.has(observation.formFieldPath)
    ) {
      payload.push({ uuid: observation.uuid, voided: true });
    }
  });

  return payload;
}
