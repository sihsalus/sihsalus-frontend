import { fhirBaseUrl, openmrsFetch, useConfig, useFhirFetchAll } from '@openmrs/esm-framework';
import { type ImmunizationConfigObject } from '../config-schema';
import { getFhirImmunizationConceptMappings } from '../immunizations/fhir-immunization-config';
import { mapFromFHIRImmunizationBundle } from '../immunizations/immunization-mapper';
import { getImmunizationSaveErrorDetails } from '../immunizations/immunizations.resource';
import { type FHIRImmunizationResource } from '../types/fhir-immunization-domain';

function isUnsupportedFhirImmunizationError(error: unknown): boolean {
  if (!error) {
    return false;
  }

  const candidate = error as { status?: number; response?: { status?: number }; message?: string };
  return (
    candidate.status === 501 ||
    candidate.response?.status === 501 ||
    candidate.message?.includes('501') ||
    candidate.message?.toLowerCase().includes('not implemented')
  );
}

export function useImmunizations(patientUuid: string) {
  const config = useConfig<ImmunizationConfigObject>();
  const fhirConceptMappings = getFhirImmunizationConceptMappings(config?.fhirConceptMappings);
  const immunizationsUrl = `${fhirBaseUrl}/Immunization?patient=${patientUuid}`;

  const { data, error, isLoading, isValidating, mutate } = useFhirFetchAll<FHIRImmunizationResource>(immunizationsUrl);

  const errorDetails = getImmunizationSaveErrorDetails(error, fhirConceptMappings);
  const isSetupError = errorDetails.type === 'missing-fhir-mapping' || errorDetails.type === 'fhir-setup';
  const isUnsupported = isUnsupportedFhirImmunizationError(error) && !isSetupError;
  const existingImmunizations = data && !isUnsupported ? mapFromFHIRImmunizationBundle(data) : [];

  return {
    data: existingImmunizations,
    error: isUnsupported ? null : error,
    isLoading,
    isValidating,
    mutate,
  };
}

// Deletes a single FHIR Immunization resource (i.e., a single dose/event)
export async function deletePatientImmunization(immunizationUuid: string) {
  const controller = new AbortController();
  const url = `${fhirBaseUrl}/Immunization/${immunizationUuid}`;

  await openmrsFetch(url, {
    method: 'DELETE',
    signal: controller.signal,
  });
}
