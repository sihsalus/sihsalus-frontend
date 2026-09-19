import type { CaseRequest, Catalogue, FhirResource, Metadata } from "./types";

export function patientName(patient: FhirResource): string {
  const name = patient.name?.[0];
  return (
    name?.text ||
    [...(name?.given ?? []), name?.family].filter(Boolean).join(" ") ||
    patient.identifier?.[0]?.value ||
    ""
  );
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
  const { metadata: m } = catalogue;
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
      if (valueConcepts(eventObs[0]).includes(event.conceptUuid))
        eventUuids.add(event.uuid);
  for (const disease of m.diseases)
    if (
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
  m: Metadata,
  patient?: FhirResource,
  source?: FhirResource,
): string[] {
  const fields: string[] = [];
  for (const key of [
    "patientUuid",
    "sourceEncounterUuid",
    "providerUuid",
    "locationUuid",
    "eventUuid",
    "status",
    "severity",
    "origin",
    "onsetDate",
  ] as const)
    if (!request[key]) fields.push(key);
  const disease = m.diseases.find((d) => d.eventUuid === request.eventUuid);
  if (disease?.species.length && !request.species) fields.push("species");
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
    !disease.diagnoses.some(
      (mapping) =>
        mapping.severity === request.severity &&
        (mapping.species ?? "") === (request.species ?? ""),
    )
  )
    fields.push("severity");
  return [...new Set(fields)];
}
