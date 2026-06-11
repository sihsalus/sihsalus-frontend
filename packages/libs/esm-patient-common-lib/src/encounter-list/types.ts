/**
 * @packageDocumentation
 * Core domain types shared across all SIH Salus clinical modules.
 *
 * These interfaces mirror the OpenMRS REST API response shapes used throughout
 * the encounter-based clinical views. Prefer these over ad-hoc inline types so
 * that schema changes propagate from a single source of truth.
 */

/**
 * Base shape returned by every OpenMRS REST endpoint.
 *
 * The index signature (`[anythingElse: string]: unknown`) allows consuming code
 * to access non-standard fields without TypeScript errors while still preserving
 * the required `uuid` field as the primary key.
 */
export interface OpenmrsResource {
  uuid: string;
  display?: string;
  [anythingElse: string]: unknown;
}

/**
 * A clinical encounter as returned by the OpenMRS REST API with the custom
 * representation used across SIH Salus clinical dashboards.
 *
 * @see {@link encounterRepresentation} in `hooks/use-encounter-rows.ts` for the
 * exact FHIR-like representation string sent to the server.
 */
export interface OpenmrsEncounter extends OpenmrsResource {
  /** ISO-8601 datetime string of when the encounter took place. */
  encounterDatetime: string;

  encounterType: {
    uuid: string;
    display: string;
  };

  /** UUID of the patient this encounter belongs to. */
  patient: string;

  /** UUID of the facility location where the encounter occurred. */
  location: string;

  /** Clinicians who participated in this encounter and their roles. */
  encounterProviders?: Array<{
    encounterRole: string;
    provider: { uuid: string; person: { uuid: string; display: string }; name: string };
    display?: string;
  }>;

  /** Flat list of observations recorded during this encounter. */
  obs: Array<Observation>;

  /** The O3 form (if any) that was used to capture this encounter. */
  form?: { name: string; uuid: string };

  visit?: {
    visitType: {
      uuid: string;
      display: string;
    };
  };

  diagnoses?: Array<{
    uuid: string;
    diagnosis: { coded: { display: string } };
  }>;
}

/**
 * A single clinical observation (obs) within an encounter.
 *
 * The `value` union covers all possible observation value types in OpenMRS:
 * - `string` — free text or coded concept display
 * - `number` — numeric measurements
 * - `{ uuid; display; names? }` — coded concept references
 * - `null` — voided or unanswered obs
 *
 * `groupMembers` is non-null for complex (grouped) obs such as vitals sets.
 */
export interface Observation {
  uuid: string;
  concept: {
    uuid: string;
    display?: string;
    conceptClass?: {
      uuid: string;
      display: string;
    };
    name?: {
      uuid: string;
      name: string;
    };
  };
  display?: string;
  groupMembers: null | Array<{
    uuid: string;
    concept: {
      uuid: string;
      display: string;
    };
    value: string | number | { uuid: string; display: string };
    display: string;
  }>;
  value:
    | string
    | number
    | { uuid: string; display: string; names?: Array<{ uuid: string; conceptNameType: string; name: string }> }
    | null;
  /** ISO-8601 datetime string of when this obs was recorded. */
  obsDatetime?: string;
}
