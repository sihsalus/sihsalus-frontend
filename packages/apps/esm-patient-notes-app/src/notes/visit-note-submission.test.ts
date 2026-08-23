import type { Diagnosis } from "../types";
import {
  TIPO_DX_FIELD_PREFIX,
  TIPO_DX_FORM_FIELD_NAMESPACE,
} from "./visit-notes.resource";
import {
  reconcileDiagnosisTypeObservations,
  reconcileEncounterDiagnoses,
  reconcileEncounterProviders,
  reconcileObservation,
} from "./visit-note-submission";

const patientUuid = "synthetic-patient-uuid";
const presuntivoUuid = "tipo-presuntivo-uuid";
const definitivoUuid = "tipo-definitivo-uuid";
const diagnosisTypeConceptUuid = "tipo-diagnostico-concept-uuid";

function selectedDiagnosis(
  coded: string,
  rank: number,
  tipoConceptUuid = presuntivoUuid,
): Diagnosis {
  return {
    patient: patientUuid,
    diagnosis: { coded },
    certainty: "PROVISIONAL",
    rank,
    display: coded,
    tipoConceptUuid,
  };
}

test("preserves the original encounter-provider assignments when editing and falls back only when absent", () => {
  expect(
    reconcileEncounterProviders(
      true,
      [
        {
          uuid: "encounter-provider-assignment-uuid",
          encounterRole: { uuid: "original-role-uuid" },
          provider: { uuid: "original-provider-uuid" },
        },
      ],
      "current-editor-provider-uuid",
      "configured-role-uuid",
    ),
  ).toEqual([
    {
      uuid: "encounter-provider-assignment-uuid",
      encounterRole: "original-role-uuid",
      provider: "original-provider-uuid",
    },
  ]);

  expect(
    reconcileEncounterProviders(
      true,
      [],
      "current-editor-provider-uuid",
      "configured-role-uuid",
    ),
  ).toEqual([
    {
      encounterRole: "configured-role-uuid",
      provider: "current-editor-provider-uuid",
    },
  ]);
});

test("reuses an obs UUID, voids a cleared obs, and removes duplicates instead of accumulating them", () => {
  const existingObs = [
    { uuid: "obs-keep", concept: { uuid: "text-concept" }, value: "old value" },
    {
      uuid: "obs-duplicate",
      concept: { uuid: "text-concept" },
      value: "duplicate",
    },
    {
      uuid: "obs-other-path",
      concept: { uuid: "text-concept" },
      value: "must remain untouched",
      formFieldPath: "soap-plan",
    },
  ];

  expect(
    reconcileObservation(existingObs, "text-concept", "new value"),
  ).toEqual([
    {
      uuid: "obs-keep",
      concept: { uuid: "text-concept", display: "" },
      value: "new value",
    },
    { uuid: "obs-duplicate", voided: true },
  ]);
  expect(reconcileObservation(existingObs, "text-concept", "   ")).toEqual([
    { uuid: "obs-keep", voided: true },
    { uuid: "obs-duplicate", voided: true },
  ]);
});

test("reconciles retained, removed, duplicate, and new diagnoses in the encounter payload", () => {
  const selected = [
    selectedDiagnosis("cie10-retained", 1),
    selectedDiagnosis("cie10-new", 2),
  ];
  const existing = [
    {
      uuid: "diagnosis-retained-uuid",
      diagnosis: { coded: { uuid: "cie10-retained" } },
    },
    {
      uuid: "diagnosis-retained-duplicate-uuid",
      diagnosis: { coded: { uuid: "cie10-retained" } },
    },
    {
      uuid: "diagnosis-removed-uuid",
      diagnosis: { coded: { uuid: "cie10-removed" } },
    },
  ];

  expect(
    reconcileEncounterDiagnoses(
      selected,
      existing,
      { "cie10-retained": definitivoUuid },
      presuntivoUuid,
      definitivoUuid,
      patientUuid,
    ),
  ).toEqual([
    {
      uuid: "diagnosis-retained-uuid",
      patient: patientUuid,
      condition: null,
      diagnosis: { coded: "cie10-retained" },
      certainty: "CONFIRMED",
      rank: 1,
    },
    {
      patient: patientUuid,
      condition: null,
      diagnosis: { coded: "cie10-new" },
      certainty: "PROVISIONAL",
      rank: 2,
    },
    { uuid: "diagnosis-retained-duplicate-uuid", voided: true },
    { uuid: "diagnosis-removed-uuid", voided: true },
  ]);
});

test("reuses P/D/R obs UUIDs and voids types for removed diagnoses", () => {
  const retainedPath = `${TIPO_DX_FIELD_PREFIX}cie10-retained`;
  const removedPath = `${TIPO_DX_FIELD_PREFIX}cie10-removed`;
  const existingObs = [
    {
      uuid: "tipo-retained-uuid",
      concept: { uuid: diagnosisTypeConceptUuid },
      formFieldNamespace: TIPO_DX_FORM_FIELD_NAMESPACE,
      formFieldPath: retainedPath,
      value: presuntivoUuid,
    },
    {
      uuid: "tipo-retained-duplicate-uuid",
      concept: { uuid: diagnosisTypeConceptUuid },
      formFieldNamespace: TIPO_DX_FORM_FIELD_NAMESPACE,
      formFieldPath: retainedPath,
      value: presuntivoUuid,
    },
    {
      uuid: "tipo-removed-uuid",
      concept: { uuid: diagnosisTypeConceptUuid },
      formFieldNamespace: TIPO_DX_FORM_FIELD_NAMESPACE,
      formFieldPath: removedPath,
      value: definitivoUuid,
    },
  ];

  expect(
    reconcileDiagnosisTypeObservations(
      [selectedDiagnosis("cie10-retained", 1)],
      existingObs,
      { "cie10-retained": definitivoUuid },
      diagnosisTypeConceptUuid,
      presuntivoUuid,
    ),
  ).toEqual([
    {
      uuid: "tipo-retained-uuid",
      concept: { uuid: diagnosisTypeConceptUuid, display: "" },
      value: definitivoUuid,
      formFieldNamespace: TIPO_DX_FORM_FIELD_NAMESPACE,
      formFieldPath: retainedPath,
    },
    { uuid: "tipo-retained-duplicate-uuid", voided: true },
    { uuid: "tipo-removed-uuid", voided: true },
  ]);
});
