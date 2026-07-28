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
} from '@openmrs/esm-patient-common-lib';

// ── App-specific hooks ───────────────────────────────────────────────────────
export { useDiagnosisHistory } from './use-diagnosis-history';
export { useEthnicIdentity } from './use-ethnic-identity';
export { useInsuranceProvider } from './use-insurance-provider';
export { usePatientTracing } from './use-patient-tracing';
export { useSoapNotes } from './use-soap-notes';
export { useTreatmentPlan } from './use-treatment-plan';
export { type TriageVitals, useTriageVitals } from './use-triage-vitals';
