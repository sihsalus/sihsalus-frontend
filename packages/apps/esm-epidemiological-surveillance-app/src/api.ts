import { fhirBaseUrl, openmrsFetch, restBaseUrl } from "@openmrs/esm-framework";
import type {
  CaseRequest,
  CaseResult,
  Catalogue,
  FhirResource,
  NamedReference,
  Report,
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
  "METADATA_NOT_CONFIGURED",
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
  read<Catalogue>(`${apiBase}/metadata`, signal);
/** Native encounter diagnoses are distinct from longitudinal FHIR Conditions. */
export async function getEncounterDiagnoses(
  uuid: string,
  patientUuid: string,
): Promise<string[]> {
  const source = await read<{
    uuid: string;
    voided?: boolean;
    patient?: { uuid: string };
    diagnoses?: {
      voided?: boolean;
      diagnosis?: { coded?: { uuid: string } };
    }[];
  }>(
    `${restBaseUrl}/encounter/${encodeURIComponent(uuid)}?v=custom:(uuid,voided,patient:(uuid),diagnoses:(voided,diagnosis:(coded:(uuid))))`,
  );
  if (
    source.uuid !== uuid ||
    source.voided ||
    source.patient?.uuid !== patientUuid
  )
    throw new SurveillanceApiError("INVALID_SOURCE_ENCOUNTER", 422);
  return (source.diagnoses ?? []).flatMap((diagnosis) =>
    !diagnosis.voided && diagnosis.diagnosis?.coded?.uuid
      ? [diagnosis.diagnosis.coded.uuid]
      : [],
  );
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

interface Bundle {
  entry?: { resource?: FhirResource }[];
  link?: { relation: string; url: string }[];
}
interface Results<T> {
  results: T[];
  links?: { rel: string; uri: string }[];
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
export async function fhirSearch(
  resource: string,
  params: Record<string, string>,
  signal?: AbortSignal,
): Promise<FhirResource[]> {
  let url: string | undefined =
    `${fhirBaseUrl}/${resource}?${new URLSearchParams({ ...params, _count: "100" })}`;
  const result: FhirResource[] = [];
  const seen = new Set<string>();
  while (url) {
    if (seen.has(url) || seen.size >= 50)
      throw new SurveillanceApiError("SERVICE_UNAVAILABLE", 0);
    seen.add(url);
    const bundle: Bundle = await read<Bundle>(url, signal);
    for (const item of bundle.entry ?? [])
      if (item.resource?.resourceType === resource) result.push(item.resource);
    const next = bundle.link?.find((link) => link.relation === "next")?.url;
    url = next ? localPage(next, fhirBaseUrl) : undefined;
  }
  return result;
}
export async function references(
  resource: "location" | "provider",
  signal?: AbortSignal,
): Promise<NamedReference[]> {
  let url: string | undefined =
    `${restBaseUrl}/${resource}?v=custom:(uuid,display${resource === "provider" ? ",person:(uuid)" : ""})&limit=100`;
  const values: NamedReference[] = [];
  const seen = new Set<string>();
  while (url) {
    if (seen.has(url) || seen.size >= 50)
      throw new SurveillanceApiError("SERVICE_UNAVAILABLE", 0);
    seen.add(url);
    const response: Results<NamedReference> = await read<
      Results<NamedReference>
    >(url, signal);
    values.push(...response.results);
    const next = response.links?.find((link) => link.rel === "next")?.uri;
    url = next ? localPage(next, restBaseUrl) : undefined;
  }
  return values;
}
