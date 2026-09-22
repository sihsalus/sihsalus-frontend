export interface Choice {
  key: string;
  conceptUuid: string;
  label: string;
}
export interface Disease {
  eventUuid: string;
  family?: string;
  severities: Choice[];
  species: Choice[];
  diagnoses: {
    severity: string;
    species?: string;
    diagnosisConceptUuid: string;
    icd10Code: string;
  }[];
  laboratoryTests: {
    orderConceptUuid: string;
    resultConceptUuid: string;
    positiveAnswerUuids: string[];
    negativeAnswerUuids: string[];
  }[];
}
export interface ClinicalCatalog {
  version: number;
  encounterRoleUuid: string;
  trueConceptUuid: string | null;
  falseConceptUuid: string | null;
  surveillanceStartDate: string;
  timezone: string;
  questions: Record<string, string>;
  statuses: Choice[];
  origins: Choice[];
  diseases: Disease[];
}
export interface SurveillanceEvent {
  uuid: string;
  name: string;
  conceptUuid: string;
  conceptDisplay?: string;
  periodicity: string;
  deadlineDays: number;
  retired?: boolean;
}
export interface EncounterDiagnosis {
  uuid: string;
  display: string;
}
export interface Catalogue {
  catalog: ClinicalCatalog;
  events: SurveillanceEvent[];
}
export interface CaseRequest {
  uuid: string; // Stable idempotency key; the source encounter keeps its own UUID.
  patientUuid: string;
  sourceEncounterUuid: string;
  providerUuid: string;
  locationUuid: string;
  eventUuid: string;
  status: string;
  severity: string;
  origin: string;
  species?: string;
  onsetDate: string;
  laboratoryResultUuid?: string;
}
export interface CaseResult {
  uuid: string; // UUID of the completed metaxenicas encounter.
  diagnosisConceptUuid: string;
  icd10: string;
  periodicity: string;
  deadlineDays: number;
  replayed: boolean;
  immediateAlerts: string[];
  outbreakAlerts: string[];
  warnings: string[];
}
export interface Report {
  generatedAt: string;
  eventUuid: string;
  from: string;
  to: string;
  period: string;
  population: "CONFIRMED";
  total: number;
  curve: { date: string; cases: number }[];
  channel: {
    date: string;
    year: number;
    number: number;
    cases: number;
    q1: number | null;
    q2: number | null;
    q3: number | null;
    sampleSize: number;
    zone: string;
  }[];
  demographics: Record<string, Record<string, number>>;
  warnings: string[];
}
export interface Coding {
  system?: string;
  code?: string;
  display?: string;
}
export interface FhirResource {
  resourceType: string;
  id: string;
  name?: { text?: string; given?: string[]; family?: string }[];
  identifier?: { value?: string; type?: { text?: string } }[];
  birthDate?: string;
  gender?: string;
  deceasedBoolean?: boolean;
  code?: { coding?: Coding[]; text?: string };
  status?: string;
  subject?: { reference?: string };
  encounter?: { reference?: string };
  period?: { start?: string; end?: string };
  effectiveDateTime?: string;
  valueDateTime?: string;
  valueBoolean?: boolean;
  valueString?: string;
  valueQuantity?: { value?: number; unit?: string };
  valueCodeableConcept?: { coding?: Coding[]; text?: string };
  location?: { location: { reference?: string; display?: string } }[];
  type?: { text?: string; coding?: Coding[] }[];
}
export interface NamedReference {
  uuid: string;
  display: string;
  person?: { uuid: string };
}
