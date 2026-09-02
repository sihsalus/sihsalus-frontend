import {
  type Encounter,
  openmrsFetch,
  restBaseUrl,
  useConfig,
} from "@openmrs/esm-framework";
import useSWR from "swr";
import { v5 as uuidv5 } from "uuid";
import { type ConfigObject } from "../config-schema";
import type {
  Concept,
  DiagnosisPayload,
  EncountersFetchResponse,
  PatientNote,
  RESTPatientNote,
  VisitNotePayload,
} from "../types";
import { formatPrestacionalDisplay } from "./catalog-concept.utils";
import { defaultVisitNoteClinicalConceptUuids } from "./visit-note-config-schema";

interface UseVisitNotes {
  visitNotes: Array<PatientNote> | null;
  error: Error;
  isLoading: boolean;
  isValidating?: boolean;
  mutateVisitNotes: () => void;
}

interface EncounterPage<T> {
  links?: Array<{ rel?: string; uri?: string }>;
  results?: Array<T>;
  totalCount?: number;
}

export type CanonicalVisitNoteResolution =
  | { status: "loading"; encounter: null; mutate: () => unknown }
  | {
      status: "ready";
      encounter: Encounter | null;
      isValidating: boolean;
      mutate: () => unknown;
      revalidationError: Error | null;
    }
  | { status: "ambiguous" | "error"; encounter: null; mutate: () => unknown };

const encounterPageSize = 100;
const catalogConceptMappingsRepresentation =
  "conceptMappings:(conceptReferenceTerm:(conceptSource:(name,display),code))";
// The MINSA CIE-10 catalog carries the code as the concept's SHORT name.
const catalogConceptNamesRepresentation =
  "names:(display,conceptNameType,locale)";
const canonicalEncounterUuidNamespace = uuidv5(
  "sihsalus:canonical-visit-note:v1",
  uuidv5.URL,
);

export class AmbiguousVisitNoteSaveError extends Error {
  constructor() {
    super(
      "The visit note may already have been saved. Reload before trying again.",
    );
    this.name = "AmbiguousVisitNoteSaveError";
  }
}

export interface VisitNoteClinicalContext {
  codigoPrestacional?: string;
  chiefComplaint?: string;
  illnessDuration?: string;
  biologicalFunctions?: string;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  therapeuticIndications?: string;
  auxiliaryExams?: string;
  procedures?: string;
  prescriptions?: string;
  referral?: string;
  nextAppointment?: string;
}

export interface ProviderSignatureDetails {
  uuid?: string;
  name?: string;
  identifier?: string;
  professionalRegistration?: string;
}

interface RestObsValue {
  uuid?: string;
  display?: string;
}

interface RestClinicalContextObs {
  uuid?: string;
  obsDatetime?: string;
  display?: string;
  concept?: {
    uuid?: string;
    display?: string;
  };
  value?: string | number | boolean | RestObsValue;
  formFieldNamespace?: string;
  formFieldPath?: string;
}

interface RestClinicalContextEncounter {
  uuid?: string;
  display?: string;
  encounterDatetime?: string;
  encounterType?: { uuid?: string } | string;
  form?: { uuid?: string } | string;
  patient?: { uuid?: string } | string;
  visit?: { uuid?: string } | string;
  obs?: Array<RestClinicalContextObs>;
}

interface RestProviderAttribute {
  uuid?: string;
  display?: string;
  value?: string | number | boolean;
  attributeType?: {
    uuid?: string;
    display?: string;
  };
  voided?: boolean;
}

export interface RestProvider {
  uuid?: string;
  display?: string;
  identifier?: string;
  attributes?: Array<RestProviderAttribute>;
  person?: {
    uuid?: string;
    display?: string;
    attributes?: Array<RestProviderAttribute>;
  };
}

export const legacyStructuredVisitNoteConceptUuids = {
  anamnesisText: defaultVisitNoteClinicalConceptUuids.anamnesisConceptUuid,
  sharedTextWithFormFieldPath: "162169AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
} as const;

/**
 * Concepts under which older visit notes stored the procedures text. `procedure`
 * (1651) is a dedicated legacy concept, safe to read with or without a form field
 * path. `textWithProceduresPath` (162169, free-text consult note) is shared with the
 * SOAP plan, so it must ONLY be read with the 'procedures' form field path - without
 * it the SOAP plan text would bleed into the procedures field.
 */
export const legacyProceduresConceptUuids = {
  procedure: "1651AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  textWithProceduresPath:
    legacyStructuredVisitNoteConceptUuids.sharedTextWithFormFieldPath,
} as const;

export const legacyNextAppointmentConceptUuid =
  "47ce3ee6-ee9f-4037-901b-2a6381c4b340";

const visitNoteListRepresentation =
  "custom:(uuid,display,encounterDatetime,patient:(uuid),visit:(uuid),form:(uuid),encounterType:(uuid,name),obs," +
  "encounterProviders:(uuid,display,encounterRole:(uuid,display)," +
  "provider:(uuid,person:(uuid,display))),diagnoses)";

const canonicalVisitNoteRepresentation =
  "custom:(uuid,display,encounterDatetime,patient:(uuid),visit:(uuid),form:(uuid)," +
  "encounterType:(uuid),location:(uuid,display)," +
  "encounterProviders:(uuid,display,encounterRole:(uuid,display)," +
  "provider:(uuid,display,person:(uuid,display)))," +
  "obs:(uuid,obsDatetime,display,concept:(uuid,display),value," +
  "formFieldNamespace,formFieldPath,voided)," +
  `diagnoses:(uuid,display,certainty,rank,voided,diagnosis:(coded:(uuid,display,${catalogConceptMappingsRepresentation}))))`;

function getResourceUuid(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "uuid" in value) {
    const uuid = (value as { uuid?: unknown }).uuid;
    return typeof uuid === "string" ? uuid : undefined;
  }
  return undefined;
}

function buildEncounterSearchUrl(
  patientUuid: string,
  representation: string,
  options: {
    visitUuid?: string;
    encounterTypeUuid?: string;
    startIndex?: number;
  } = {},
) {
  const params = new URLSearchParams({
    patient: patientUuid,
    v: representation,
    limit: String(encounterPageSize),
    startIndex: String(options.startIndex ?? 0),
    totalCount: "true",
  });
  if (options.visitUuid) params.set("visit", options.visitUuid);
  if (options.encounterTypeUuid)
    params.set("encounterType", options.encounterTypeUuid);
  return `${restBaseUrl}/encounter?${params.toString()}`;
}

/** Fetches every REST search page; it never relies on an unsupported `form` filter. */
export async function fetchAllEncounterPages<T>(
  baseUrl: string,
): Promise<Array<T>> {
  const allResults: Array<T> = [];
  const seenUuids = new Set<string>();
  let startIndex = 0;

  for (;;) {
    const pageUrl = new URL(
      baseUrl,
      globalThis.location?.origin ?? "http://localhost",
    );
    pageUrl.searchParams.set("limit", String(encounterPageSize));
    pageUrl.searchParams.set("startIndex", String(startIndex));
    pageUrl.searchParams.set("totalCount", "true");
    const requestUrl = `${pageUrl.pathname}${pageUrl.search}`;
    const { data } = await openmrsFetch<EncounterPage<T>>(requestUrl);
    if (!Array.isArray(data?.results)) {
      throw new Error("The encounter search response is invalid.");
    }

    const previousLength = allResults.length;
    for (const result of data.results) {
      const uuid = getResourceUuid(result);
      if (!uuid || !seenUuids.has(uuid)) {
        allResults.push(result);
        if (uuid) seenUuids.add(uuid);
      }
    }
    const hasNextLink = data.links?.some(({ rel }) => rel === "next") ?? false;
    const totalReached =
      typeof data.totalCount === "number" &&
      startIndex + data.results.length >= data.totalCount;
    const lastShortPage = data.results.length < encounterPageSize;
    if (
      totalReached ||
      (!hasNextLink && lastShortPage) ||
      data.results.length === 0
    )
      break;
    if (allResults.length === previousLength) {
      throw new Error("Encounter pagination did not advance.");
    }
    startIndex += data.results.length;
  }
  return allResults;
}

function hasExactEncounterIdentity(
  encounter: unknown,
  patientUuid: string,
  encounterTypeUuid: string,
  formUuid: string,
  visitUuid?: string,
): boolean {
  if (!encounter || typeof encounter !== "object") return false;
  const candidate = encounter as RESTPatientNote;
  return (
    getResourceUuid(candidate.patient) === patientUuid &&
    getResourceUuid(candidate.encounterType) === encounterTypeUuid &&
    getResourceUuid(candidate.form) === formUuid &&
    (!visitUuid || getResourceUuid(candidate.visit) === visitUuid)
  );
}

async function fetchExactVisitNoteEncounters(
  patientUuid: string,
  encounterTypeUuid: string,
  formUuid: string,
  visitUuid?: string,
  representation = canonicalVisitNoteRepresentation,
) {
  const baseUrl = buildEncounterSearchUrl(patientUuid, representation, {
    visitUuid,
    encounterTypeUuid,
  });
  const results = await fetchAllEncounterPages<Encounter>(baseUrl);
  return results.filter((encounter) =>
    hasExactEncounterIdentity(
      encounter,
      patientUuid,
      encounterTypeUuid,
      formUuid,
      visitUuid,
    ),
  );
}

export function useVisitNotes(patientUuid: string): UseVisitNotes {
  const {
    visitNoteConfig: {
      encounterNoteTextConceptUuid,
      encounterTypeUuid,
      formConceptUuid,
    },
  } = useConfig<ConfigObject>();

  const encountersApiUrl = patientUuid
    ? buildEncounterSearchUrl(patientUuid, visitNoteListRepresentation, {
        encounterTypeUuid,
      })
    : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR<
    { data: EncountersFetchResponse },
    Error
  >(encountersApiUrl, async () => ({
    data: {
      results: (await fetchExactVisitNoteEncounters(
        patientUuid,
        encounterTypeUuid,
        formConceptUuid,
        undefined,
        visitNoteListRepresentation,
      )) as unknown as Array<RESTPatientNote>,
    },
  }));

  const mapNoteProperties = (
    note: RESTPatientNote,
    index: number,
  ): PatientNote => {
    const encounterNoteObs = note.obs.find(
      (observation) =>
        observation.concept.uuid === encounterNoteTextConceptUuid &&
        !observation.formFieldPath,
    );

    return {
      id: `${index}`,
      diagnoses: note.diagnoses
        .filter((diagnosis) => !diagnosis.voided)
        .map((diagnosisData) => getDisplayText(diagnosisData.display))
        .filter((val) => val)
        .join(", "),
      encounterDate: note.encounterDatetime,
      encounterNote: encounterNoteObs ? getObsTextValue(encounterNoteObs) : "",
      encounterNoteRecordedAt: encounterNoteObs?.obsDatetime,
      encounterProvider: getDisplayText(
        note?.encounterProviders[0]?.provider?.person?.display,
      ),
      encounterProviderRole: getDisplayText(
        note?.encounterProviders[0]?.encounterRole?.display,
      ),
    };
  };

  const formattedVisitNotes = data?.data?.results
    ?.map(mapNoteProperties)
    ?.sort(
      (noteA, noteB) =>
        new Date(noteB.encounterDate).getTime() -
        new Date(noteA.encounterDate).getTime(),
    );

  return {
    visitNotes: data ? formattedVisitNotes : null,
    error,
    isLoading,
    isValidating,
    mutateVisitNotes: mutate,
  };
}

export function getCanonicalVisitNoteEncounterUuid(
  patientUuid: string,
  visitUuid: string,
  encounterTypeUuid: string,
  formUuid: string,
): string {
  if (!patientUuid || !visitUuid || !encounterTypeUuid || !formUuid) {
    throw new Error("Visit note identity is incomplete.");
  }
  return uuidv5(
    [patientUuid, visitUuid, encounterTypeUuid, formUuid]
      .map((value) => value.toLowerCase())
      .join("|"),
    canonicalEncounterUuidNamespace,
  );
}

export async function assertCanonicalVisitNoteCanBeCreated(
  patientUuid: string,
  visitUuid: string,
  encounterTypeUuid: string,
  formUuid: string,
): Promise<void> {
  if (!patientUuid || !visitUuid || !encounterTypeUuid || !formUuid) {
    throw new Error("Visit note identity is incomplete.");
  }
  const encounters = await fetchExactVisitNoteEncounters(
    patientUuid,
    encounterTypeUuid,
    formUuid,
    visitUuid,
    "custom:(uuid,patient:(uuid),visit:(uuid),form:(uuid),encounterType:(uuid))",
  );
  if (encounters.length !== 0) {
    throw new Error("A visit summary already exists or could not be verified.");
  }
}

function isCompleteCanonicalEncounter(
  encounter: Encounter,
  patientUuid: string,
  visitUuid: string,
  encounterTypeUuid: string,
  formUuid: string,
): boolean {
  const candidate = encounter as Encounter & {
    diagnoses?: Array<{ diagnosis?: { coded?: unknown }; uuid?: string }>;
    encounterProviders?: Array<{
      encounterRole?: unknown;
      provider?: unknown;
      uuid?: string;
    }>;
    location?: unknown;
    obs?: Array<{ concept?: unknown; uuid?: string }>;
  };
  return Boolean(
    encounter.uuid &&
    encounter.encounterDatetime &&
    hasExactEncounterIdentity(
      encounter,
      patientUuid,
      encounterTypeUuid,
      formUuid,
      visitUuid,
    ) &&
    getResourceUuid(candidate.location) &&
    Array.isArray(candidate.encounterProviders) &&
    candidate.encounterProviders.length > 0 &&
    candidate.encounterProviders.every(
      (provider) =>
        provider.uuid &&
        getResourceUuid(provider.encounterRole) &&
        getResourceUuid(provider.provider),
    ) &&
    Array.isArray(candidate.obs) &&
    candidate.obs.every((obs) => obs.uuid && getResourceUuid(obs.concept)) &&
    Array.isArray(candidate.diagnoses) &&
    candidate.diagnoses.every(
      (diagnosis) =>
        diagnosis.uuid && getResourceUuid(diagnosis.diagnosis?.coded),
    ),
  );
}

export function useCanonicalVisitNoteEncounter(
  patientUuid?: string | null,
  visitUuid?: string | null,
  encounterTypeUuid?: string | null,
  formUuid?: string | null,
): CanonicalVisitNoteResolution {
  const isConfigured = Boolean(
    patientUuid && visitUuid && encounterTypeUuid && formUuid,
  );
  const key = isConfigured
    ? buildEncounterSearchUrl(
        patientUuid as string,
        canonicalVisitNoteRepresentation,
        {
          visitUuid: visitUuid as string,
          encounterTypeUuid: encounterTypeUuid as string,
        },
      )
    : null;
  const { data, error, isLoading, isValidating, mutate } = useSWR<
    { data: { results: Array<Encounter> } },
    Error
  >(key, async () => ({
    data: {
      results: await fetchExactVisitNoteEncounters(
        patientUuid as string,
        encounterTypeUuid as string,
        formUuid as string,
        visitUuid as string,
      ),
    },
  }));
  const mutateResolution = () => mutate();
  if (!isConfigured)
    return { status: "error", encounter: null, mutate: mutateResolution };
  if (isLoading || !data) {
    return {
      status: error ? "error" : "loading",
      encounter: null,
      mutate: mutateResolution,
    };
  }
  // Keep already verified stale data mounted during background revalidation;
  // replacing the form after a committed save could interrupt attachment handling.
  if (!Array.isArray(data.data?.results)) {
    return { status: "error", encounter: null, mutate: mutateResolution };
  }
  if (data.data.results.length > 1) {
    return { status: "ambiguous", encounter: null, mutate: mutateResolution };
  }
  const encounter = data.data.results[0];
  const readyState = {
    isValidating: Boolean(isValidating),
    mutate: mutateResolution,
    revalidationError: error ?? null,
  };
  if (!encounter) return { status: "ready", encounter: null, ...readyState };
  return isCompleteCanonicalEncounter(
    encounter,
    patientUuid as string,
    visitUuid as string,
    encounterTypeUuid as string,
    formUuid as string,
  )
    ? { status: "ready", encounter, ...readyState }
    : { status: "error", encounter: null, mutate: mutateResolution };
}

export function fetchDiagnosisConceptsByName(
  searchTerm: string,
  diagnosisConceptClass: string,
) {
  const customRepresentation = `custom:(uuid,display,${catalogConceptMappingsRepresentation},${catalogConceptNamesRepresentation})`;
  const url = `${restBaseUrl}/concept?name=${searchTerm}&searchType=fuzzy&class=${diagnosisConceptClass}&v=${customRepresentation}`;

  return openmrsFetch<Array<Concept>>(url).then(({ data }) => data["results"]);
}

export function fetchPrestacionalConceptsByName(
  searchTerm: string,
  conceptSourceName = "Codigos Prestacionales",
) {
  const configuredConceptSetNames =
    getConfiguredConceptSourceNames(conceptSourceName);
  const conceptSetQuery = encodeURIComponent(
    configuredConceptSetNames[0] ?? conceptSourceName,
  );
  const customRepresentation = `custom:(uuid,display,setMembers:(uuid,display,${catalogConceptMappingsRepresentation}))`;
  const url = `${restBaseUrl}/concept?q=${conceptSetQuery}&searchType=fuzzy&v=${customRepresentation}&limit=20`;

  return openmrsFetch<Array<Concept>>(url).then(({ data }) => {
    const matchingConceptSet = (data["results"] ?? []).find((concept) =>
      configuredConceptSetNames.some((conceptSetName) =>
        matchesConceptSetDisplay(concept.display, conceptSetName),
      ),
    );
    const normalizedSearchTerm = normalizeSearchText(searchTerm);

    return (matchingConceptSet?.setMembers ?? [])
      .filter((concept) =>
        normalizeSearchText(formatPrestacionalDisplay(concept)).includes(
          normalizedSearchTerm,
        ),
      )
      .sort((left, right) =>
        formatPrestacionalDisplay(left).localeCompare(
          formatPrestacionalDisplay(right),
        ),
      );
  });
}

function normalizeConceptSourceName(sourceName?: string | null) {
  return (
    sourceName
      ?.trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "") ?? ""
  );
}

function normalizeSearchText(value?: string | null) {
  return (
    value
      ?.trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "") ?? ""
  );
}

function getConfiguredConceptSourceNames(conceptSourceName: string) {
  return conceptSourceName
    .split(",")
    .map((sourceName) => sourceName.trim())
    .filter(Boolean);
}

function matchesConceptSetDisplay(
  actualDisplay: string,
  expectedDisplay: string,
) {
  const actual = normalizeConceptSourceName(actualDisplay);
  const expected = normalizeConceptSourceName(expectedDisplay);

  return Boolean(actual && expected && actual === expected);
}

export function saveVisitNote(
  abortController: AbortController,
  payload: VisitNotePayload,
) {
  return openmrsFetch(`${restBaseUrl}/encounter`, {
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
    body: payload,
    signal: abortController.signal,
  });
}

async function reconcileAmbiguousCanonicalCreate(
  payload: VisitNotePayload,
): Promise<never> {
  if (!payload.uuid || !payload.visit) {
    throw new Error("Visit note identity is incomplete.");
  }
  try {
    const { data } = await openmrsFetch<Encounter>(
      `${restBaseUrl}/encounter/${payload.uuid}?v=${encodeURIComponent(canonicalVisitNoteRepresentation)}`,
    );
    if (
      data?.uuid === payload.uuid &&
      hasExactEncounterIdentity(
        data,
        payload.patient,
        payload.encounterType,
        payload.form,
        payload.visit,
      )
    ) {
      // A concurrent device may have won with different clinical contents. Identity
      // alone is not enough to call this submission successful; force a reload.
      throw new AmbiguousVisitNoteSaveError();
    }
    throw new Error(
      "The deterministic encounter UUID belongs to a different encounter.",
    );
  } catch (error) {
    if (error instanceof AmbiguousVisitNoteSaveError) throw error;
    throw new Error("The visit note create result could not be verified.", {
      cause: error,
    });
  }
}

/**
 * Creates a canonical note with a client-assigned UUID. A duplicate/timeout is
 * reconciled by exact UUID and identity but deliberately reported as ambiguous:
 * another device may have persisted different clinical data under the same UUID.
 */
export async function saveCanonicalVisitNote(
  abortController: AbortController,
  payload: VisitNotePayload,
) {
  if (!payload.uuid || !payload.visit) {
    throw new Error(
      "Canonical visit note create requires a deterministic UUID and visit.",
    );
  }
  try {
    const response = await saveVisitNote(abortController, payload);
    if (
      (response.status === 200 || response.status === 201) &&
      response.data?.uuid === payload.uuid
    ) {
      return response;
    }
    return reconcileAmbiguousCanonicalCreate(payload);
  } catch (error) {
    if (error instanceof AmbiguousVisitNoteSaveError) throw error;
    return reconcileAmbiguousCanonicalCreate(payload);
  }
}

function getDisplayText(value: unknown) {
  if (value == null) {
    return "";
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map(getDisplayText).filter(Boolean).join(", ");
  }

  if (typeof value === "object") {
    const displayValue =
      "display" in value ? (value as { display?: unknown }).display : undefined;
    if (displayValue) {
      return getDisplayText(displayValue);
    }

    const nameValue =
      "name" in value ? (value as { name?: unknown }).name : undefined;
    if (nameValue) {
      return getDisplayText(nameValue);
    }

    const uuidValue =
      "uuid" in value ? (value as { uuid?: unknown }).uuid : undefined;
    if (uuidValue) {
      return getDisplayText(uuidValue);
    }
  }

  return "";
}

function getObsTextValue(obs: { value?: unknown; display?: string }) {
  if (obs.value == null) {
    return "";
  }

  return getDisplayText(obs.value) || obs.display || "";
}

function getLatestObsValue(
  encounters: Array<RestClinicalContextEncounter>,
  conceptUuid: string,
  formFieldPath?: string,
): string | undefined {
  if (!conceptUuid) {
    return undefined;
  }

  for (const encounter of encounters) {
    const obs = encounter?.obs?.find(
      (observation) =>
        observation?.concept?.uuid === conceptUuid &&
        (formFieldPath
          ? observation.formFieldNamespace === TIPO_DX_FORM_FIELD_NAMESPACE &&
            observation.formFieldPath === formFieldPath
          : !observation.formFieldPath &&
            (!observation.formFieldNamespace ||
              observation.formFieldNamespace === TIPO_DX_FORM_FIELD_NAMESPACE)),
    );
    const value = obs ? getObsTextValue(obs).trim() : "";
    if (value) {
      return value;
    }
  }

  return undefined;
}

function buildBiologicalFunctionsSummary(
  encounters: Array<RestClinicalContextEncounter>,
  visitNoteConfig: ConfigObject["visitNoteConfig"],
) {
  const values = [
    [
      "Apetito",
      getLatestObsValue(encounters, visitNoteConfig.appetiteConceptUuid),
    ],
    ["Sed", getLatestObsValue(encounters, visitNoteConfig.thirstConceptUuid)],
    ["Sueno", getLatestObsValue(encounters, visitNoteConfig.sleepConceptUuid)],
    ["Animo", getLatestObsValue(encounters, visitNoteConfig.moodConceptUuid)],
    ["Orina", getLatestObsValue(encounters, visitNoteConfig.urineConceptUuid)],
    [
      "Deposiciones",
      getLatestObsValue(encounters, visitNoteConfig.bowelMovementsConceptUuid),
    ],
  ].filter(([, value]) => value);

  return values.length
    ? values.map(([label, value]) => `${label}: ${value}`).join("\n")
    : undefined;
}

export function useVisitNoteClinicalContext(
  patientUuid: string,
  visitUuid?: string,
) {
  const config = useConfig<ConfigObject>();
  const visitNoteConfig = {
    ...defaultVisitNoteClinicalConceptUuids,
    ...config.visitNoteConfig,
  };
  const customRepresentation =
    "custom:(uuid,display,encounterDatetime,encounterType:(uuid),form:(uuid),patient:(uuid),visit:(uuid),obs:(uuid,obsDatetime,display,concept:(uuid,display),value:(uuid,display)," +
    "formFieldNamespace,formFieldPath))";
  const encountersApiUrl = patientUuid
    ? buildEncounterSearchUrl(patientUuid, customRepresentation, { visitUuid })
    : null;

  const { data, error, isLoading, isValidating } = useSWR<
    { data: { results: Array<RestClinicalContextEncounter> } },
    Error
  >(encountersApiUrl, async () => {
    const encounters =
      await fetchAllEncounterPages<RestClinicalContextEncounter>(
        encountersApiUrl as string,
      );
    return {
      data: {
        results: encounters.filter(
          (encounter) =>
            getResourceUuid(encounter.patient) === patientUuid &&
            (!visitUuid || getResourceUuid(encounter.visit) === visitUuid) &&
            // This hook is the read-only projection of the clinical work done
            // elsewhere in the visit. Never let the visit-note encounter feed
            // its own copied observations back into that projection.
            !(
              visitNoteConfig.encounterTypeUuid &&
              visitNoteConfig.formConceptUuid &&
              getResourceUuid(encounter.encounterType) ===
                visitNoteConfig.encounterTypeUuid &&
              getResourceUuid(encounter.form) ===
                visitNoteConfig.formConceptUuid
            ),
        ),
      },
    };
  });

  const encounters = [...(data?.data?.results ?? [])].sort(
    (encounterA, encounterB) =>
      new Date(encounterB.encounterDatetime ?? 0).getTime() -
      new Date(encounterA.encounterDatetime ?? 0).getTime(),
  );
  const getLatest = (conceptUuid: string, formFieldPath?: string) =>
    getLatestObsValue(encounters, conceptUuid, formFieldPath);
  const getLatestStructuredText = (
    conceptUuid: string,
    formFieldPath: string,
    legacyConceptUuid?: string,
  ) =>
    getLatest(conceptUuid, formFieldPath) ??
    (legacyConceptUuid
      ? getLatest(legacyConceptUuid, formFieldPath)
      : undefined) ??
    (conceptUuid !== visitNoteConfig.encounterNoteTextConceptUuid
      ? getLatest(conceptUuid)
      : undefined);
  const getLatestProceduresText = () =>
    getLatest(visitNoteConfig.proceduresConceptUuid, "procedures") ??
    getLatest(
      legacyProceduresConceptUuids.textWithProceduresPath,
      "procedures",
    ) ??
    getLatest(legacyProceduresConceptUuids.procedure, "procedures") ??
    getLatest(visitNoteConfig.proceduresConceptUuid) ??
    getLatest(legacyProceduresConceptUuids.procedure);

  const clinicalContext: VisitNoteClinicalContext = {
    codigoPrestacional:
      getLatest(
        visitNoteConfig.codigoPrestacionalConceptUuid,
        "codigo-prestacional",
      ) ??
      getLatest(
        legacyStructuredVisitNoteConceptUuids.sharedTextWithFormFieldPath,
        "codigo-prestacional",
      ),
    chiefComplaint: getLatest(visitNoteConfig.chiefComplaintConceptUuid),
    illnessDuration: getLatest(visitNoteConfig.illnessDurationConceptUuid),
    biologicalFunctions:
      getLatest(
        visitNoteConfig.biologicalFunctionsConceptUuid,
        "biological-functions",
      ) ??
      getLatest(
        legacyStructuredVisitNoteConceptUuids.anamnesisText,
        "biological-functions",
      ) ??
      buildBiologicalFunctionsSummary(encounters, visitNoteConfig),
    subjective:
      getLatest(visitNoteConfig.soapSubjectiveConceptUuid) ??
      getLatest(visitNoteConfig.anamnesisConceptUuid),
    objective: getLatest(visitNoteConfig.soapObjectiveConceptUuid),
    assessment: getLatest(visitNoteConfig.soapAssessmentConceptUuid),
    plan: getLatestStructuredText(
      visitNoteConfig.soapPlanConceptUuid,
      "soap-plan",
      legacyStructuredVisitNoteConceptUuids.sharedTextWithFormFieldPath,
    ),
    therapeuticIndications: getLatest(
      visitNoteConfig.therapeuticIndicationsConceptUuid,
    ),
    auxiliaryExams: getLatest(visitNoteConfig.labOrdersConceptUuid),
    procedures: getLatestProceduresText(),
    prescriptions: getLatest(visitNoteConfig.prescriptionsConceptUuid),
    referral: getLatest(visitNoteConfig.referralConceptUuid),
    nextAppointment:
      getLatest(visitNoteConfig.nextAppointmentConceptUuid) ??
      getLatest(legacyNextAppointmentConceptUuid),
  };

  return {
    clinicalContext,
    error,
    isLoading,
    isValidating,
  };
}

export function getProviderProfessionalRegistration(
  provider: RestProvider | undefined,
  attributeTypeUuid?: string,
) {
  if (!attributeTypeUuid) return undefined;
  const matchingAttribute = (provider?.attributes ?? []).find(
    (attribute) =>
      !attribute?.voided &&
      attribute?.attributeType?.uuid?.toLowerCase() ===
        attributeTypeUuid.toLowerCase(),
  );
  const value =
    matchingAttribute?.value == null
      ? ""
      : String(matchingAttribute.value).trim();

  return value || undefined;
}

export function useProviderSignatureDetails(
  providerUuid?: string,
  professionalRegistrationAttributeTypeUuid?: string,
): {
  providerSignatureDetails: ProviderSignatureDetails;
  error: Error;
  isLoading: boolean;
} {
  const customRepresentation =
    "custom:(uuid,display,identifier,attributes:(uuid,display,value,voided,attributeType:(uuid,display)),person:(uuid,display))";
  const providerUrl = providerUuid
    ? `${restBaseUrl}/provider/${providerUuid}?v=${customRepresentation}`
    : null;
  const { data, error, isLoading } = useSWR<{ data: RestProvider }, Error>(
    providerUrl,
    openmrsFetch,
  );
  const provider = data?.data;
  const professionalRegistration = getProviderProfessionalRegistration(
    provider,
    professionalRegistrationAttributeTypeUuid,
  );

  return {
    providerSignatureDetails: {
      uuid: provider?.uuid ?? providerUuid,
      name: provider?.person?.display ?? provider?.display,
      identifier: provider?.identifier,
      professionalRegistration,
    },
    error,
    isLoading,
  };
}

export function updateVisitNote(
  abortController: AbortController,
  encounterUuid: string,
  payload: VisitNotePayload,
) {
  return openmrsFetch(`${restBaseUrl}/encounter/${encounterUuid}`, {
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
    body: payload,
    signal: abortController.signal,
  });
}

export function savePatientDiagnosis(
  abortController: AbortController,
  payload: DiagnosisPayload,
) {
  return openmrsFetch(`${restBaseUrl}/patientdiagnoses`, {
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
    body: payload,
    signal: abortController.signal,
  });
}

export function deletePatientDiagnosis(
  abortController: AbortController,
  diagnosisUuid: string,
) {
  return openmrsFetch(`${restBaseUrl}/patientdiagnoses/${diagnosisUuid}`, {
    method: "DELETE",
    signal: abortController.signal,
  });
}

/**
 * Tipo de diagnóstico MINSA (NTS-139): P (Presuntivo), D (Definitivo), R (Repetitivo).
 *
 * OpenMRS solo guarda `certainty` (CONFIRMED/PROVISIONAL) en `patientdiagnoses`,
 * que no distingue P de R. Para no perder el tipo exacto, el visit note guarda
 * además un obs por diagnóstico cuyo `formFieldPath` es `tipo-dx-{conceptUuid}`,
 * ligando el tipo a su diagnóstico CIE-10. Estos helpers centralizan ese mapeo.
 */
export const TIPO_DX_FORM_FIELD_NAMESPACE = "visit-notes";
export const TIPO_DX_FIELD_PREFIX = "tipo-dx-";

/** NTS-139: Definitivo → CONFIRMED; Presuntivo/Repetitivo → PROVISIONAL. */
export function getCertaintyForTipo(
  tipoUuid: string,
  definitivoUuid: string,
): "CONFIRMED" | "PROVISIONAL" {
  return tipoUuid === definitivoUuid ? "CONFIRMED" : "PROVISIONAL";
}

export interface TipoDxObs {
  concept: { uuid: string; display: string };
  value: string;
  formFieldNamespace: string;
  formFieldPath: string;
}

/** Construye el obs que persiste el tipo MINSA (P/D/R) ligado a su diagnóstico CIE-10. */
export function buildTipoDxObs(
  diagnosisTypeConceptUuid: string,
  codedDiagnosisUuid: string,
  tipoUuid: string,
): TipoDxObs {
  return {
    concept: { uuid: diagnosisTypeConceptUuid, display: "" },
    value: tipoUuid,
    formFieldNamespace: TIPO_DX_FORM_FIELD_NAMESPACE,
    formFieldPath: `${TIPO_DX_FIELD_PREFIX}${codedDiagnosisUuid}`,
  };
}

type TipoDxObsValue =
  | string
  | number
  | boolean
  | { uuid?: string; display?: string }
  | null
  | undefined;

interface TipoDxSourceObs {
  formFieldNamespace?: string;
  formFieldPath?: string;
  value?: TipoDxObsValue;
}

/**
 * Reconstruye el mapa `{ conceptUuid CIE-10 → tipo UUID (P/D/R) }` a partir de los
 * obs del encounter. Inverso de {@link buildTipoDxObs}.
 */
export function parseTipoDxObs(
  obs: Array<TipoDxSourceObs>,
): Record<string, string> {
  const tipos: Record<string, string> = {};
  for (const o of obs) {
    if (
      o.formFieldNamespace !== TIPO_DX_FORM_FIELD_NAMESPACE ||
      typeof o.formFieldPath !== "string" ||
      !o.formFieldPath.startsWith(TIPO_DX_FIELD_PREFIX)
    ) {
      continue;
    }
    const codedUuid = o.formFieldPath.slice(TIPO_DX_FIELD_PREFIX.length);
    const valueUuid =
      typeof o.value === "object" && o.value !== null
        ? o.value.uuid
        : o.value != null
          ? String(o.value)
          : undefined;
    if (codedUuid && valueUuid) {
      tipos[codedUuid] = valueUuid;
    }
  }
  return tipos;
}
