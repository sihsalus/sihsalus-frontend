import { caseDateErrors, travelHistoryErrors } from "./field-validation";
import type {
  CaseRequest,
  Catalogue,
  FhirResource,
  ClinicalCatalog,
  SurveillanceCaseDraft,
} from "./types";

/** Fixed origin codes accepted by the server (GeographicCalculator.ORIGINS without UNKNOWN). */
export const ORIGINS = [
  "AUTOCTONO",
  "IMPORTADO_NACIONAL",
  "IMPORTADO_INTERNACIONAL",
  "INDUCIDO",
  "INTRODUCIDO",
  "RECAIDA",
  "RECRUDESCENCIA",
] as const;
/** Form classification; derived from the selected laboratory result. */
export const STATUSES = ["SUSPECTED", "CONFIRMED", "DISCARDED"] as const;

export function toSurveillanceCaseDraft(
  request: CaseRequest,
  diagnosisUuid: string,
): SurveillanceCaseDraft {
  const status = {
    SUSPECTED: "PROBABLE",
    CONFIRMED: "CONFIRMADO",
    DISCARDED: "DESCARTADO",
  }[request.status];
  if (!status || !diagnosisUuid)
    throw new Error("A diagnosis and classification are required.");
  return {
    travelHistory: (request.travelHistory ?? []).map(({ uuid, travelAddress, startDate, endDate }) => ({ uuid, travelAddress, startDate, endDate })),
    pregnant: request.pregnant,
    investigationForm: request.investigationForm,
    patientUuid: request.patientUuid,
    encounterUuid: request.sourceEncounterUuid,
    providerUuid: request.providerUuid,
    locationUuid: request.locationUuid,
    diagnosisUuid,
    laboratoryObservationUuid: request.laboratoryResultUuid,
    origin: request.origin,
    onsetDate: request.onsetDate,
    infectionAddressUuid: request.infectionAddressUuid,
    diagnosisType: status as SurveillanceCaseDraft["diagnosisType"],
    habitualResidence: request.habitualResidence,
    vaccinationStatus: request.vaccinationStatus,
    notificationDate: request.notificationDate,
    deathAttribution: status === "CONFIRMADO" ? (request.deathAttribution ?? null) : null,
    surveillanceType: request.surveillanceType,
  };
}

export function pregnancyEligible(sex?: string, age?: number): boolean {
  return (
    (sex === "F" || sex === "female") &&
    age !== undefined &&
    age >= 10 &&
    age <= 55
  );
}

export function encounterDate(
  source: FhirResource | undefined,
  timezone: string,
): string | undefined {
  const start = source?.period?.start;
  if (!start || !Number.isFinite(Date.parse(start))) return undefined;
  return start.length === 10 ? start : dateInZone(timezone, new Date(start));
}

export function invalidCaseDates(
  request: Pick<
    SurveillanceCaseDraft,
    "investigationDate" | "notificationDate" | "onsetDate"
  >,
  today: string,
): string[] {
  return Object.keys(caseDateErrors(request, today));
}

export function patientName(patient: FhirResource): string {
  const name = patient.name?.[0];
  return (
    name?.text ||
    [...(name?.given ?? []), name?.family].filter(Boolean).join(" ") ||
    patient.identifier?.[0]?.value ||
    ""
  );
}
export function patientAge(
  birthDate: string | undefined,
  today: string,
): number | undefined {
  const birth = birthDate?.slice(0, 10);
  if (
    !birth ||
    !/^\d{4}-\d{2}-\d{2}$/.test(birth) ||
    !Number.isFinite(Date.parse(birth)) ||
    new Date(birth).toISOString().slice(0, 10) !== birth ||
    birth > today
  )
    return undefined;
  return (
    Number(today.slice(0, 4)) -
    Number(birth.slice(0, 4)) -
    (today.slice(5) < birth.slice(5) ? 1 : 0)
  );
}
export function patientDni(patient: FhirResource): string {
  const dniObj =
    patient.identifier?.find((id) =>
      id.type?.text?.toUpperCase().includes("DNI"),
    ) ??
    patient.identifier?.find((id) => id.value && /^\d{8}$/.test(id.value)) ??
    patient.identifier?.[0];
  return dniObj?.value || "";
}
/**
 * Each notifiable event is the diagnosis configured by epidemiology, or a concept set of diagnoses.
 * A direct event concept wins over set membership, as on the server.
 */
export function findNotifiableEvent(
  diagnosisConceptUuid: string,
  catalogue: Catalogue,
):
  | {
      eventUuid: string;
      eventName: string;
      diagnosisConceptUuid: string;
      icd10Code?: string | null;
    }
  | undefined {
  const active = catalogue.events.filter((e) => e.active !== false);
  const event =
    active.find((e) => e.conceptUuid === diagnosisConceptUuid) ??
    active.find((e) => e.diagnosisConceptUuids?.includes(diagnosisConceptUuid));
  if (!event) return undefined;
  return {
    eventUuid: event.uuid,
    eventName: event.conceptDisplay ?? event.conceptUuid,
    diagnosisConceptUuid,
    icd10Code: event.conceptUuid === diagnosisConceptUuid ? event.icd10 : undefined,
  };
}
export const referenceId = (reference?: string): string =>
  reference?.split("/").filter(Boolean).at(-1) ?? "";
export const valueConcepts = (resource: FhirResource): string[] =>
  resource.valueCodeableConcept?.coding?.flatMap((coding) =>
    coding.code ? [coding.code] : [],
  ) ?? [];
export function dateInZone(timezone: string, value = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  return ["year", "month", "day"]
    .map((type) => parts.find((part) => part.type === type)?.value)
    .join("-");
}
export function validateCase(
  request: Partial<CaseRequest>,
  m: ClinicalCatalog,
  patient?: FhirResource,
  source?: FhirResource,
): string[] {
  const fields: string[] = Object.keys(caseDateErrors(request, dateInZone(m.timezone), patient?.birthDate, source?.period?.start));
  fields.push(...Object.keys(travelHistoryErrors(request, dateInZone(m.timezone))));
  if (source && request.investigationDate !== encounterDate(source, m.timezone))
    fields.push("investigationDate");
  const requiredKeys = [
    "patientUuid",
    "sourceEncounterUuid",
    "providerUuid",
    "locationUuid",
    "eventUuid",
    "status",
    "origin",
    "habitualResidence",
    "vaccinationStatus",
    "surveillanceType",
  ] as const;
  for (const key of requiredKeys) {
    if (!request[key]) fields.push(key);
  }
  if (typeof request.investigationForm !== "boolean") fields.push("investigationForm");
  const date = request.onsetDate;
  if (
    date &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(Date.parse(date)) ||
      new Date(date).toISOString().slice(0, 10) !== date ||
      date > dateInZone(m.timezone) ||
      (patient?.birthDate && date < patient.birthDate) ||
      (source?.period?.start && date > source.period.start.slice(0, 10)))
  )
    fields.push("onsetDate");
  if (
    request.status &&
    request.status !== "SUSPECTED" &&
    !request.laboratoryResultUuid
  )
    fields.push("laboratoryResultUuid");
  return [...new Set(fields)];
}
