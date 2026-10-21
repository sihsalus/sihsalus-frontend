import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { defaultUnknownEncounterRoleUuid } from './ampath-form-immunization-config';
import { getImmunizationErrorDiagnostics } from './immunizations.resource';

/**
 * FHIR2 (ImmunizationTranslatorImpl) reuses the most recent encounter of the
 * immunization encounter type in the visit and only reads Immunization obs
 * whose encounter has a provider with the "Unknown" encounter role.
 * Encounters created through REST (AMPATH forms) do not carry that provider,
 * so this resource checks the encounter and adds the role when it is missing.
 * The REST lookup only returns non-voided encounters while FHIR2 considers
 * every encounter of the visit, so a voided latest vaccination encounter is
 * not repaired here.
 */
export interface ImmunizationEncounterProvider {
  uuid: string;
  voided?: boolean;
  provider?: { uuid?: string };
  encounterRole?: { uuid?: string };
}

export interface ImmunizationEncounter {
  uuid: string;
  encounterDatetime?: string;
  visit?: { uuid?: string };
  encounterProviders?: Array<ImmunizationEncounterProvider>;
}

export interface EnsureImmunizationEncounterProviderParams {
  patientUuid: string;
  visitUuid: string;
  encounterTypeUuid: string;
  providerUuid: string;
  encounterRoleUuid: string;
  signal?: AbortSignal;
}

const encounterRepresentation =
  'custom:(uuid,encounterDatetime,visit:(uuid),encounterProviders:(uuid,voided,provider:(uuid),encounterRole:(uuid)))';

export function getUnknownEncounterRoleUuid(config: { unknownEncounterRoleUuid?: string } | undefined): string {
  return config?.unknownEncounterRoleUuid || defaultUnknownEncounterRoleUuid;
}

const missingEncounterRoleDiagnostics =
  /required to be attached to an OpenMRS encounter involving a single encounter provider with the role '/i;

/**
 * Extracts the encounter UUID named by the FHIR2 missing encounter role
 * diagnostics, if any. The role name in the message is whatever role
 * `fhir2.administeringEncounterRoleUuid` points to, so only the stable
 * sentence prefix is matched.
 */
export function getRepairableEncounterUuid(error: unknown): string | null {
  const diagnostics = getImmunizationErrorDiagnostics(error);
  if (!diagnostics || !missingEncounterRoleDiagnostics.test(diagnostics)) {
    return null;
  }
  return diagnostics.match(/attached to encounter '([0-9a-fA-F-]{36})'/)?.[1] ?? null;
}

export function hasEncounterProviderWithRole(encounter: ImmunizationEncounter, encounterRoleUuid: string): boolean {
  return (encounter.encounterProviders ?? []).some(
    (encounterProvider) =>
      !encounterProvider.voided && encounterProvider.encounterRole?.uuid === encounterRoleUuid,
  );
}

/** Mirrors FHIR2: the visit's most recent encounter of the immunization encounter type. */
export function pickLatestEncounter(encounters: Array<ImmunizationEncounter> | undefined): ImmunizationEncounter | null {
  const toTime = (value?: string) => {
    const time = value ? new Date(value).getTime() : Number.NaN;
    return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
  };

  return (encounters ?? []).reduce<ImmunizationEncounter | null>((latest, encounter) => {
    if (!encounter?.uuid) {
      return latest;
    }
    return !latest || toTime(encounter.encounterDatetime) > toTime(latest.encounterDatetime) ? encounter : latest;
  }, null);
}

/**
 * The REST encounter search only honours `visit` and `encounterType` when
 * `patient` is also given (EncounterSearchHandler2_0); without it the request
 * falls back to a search that ignores them. The results are filtered on the
 * client to the encounters whose visit is the requested one, so a server that
 * ignores the parameter cannot lead to repairing an encounter of another visit
 * or one that is not attached to any visit.
 */
export async function fetchLatestImmunizationEncounter(
  patientUuid: string,
  visitUuid: string,
  encounterTypeUuid: string,
  signal?: AbortSignal,
): Promise<ImmunizationEncounter | null> {
  const response = await openmrsFetch<{ results?: Array<ImmunizationEncounter> }>(
    `${restBaseUrl}/encounter?patient=${patientUuid}&visit=${visitUuid}&encounterType=${encounterTypeUuid}&v=${encounterRepresentation}`,
    { signal },
  );
  const encounters = (response?.data?.results ?? []).filter((encounter) => encounter?.visit?.uuid === visitUuid);
  return pickLatestEncounter(encounters);
}

export function addEncounterProvider(
  encounterUuid: string,
  providerUuid: string,
  encounterRoleUuid: string,
  signal?: AbortSignal,
) {
  return openmrsFetch(`${restBaseUrl}/encounter/${encounterUuid}/encounterprovider`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { provider: providerUuid, encounterRole: encounterRoleUuid },
    signal,
  });
}

/**
 * Before a new Immunization is created through FHIR2, makes sure the visit's
 * latest immunization encounter (the one FHIR2 will reuse) has a provider with
 * the "Unknown" role. Returns the UUID of the repaired encounter, or null when
 * nothing had to be changed.
 */
export async function ensureImmunizationEncounterProvider({
  patientUuid,
  visitUuid,
  encounterTypeUuid,
  providerUuid,
  encounterRoleUuid,
  signal,
}: EnsureImmunizationEncounterProviderParams): Promise<string | null> {
  if (!patientUuid || !visitUuid || !providerUuid) {
    return null;
  }

  const encounter = await fetchLatestImmunizationEncounter(patientUuid, visitUuid, encounterTypeUuid, signal);
  if (!encounter || hasEncounterProviderWithRole(encounter, encounterRoleUuid)) {
    return null;
  }

  await addEncounterProvider(encounter.uuid, providerUuid, encounterRoleUuid, signal);
  return encounter.uuid;
}
