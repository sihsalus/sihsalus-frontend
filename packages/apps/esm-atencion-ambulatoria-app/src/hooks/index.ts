// ── Shared hooks & contexts (consolidated in patient-common-lib) ────────────
export {
  clinicalEncounterRepresentation,
  encounterRepresentation,
  PatientAppointmentContext,
  PatientAppointmentContextTypes,
  SelectedDateContext,
  useClinicalEncounter,
  useEncounterRows,
  useEncounters,
  useFilteredEncounter,
  useLatestValidEncounter,
  useProviders,
  useSchemasConceptSet,
} from "@openmrs/esm-patient-common-lib";

// ── App-specific hooks ───────────────────────────────────────────────────────
export {
  type VerifiedAmbulatoryVisit,
  useAmbulatoryVisitGuard,
} from "./useAmbulatoryVisitGuard";
export { useDiagnosisHistory } from "./useDiagnosisHistory";
export {
  type ConsultaExternaFormEntryMode,
  useConsultaExternaFormLauncher,
} from "./useConsultaExternaFormLauncher";
export { useConsultaExternaVisitNoteLauncher } from "./useConsultaExternaVisitNoteLauncher";
export { useEthnicIdentity } from "./useEthnicIdentity";
export { useInsuranceProvider } from "./useInsuranceProvider";
export { usePatientTracing } from "./usePatientTracing";
export { useSoapNotes } from "./useSoapNotes";
export { useTreatmentPlan } from "./useTreatmentPlan";
export { type TriageVitals, useTriageVitals } from "./useTriageVitals";
