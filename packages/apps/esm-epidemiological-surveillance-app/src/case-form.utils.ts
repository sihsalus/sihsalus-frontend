import { caseDateErrors } from "./field-validation";
import type {
  CaseRequest,
  Catalogue,
  FhirResource,
  ClinicalCatalog,
  SurveillanceCaseDraft,
} from "./types";

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
  const origin =
    (
      {
        AUTOCHTHONOUS: "AUTOCTONO",
        IMPORTED_NATIONAL: "IMPORTADO_NACIONAL",
        IMPORTED_INTERNATIONAL: "IMPORTADO_INTERNACIONAL",
      } as Record<string, string>
    )[request.origin] ?? request.origin;
  return {
    pregnant: request.pregnant,
    investigationForm: request.investigationForm,
    patientUuid: request.patientUuid,
    encounterUuid: request.sourceEncounterUuid,
    providerUuid: request.providerUuid,
    locationUuid: request.locationUuid,
    diagnosisUuid,
    laboratoryObservationUuid: request.laboratoryResultUuid,
    origin,
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
export function findDiagnosisMapping(
  diagnosisUuid: string,
  catalogue: Catalogue,
):
  | {
      eventUuid?: string;
      eventName?: string;
      severity?: string;
      species?: string;
      diagnosisConceptUuid: string;
      icd10Code?: string | null;
    }
  | undefined {
  const { catalog: m, events } = catalogue;
  for (const disease of m.diseases) {
    const mapping = disease.diagnoses.find(
      (d) => d.diagnosisConceptUuid === diagnosisUuid,
    );
    if (mapping) {
      const event = events.find(
        (e) => e.uuid === disease.eventUuid && e.active !== false,
      );
      if (!event) continue;
      return {
        eventUuid: disease.eventUuid,
        eventName: event?.conceptDisplay ?? event?.conceptUuid,
        severity: mapping.severity,
        species: mapping.species,
        diagnosisConceptUuid: mapping.diagnosisConceptUuid,
        icd10Code: mapping.icd10Code,
      };
    }
  }
  const directEvent = events.find(
    (e) => e.conceptUuid === diagnosisUuid && e.active !== false,
  );
  if (directEvent) {
    const disease = m.diseases.find((d) => d.eventUuid === directEvent.uuid);
    return {
      eventUuid: directEvent.uuid,
      eventName: directEvent.conceptDisplay ?? directEvent.conceptUuid,
      severity: disease?.severities?.[0]?.key,
      diagnosisConceptUuid: diagnosisUuid,
      icd10Code: directEvent.icd10,
    };
  }
  return undefined;
}
export const referenceId = (reference?: string): string =>
  reference?.split("/").filter(Boolean).at(-1) ?? "";
export const hasConcept = (resource: FhirResource, uuid: string): boolean =>
  !!uuid && !!resource.code?.coding?.some((coding) => coding.code === uuid);
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
export function prefill(
  observations: FhirResource[],
  diagnoses: string[],
  catalogue: Catalogue,
): Partial<CaseRequest> {
  const { catalog: m } = catalogue;
  const result: Partial<CaseRequest> = {};
  const matching = (field: string) =>
    observations.filter((obs) => hasConcept(obs, m.questions[field]));
  const onset = matching("onset");
  if (onset.length === 1 && onset[0].valueDateTime)
    result.onsetDate = onset[0].valueDateTime.slice(0, 10);
  const eventObs = matching("event");
  const eventUuids = new Set<string>();
  if (eventObs.length === 1)
    for (const event of catalogue.events)
      if (
        event.active !== false &&
        valueConcepts(eventObs[0]).includes(event.conceptUuid)
      )
        eventUuids.add(event.uuid);
  for (const disease of m.diseases)
    if (
      catalogue.events.some(
        (event) => event.uuid === disease.eventUuid && event.active !== false,
      ) &&
      disease.diagnoses.some((mapping) =>
        diagnoses.includes(mapping.diagnosisConceptUuid),
      )
    )
      eventUuids.add(disease.eventUuid);
  if (eventUuids.size === 1) result.eventUuid = [...eventUuids][0];
  const disease = m.diseases.find(
    (item) => item.eventUuid === result.eventUuid,
  );
  const mappings =
    disease?.diagnoses.filter((mapping) =>
      diagnoses.includes(mapping.diagnosisConceptUuid),
    ) ?? [];
  if (mappings.length === 1) {
    result.severity = mappings[0].severity;
    result.species = mappings[0].species;
  }
  for (const [key, choices] of [
    ["status", m.statuses],
    ["origin", m.origins],
    ["severity", disease?.severities ?? []],
    ["species", disease?.species ?? []],
  ] as const) {
    const obs = matching(key);
    if (obs.length === 1) {
      const choice = choices.find((item) =>
        valueConcepts(obs[0]).includes(item.conceptUuid),
      );
      if (choice) result[key] = choice.key;
    }
  }
  return result;
}
export function validateCase(
  request: Partial<CaseRequest>,
  m: ClinicalCatalog,
  patient?: FhirResource,
  source?: FhirResource,
): string[] {
  const fields: string[] = Object.keys(caseDateErrors(request, dateInZone(m.timezone), patient?.birthDate, source?.period?.start));
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
    "onsetDate",
  ] as const;
  for (const key of requiredKeys) {
    if (!request[key]) fields.push(key);
  }
  if (typeof request.investigationForm !== "boolean") fields.push("investigationForm");
  const disease = m.diseases.find((d) => d.eventUuid === request.eventUuid);
  if (disease?.severities?.length && !request.severity) fields.push("severity");
  if (disease?.species?.length && !request.species) fields.push("species");
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
  if (
    disease &&
    disease.diagnoses.length > 0 &&
    !disease.diagnoses.some(
      (mapping) =>
        mapping.severity === request.severity &&
        (mapping.species ?? "") === (request.species ?? ""),
    )
  )
    fields.push("severity");
  return [...new Set(fields)];
}
