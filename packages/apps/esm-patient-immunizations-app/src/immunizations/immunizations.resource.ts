import { fhirBaseUrl, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import {
  type FHIRImmunizationResource,
  type FhirImmunizationConceptMappingKey,
  type FhirImmunizationConceptMappings,
} from '../types/fhir-immunization-domain';
import type { AmpathImmunizationEncounterPayload } from './ampath-form-immunization-mapper';
import { reconcileAmpathImmunizationObs, type AmpathImmunizationEncounter } from './ampath-form-immunization-mapper';

type FhirConceptMappings = Partial<FhirImmunizationConceptMappings> | undefined;

export type ImmunizationSaveErrorDetails =
  | {
      type: 'missing-fhir-mapping';
      mapping: string;
      configKey?: FhirImmunizationConceptMappingKey;
      diagnostics?: string;
    }
  | {
      type: 'fhir-setup';
      diagnostics?: string;
    }
  | {
      type: 'validation';
      diagnostics?: string;
    }
  | {
      type: 'unknown';
      message?: string;
    };

function getStatus(error: unknown): number | undefined {
  const candidate = error as { status?: number; response?: { status?: number } };
  return candidate?.status ?? candidate?.response?.status;
}

function getResponseBody(error: unknown): unknown {
  const candidate = error as { responseBody?: unknown; response?: { data?: unknown; body?: unknown } };
  return candidate?.responseBody ?? candidate?.response?.data ?? candidate?.response?.body;
}

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export function getImmunizationErrorDiagnostics(error: unknown): string | undefined {
  const body = parseMaybeJson(getResponseBody(error));

  if (body && typeof body === 'object') {
    const candidate = body as {
      issue?: Array<{ diagnostics?: string }>;
      error?: { message?: string };
      message?: string;
    };
    const diagnostics = candidate.issue?.find((issue) => issue.diagnostics)?.diagnostics;
    return diagnostics ?? candidate.error?.message ?? candidate.message;
  }

  const candidate = error as { message?: string };
  return typeof body === 'string' ? body : candidate?.message;
}

function getMissingMapping(diagnostics?: string): string | undefined {
  return diagnostics?.match(/concept mapped to '([^']+)'/)?.[1];
}

function findConfigKeyForMapping(
  mapping: string,
  mappings: FhirConceptMappings,
): FhirImmunizationConceptMappingKey | undefined {
  return (Object.entries(mappings ?? {}) as Array<[FhirImmunizationConceptMappingKey, string | undefined]>).find(
    ([, configuredMapping]) => configuredMapping === mapping,
  )?.[0];
}

export function getImmunizationSaveErrorDetails(
  error: unknown,
  mappings: FhirConceptMappings,
): ImmunizationSaveErrorDetails {
  const status = getStatus(error);
  const diagnostics = getImmunizationErrorDiagnostics(error);
  const missingMapping = getMissingMapping(diagnostics);

  if (status === 501 && missingMapping) {
    return {
      type: 'missing-fhir-mapping',
      mapping: missingMapping,
      configKey: findConfigKeyForMapping(missingMapping, mappings),
      diagnostics,
    };
  }

  if (status === 501) {
    return {
      type: 'fhir-setup',
      diagnostics,
    };
  }

  if (status === 422) {
    return {
      type: 'validation',
      diagnostics,
    };
  }

  return {
    type: 'unknown',
    message: diagnostics,
  };
}

export async function savePatientImmunization(
  patientImmunization: FHIRImmunizationResource,
  immunizationObsUuid: string,
  abortController: AbortController,
) {
  let immunizationEndpoint = `${fhirBaseUrl}/Immunization`;
  if (immunizationObsUuid) {
    immunizationEndpoint = `${immunizationEndpoint}/${immunizationObsUuid}`;
    const { data } = await openmrsFetch<FHIRImmunizationResource>(immunizationEndpoint, {
      signal: abortController.signal,
      cache: 'no-store',
    });
    if (
      data?.resourceType !== 'Immunization' ||
      data.id !== immunizationObsUuid ||
      patientImmunization.id !== immunizationObsUuid ||
      !patientImmunization.patient?.reference ||
      data.patient?.reference !== patientImmunization.patient.reference
    ) {
      throw new Error('The immunization resource could not be verified');
    }
    // Preserve the historical context without reintroducing clinical values
    // omitted by the editor to clear them (for example lot or dose number).
    const { location: _location, performer: _performer, recorded: _recorded, ...changes } = patientImmunization;
    patientImmunization = {
      ...changes,
      patient: data.patient,
      encounter: data.encounter,
      ...(data.location !== undefined ? { location: data.location } : {}),
      ...(data.performer !== undefined ? { performer: data.performer } : {}),
      ...(data.recorded !== undefined ? { recorded: data.recorded } : {}),
    };
  }
  return openmrsFetch(immunizationEndpoint, {
    headers: {
      'Content-Type': 'application/json',
    },
    method: immunizationObsUuid ? 'PUT' : 'POST',
    body: patientImmunization,
    signal: abortController.signal,
  });
}

export async function savePatientImmunizationViaAmpathForm(
  patientImmunization: AmpathImmunizationEncounterPayload,
  encounterUuid: string,
  abortController: AbortController,
  managedConcepts: string[] = [],
) {
  const endpoint = encounterUuid ? `${restBaseUrl}/encounter/${encounterUuid}` : `${restBaseUrl}/encounter`;
  let body: AmpathImmunizationEncounterPayload | Pick<AmpathImmunizationEncounterPayload, 'obs'> = patientImmunization;
  if (encounterUuid) {
    const { data } = await openmrsFetch<AmpathImmunizationEncounter>(
      `${endpoint}?v=custom:(uuid,patient:(uuid),obs:(uuid,concept:(uuid)))`,
      { signal: abortController.signal, cache: 'no-store' },
    );
    if (data?.uuid !== encounterUuid || data.patient?.uuid !== patientImmunization.patient || !Array.isArray(data.obs))
      throw new Error('The immunization encounter could not be verified');
    body = {
      obs: reconcileAmpathImmunizationObs(patientImmunization.obs, data.obs, managedConcepts),
    };
  }

  return openmrsFetch(endpoint, {
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
    body,
    signal: abortController.signal,
  });
}
