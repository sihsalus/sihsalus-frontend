import { fhirBaseUrl, openmrsFetch } from '@openmrs/esm-framework';
import {
  type FHIRImmunizationResource,
  type FhirImmunizationConceptMappingKey,
  type FhirImmunizationConceptMappings,
} from '../types/fhir-immunization-domain';

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

function getDiagnostics(error: unknown): string | undefined {
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
  const diagnostics = getDiagnostics(error);
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

export function savePatientImmunization(
  patientImmunization: FHIRImmunizationResource,
  immunizationObsUuid: string,
  abortController: AbortController,
) {
  let immunizationEndpoint = `${fhirBaseUrl}/Immunization`;
  if (immunizationObsUuid) {
    immunizationEndpoint = `${immunizationEndpoint}/${immunizationObsUuid}`;
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
