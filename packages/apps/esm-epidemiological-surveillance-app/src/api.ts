import { openmrsFetch, restBaseUrl } from "@openmrs/esm-framework";
import type {
  CaseRequest,
  CaseResult,
  Catalogue,
  EncounterDiagnosis,
  FhirResource,
  NamedReference,
  Report,
  SurveillanceEvent,
} from "./types";

export const apiBase = `${restBaseUrl}/sihsalusepidemiologicalsurveillance`;
export class SurveillanceApiError extends Error {
  constructor(
    public code: string,
    public status: number,
    public fields: string[] = [],
  ) {
    super("Surveillance operation failed");
  }
}
const safeCodes = new Set([
  "AUTHENTICATION_REQUIRED",
  "ACCESS_DENIED",
  "CLINICAL_CONCEPT_UNAVAILABLE",
  "CLINICAL_DATATYPE_MISMATCH",
  "EVENT_NOT_FOUND",
  "EVENT_RETIRED",
  "EVENT_ALREADY_EXISTS",
  "EVENT_CONCEPT_ALREADY_EXISTS",
  "EVENT_CONCEPT_IMMUTABLE",
  "ICD10_MAPPING_UNAVAILABLE",
  "INVALID_CLASSIFICATION",
  "INVALID_EVENT",
  "INVALID_REFERENCE",
  "INVALID_SOURCE_ENCOUNTER",
  "INVALID_LOCATION",
  "INVALID_PROVIDER",
  "INVALID_ONSET_DATE",
  "DIAGNOSIS_MAPPING_UNAVAILABLE",
  "LAB_RESULT_REQUIRED",
  "INVALID_LAB_RESULT",
  "LAB_STATUS_CONFLICT",
  "REQUIRED_FIELDS",
  "AMBIGUOUS_SOURCE_DATA",
  "POSSIBLE_DUPLICATE",
  "IDEMPOTENCY_CONFLICT",
  "CASE_NOT_FOUND",
  "INVALID_CASE_DATA",
  "INVALID_DATE_RANGE",
  "OUTSIDE_COVERAGE",
  "INVALID_PERIOD",
]);
export function safeError(error: unknown): SurveillanceApiError {
  if (error instanceof SurveillanceApiError) return error;
  const failure = error as {
    status?: number;
    response?: { status?: number };
    responseBody?: { code?: string; fields?: unknown };
  };
  const status = failure?.status ?? failure?.response?.status ?? 0;
  const code = failure?.responseBody?.code;
  return new SurveillanceApiError(
    status === 401
      ? "AUTHENTICATION_REQUIRED"
      : status === 403
        ? "ACCESS_DENIED"
        : code && safeCodes.has(code)
          ? code
          : "SERVICE_UNAVAILABLE",
    status,
  );
}
export async function read<T>(url: string, signal?: AbortSignal): Promise<T> {
  try {
    const response = await openmrsFetch<T>(url, {
      signal,
      headers: { "x-omrs-offline-caching-strategy": "network-first" },
    });
    return response.data;
  } catch (error) {
    throw safeError(error);
  }
}
export const getCatalogue = (signal?: AbortSignal) =>
  read<Catalogue>(`${apiBase}/catalog`, signal);
/** Native encounter diagnoses are distinct from longitudinal FHIR Conditions. */
export async function getEncounterDiagnosesDetails(
  uuid: string,
  patientUuid: string,
  signal?: AbortSignal,
): Promise<EncounterDiagnosis[]> {
  const source = await read<{
    uuid: string;
    voided?: boolean;
    patient?: { uuid: string };
    diagnoses?: {
      voided?: boolean;
      diagnosis?: {
        coded?: {
          uuid: string;
          display?: string;
          name?: { name?: string };
        };
      };
    }[];
  }>(
    `${restBaseUrl}/encounter/${encodeURIComponent(uuid)}?v=custom:(uuid,voided,patient:(uuid),diagnoses:(voided,diagnosis:(coded:(uuid,display,name:(name)))))`,
    signal,
  );
  if (
    source.uuid !== uuid ||
    source.voided ||
    source.patient?.uuid !== patientUuid
  )
    throw new SurveillanceApiError("INVALID_SOURCE_ENCOUNTER", 422);
  return (source.diagnoses ?? []).flatMap((d) =>
    !d.voided && d.diagnosis?.coded?.uuid
      ? [
          {
            uuid: d.diagnosis.coded.uuid,
            display:
              d.diagnosis.coded.name?.name ??
              d.diagnosis.coded.display ??
              d.diagnosis.coded.uuid,
          },
        ]
      : [],
  );
}

export async function getEncounterDiagnoses(
  uuid: string,
  patientUuid: string,
): Promise<string[]> {
  const details = await getEncounterDiagnosesDetails(uuid, patientUuid);
  return details.map((d) => d.uuid);
}
export const getCase = (uuid: string, signal?: AbortSignal) =>
  read<CaseResult>(`${apiBase}/cases/${encodeURIComponent(uuid)}`, signal);
export async function registerCase(
  request: CaseRequest,
  signal?: AbortSignal,
): Promise<CaseResult> {
  try {
    return (
      await openmrsFetch<CaseResult>(`${apiBase}/cases`, {
        method: "POST",
        body: request,
        signal,
      })
    ).data;
  } catch (error) {
    throw safeError(error);
  }
}
export const getReport = (
  event: string,
  from: string,
  to: string,
  period: string,
  signal?: AbortSignal,
) =>
  read<Report>(
    `${apiBase}/reports?${new URLSearchParams({ event, from, to, period })}`,
    signal,
  );

export const getEvents = (includeRetired = false, signal?: AbortSignal) =>
  read<{ results: SurveillanceEvent[] }>(
    `${apiBase}/events?includeRetired=${includeRetired}`,
    signal,
  ).then((res) => res.results);

export async function saveEvent(
  event: Partial<SurveillanceEvent>,
  signal?: AbortSignal,
): Promise<SurveillanceEvent> {
  try {
    return (
      await openmrsFetch<SurveillanceEvent>(`${apiBase}/events`, {
        method: "POST",
        body: event,
        signal,
      })
    ).data;
  } catch (error) {
    throw safeError(error);
  }
}

export async function updateEvent(
  uuid: string,
  event: Partial<SurveillanceEvent>,
  signal?: AbortSignal,
): Promise<SurveillanceEvent> {
  try {
    return (
      await openmrsFetch<SurveillanceEvent>(
        `${apiBase}/events/${encodeURIComponent(uuid)}`,
        {
          method: "PUT",
          body: event,
          signal,
        },
      )
    ).data;
  } catch (error) {
    throw safeError(error);
  }
}

export async function deleteEvent(
  uuid: string,
  signal?: AbortSignal,
): Promise<void> {
  try {
    await openmrsFetch(`${apiBase}/events/${encodeURIComponent(uuid)}`, {
      method: "DELETE",
      signal,
    });
  } catch (error) {
    throw safeError(error);
  }
}

export interface RestConcept {
  uuid: string;
  display: string;
}

export async function searchConcepts(
  query: string,
  signal?: AbortSignal,
): Promise<RestConcept[]> {
  const response = await read<Results<RestConcept>>(
    `${restBaseUrl}/concept?${new URLSearchParams({
      q: query,
      v: "custom:(uuid,display)",
      limit: "30",
    })}`,
    signal,
  );
  return response.results;
}

interface Results<T> {
  results: T[];
  links?: { rel: string; uri: string }[];
}
interface RestPatient {
  uuid: string;
  display?: string;
  identifiers?: {
    identifier?: string;
    identifierType?: { uuid?: string; name?: string };
  }[];
  person?: {
    display?: string;
    gender?: string;
    birthdate?: string;
  };
}
interface RestEncounter {
  uuid: string;
  voided?: boolean;
  patient?: { uuid: string };
  encounterDatetime?: string;
  encounterType?: { uuid?: string; name?: string; display?: string };
  location?: { uuid?: string; display?: string };
}
interface RestObservation {
  uuid: string;
  voided?: boolean;
  obsDatetime?: string;
  value?: string | { uuid?: string; display?: string };
  valueDatetime?: string;
  valueText?: string;
  concept?: { uuid?: string; display?: string };
  groupMembers?: RestObservation[];
}

function patientResource(patient: RestPatient): FhirResource {
  return {
    resourceType: "Patient",
    id: patient.uuid,
    name: [{ text: patient.person?.display ?? patient.display }],
    identifier: patient.identifiers?.flatMap((identifier) =>
      identifier.identifier
        ? [
            {
              value: identifier.identifier,
              type: identifier.identifierType?.name
                ? { text: identifier.identifierType.name }
                : undefined,
            },
          ]
        : [],
    ),
    gender: patient.person?.gender,
    birthDate: patient.person?.birthdate,
  };
}

function encounterResource(encounter: RestEncounter): FhirResource {
  return {
    resourceType: "Encounter",
    id: encounter.uuid,
    subject: encounter.patient?.uuid
      ? { reference: `Patient/${encounter.patient.uuid}` }
      : undefined,
    period: encounter.encounterDatetime
      ? { start: encounter.encounterDatetime }
      : undefined,
    location: encounter.location?.uuid
      ? [{ location: { reference: `Location/${encounter.location.uuid}`, display: encounter.location.display } }]
      : undefined,
    type: encounter.encounterType
      ? [{ text: encounter.encounterType.name ?? encounter.encounterType.display }]
      : undefined,
  };
}

function observationResource(observation: RestObservation): FhirResource {
  const codedValue = typeof observation.value === "object" ? observation.value : undefined;
  return {
    resourceType: "Observation",
    id: observation.uuid,
    status: "final",
    effectiveDateTime: observation.obsDatetime,
    valueDateTime:
      observation.valueDatetime ??
      (typeof observation.value === "string" ? observation.value : undefined),
    valueString: observation.valueText,
    code: observation.concept?.uuid
      ? { coding: [{ code: observation.concept.uuid, display: observation.concept.display }], text: observation.concept.display }
      : undefined,
    valueCodeableConcept: codedValue?.uuid
      ? { coding: [{ code: codedValue.uuid, display: codedValue.display }], text: codedValue.display }
      : undefined,
  };
}

function observationResources(observation: RestObservation): FhirResource[] {
  if (observation.voided) return [];
  return [
    observationResource(observation),
    ...(observation.groupMembers ?? []).flatMap(observationResources),
  ];
}
/** Follow only links on this OpenMRS origin and under the same API path. Never leak a session to another host. */
export function localPage(link: string, allowedBase: string): string {
  const base = new URL(
    globalThis.openmrsBase || "/openmrs",
    globalThis.location.origin,
  );
  const url = new URL(link, base);
  const prefix = `${base.pathname.replace(/\/$/, "")}${allowedBase}/`;
  if (
    url.origin !== base.origin ||
    !url.pathname.startsWith(prefix) ||
    url.username ||
    url.password
  )
    throw new SurveillanceApiError("SERVICE_UNAVAILABLE", 0);
  return (
    url.pathname.slice(base.pathname.replace(/\/$/, "").length) + url.search
  );
}
export async function searchPatients(
  query: string,
  signal?: AbortSignal,
): Promise<FhirResource[]> {
  const response = await read<Results<RestPatient>>(
    `${restBaseUrl}/patient?${new URLSearchParams({
      q: query,
      v: "custom:(uuid,display,identifiers:(identifier,identifierType:(uuid,name)),person:(display,gender,birthdate))",
      limit: "50",
    })}`,
    signal,
  );
  return response.results.map(patientResource);
}

export async function getPatient(
  uuid: string,
  signal?: AbortSignal,
): Promise<FhirResource> {
  return patientResource(
    await read<RestPatient>(
      `${restBaseUrl}/patient/${encodeURIComponent(uuid)}?v=custom:(uuid,display,identifiers:(identifier,identifierType:(uuid,name)),person:(display,gender,birthdate))`,
      signal,
    ),
  );
}

async function restPages<T>(
  resource: string,
  params: Record<string, string>,
  signal?: AbortSignal,
): Promise<T[]> {
  let url: string | undefined = `${restBaseUrl}/${resource}?${new URLSearchParams({ ...params, limit: "100" })}`;
  const values: T[] = [];
  const seen = new Set<string>();
  while (url) {
    if (seen.has(url) || seen.size >= 50)
      throw new SurveillanceApiError("SERVICE_UNAVAILABLE", 0);
    seen.add(url);
    const response = await read<Results<T>>(url, signal);
    values.push(...response.results);
    const next = response.links?.find((link) => link.rel === "next")?.uri;
    url = next ? localPage(next, restBaseUrl) : undefined;
  }
  return values;
}

/** Uses the native OpenMRS encounter index; FHIR is not required by this form. */
export async function encountersForPatient(
  patientUuid: string,
  signal?: AbortSignal,
): Promise<FhirResource[]> {
  const encounters = await restPages<RestEncounter>(
    "encounter",
    {
      patient: patientUuid,
      order: "desc",
      v: "custom:(uuid,voided,patient:(uuid),encounterDatetime,encounterType:(uuid,name,display),location:(uuid,display))",
    },
    signal,
  );
  return encounters
    .filter((encounter) => !encounter.voided && encounter.patient?.uuid === patientUuid)
    .map(encounterResource);
}

/** Observations are read from the selected native encounter, so laboratory options stay in its visit context. */
export async function getEncounterObservations(
  uuid: string,
  patientUuid: string,
  signal?: AbortSignal,
): Promise<FhirResource[]> {
  const source = await read<RestEncounter & { obs?: RestObservation[] }>(
    `${restBaseUrl}/encounter/${encodeURIComponent(uuid)}?v=custom:(uuid,voided,patient:(uuid),obs:(uuid,voided,obsDatetime,value,valueDatetime,valueText,concept:(uuid,display),groupMembers:(uuid,voided,obsDatetime,value,valueDatetime,valueText,concept:(uuid,display),groupMembers:(uuid,voided,obsDatetime,value,valueDatetime,valueText,concept:(uuid,display)))))`,
    signal,
  );
  if (source.uuid !== uuid || source.voided || source.patient?.uuid !== patientUuid)
    throw new SurveillanceApiError("INVALID_SOURCE_ENCOUNTER", 422);
  return (source.obs ?? []).flatMap(observationResources);
}
export async function references(
  resource: "location" | "provider",
  signal?: AbortSignal,
): Promise<NamedReference[]> {
  return restPages<NamedReference>(
    resource,
    { v: `custom:(uuid,display${resource === "provider" ? ",person:(uuid)" : ""})` },
    signal,
  );
}
