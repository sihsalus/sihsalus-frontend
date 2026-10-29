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
  icd10SourceUuid?: string;
  version: number;
  encounterRoleUuid: string;
  trueConceptUuid: string | null;
  falseConceptUuid: string | null;
  surveillanceStartDate: string;
  timezone: string;
  firstDayOfWeek?: string;
  minimalDaysInFirstWeek?: number;
  questions: Record<string, string>;
  statuses: Choice[];
  origins: Choice[];
  diseases: Disease[];
}
export interface SurveillanceEvent {
  icd10?: string | null;
  uuid: string;
  conceptUuid: string;
  conceptDisplay?: string;
  periodicity: "SEMANAL" | "INMEDIATA" | "DIARIA";
  referenceRegulation: string;
  active?: boolean;
  validFrom?: string;
  validTo?: string | null;
}
export interface EncounterDiagnosis {
  icd10?: string;
  uuid: string;
  conceptUuid: string;
  display: string;
}
export interface Catalogue {
  catalog: ClinicalCatalog;
  events: SurveillanceEvent[];
}
export interface CaseRequest {
  pregnant?: boolean;
  investigationForm?: boolean;
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
  infectionAddressUuid?: string;
  habitualResidence?: "1" | "2" | "3" | null;
  vaccinationStatus?: "SI" | "NO" | "IGN";
  investigationDate?: string;
  /** ISO date-time with an explicit UTC-5 offset. */
  notificationDate?: string;
  deathAttribution?: "SI" | "NO" | "POR_DETERMINAR" | null;
  surveillanceType?: "PASIVA" | "BUSQUEDA_ACTIVA";
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

export interface SurveillanceCaseDraft {
  pregnant?: boolean;
  investigationForm?: boolean;
  patientUuid: string;
  encounterUuid: string;
  providerUuid: string;
  locationUuid: string;
  diagnosisUuid: string;
  testOrderUuid?: string;
  laboratoryObservationUuid?: string;
  origin?: string;
  onsetDate?: string;
  infectionAddressUuid?: string;
  diagnosisType: "CONFIRMADO" | "PROBABLE" | "DESCARTADO";
  habitualResidence?: "1" | "2" | "3" | null;
  vaccinationStatus?: "SI" | "NO" | "IGN";
  investigationDate?: string;
  /** ISO date-time with an explicit UTC-5 offset. */
  notificationDate?: string;
  deathAttribution?: "SI" | "NO" | "POR_DETERMINAR" | null;
  surveillanceType?: "PASIVA" | "BUSQUEDA_ACTIVA";
}

export interface SurveillanceCase extends SurveillanceCaseDraft {
  generatedAlerts?: SurveillanceAlert[];
  diagnosisIcd10?: string | null;
  patientDeathDate?: string | null;
  patientGivenNames?: string;
  patientPaternalSurname?: string;
  patientMaternalSurname?: string;
  patientAge?: number;
  patientResidence?: string;
  encounterDisplay?: string;
  encounterDate?: string;
  providerDisplay?: string;
  locationDisplay?: string;
  infectionAddressDisplay?: string;
  testOrderDisplay?: string;
  laboratoryObservationDisplay?: string;
  uuid: string;
  individualRecordUuid?: string;
  patientIdentifier?: string;
  patientDisplay?: string;
  patientSex?: string;
  patientBirthDate?: string;
  diagnosisDisplay?: string;
}
export type ReportDiagnosis = "CONFIRMADO" | "PROBABLE" | "TODOS";
export type ReportZoneLevel =
  "DEPARTAMENTO" | "PROVINCIA" | "DISTRITO" | "CENTRO_POBLADO";
export interface ReportFilters {
  zoneLevel: ReportZoneLevel;
  diagnosisType: ReportDiagnosis;
  address?: string;
}
export interface Report {
  historicalYears?: number[];
  generatedAt: string;
  eventUuid: string;
  from: string;
  to: string;
  period: string;
  population: ReportDiagnosis;
  zoneLevel: ReportZoneLevel;
  diagnosisType: ReportDiagnosis;
  address: string | null;
  total: number;
  curve: { date: string; cases: number }[];
  channel: {
    historicalCases?: Record<string, number>;
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
  orderUuid?: string;
  orderDisplay?: string;
  residence?: string;
  resourceType: string;
  id: string;
  name?: { text?: string; given?: string[]; family?: string }[];
  identifier?: { value?: string; type?: { text?: string } }[];
  birthDate?: string;
  deathDate?: string;
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

export interface SurveillanceAlert {
  registeredBy?: string | null;
  patientDisplay?: string | null;
  encounterDate?: string | null;
  diagnosisDisplay?: string | null;
  diagnosisIcd10?: string | null;
  uuid: string;
  type: "IMMEDIATE" | "OUTBREAK";
  reason: string;
  caseUuid: string;
  eventUuid: string;
  eventName: string;
  center: string | null;
  generatedAt: string;
  additionalInformation: string | null;
  status: "PENDING" | "ATTENDED";
  attendedAt: string | null;
  attendedBy: string | null;
}
