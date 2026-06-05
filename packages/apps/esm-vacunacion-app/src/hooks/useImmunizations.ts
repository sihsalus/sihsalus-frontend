import {
  fhirBaseUrl,
  openmrsFetch,
  restBaseUrl,
  useConfig,
  useFhirFetchAll,
  useOpenmrsFetchAll,
} from '@openmrs/esm-framework';
import { type ImmunizationConfigObject } from '../config-schema';
import { getAmpathImmunizationFormPersistence } from '../immunizations/ampath-form-immunization-config';
import {
  type AmpathImmunizationEncounter,
  mapFromAmpathImmunizationEncounters,
  mergeImmunizationGroups,
} from '../immunizations/ampath-form-immunization-mapper';
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
  const ampathPersistence = getAmpathImmunizationFormPersistence(config);
  const immunizationsUrl = `${fhirBaseUrl}/Immunization?patient=${patientUuid}`;
  const ampathImmunizationsUrl =
    patientUuid && ampathPersistence.enabled
      ? `${restBaseUrl}/encounter?patient=${patientUuid}&encounterType=${ampathPersistence.encounterTypeUuid}&form=${ampathPersistence.formUuid}&v=custom:(uuid,encounterDatetime,visit:(uuid),obs:(uuid,concept:(uuid,display),value:(uuid,display,name)))&limit=100`
      : null;

  const { data, error, isLoading, isValidating, mutate } = useFhirFetchAll<FHIRImmunizationResource>(immunizationsUrl);
  const {
    data: ampathData,
    error: ampathError,
    isLoading: isLoadingAmpath,
    isValidating: isValidatingAmpath,
    mutate: mutateAmpath,
  } = useOpenmrsFetchAll<AmpathImmunizationEncounter>(ampathImmunizationsUrl, { partialData: true });

  const errorDetails = getImmunizationSaveErrorDetails(error, fhirConceptMappings);
  const shouldUseAmpathFallback =
    ampathPersistence.enabled &&
    isUnsupportedFhirImmunizationError(error) &&
    errorDetails.type !== 'missing-fhir-mapping';
  const fhirImmunizations = data && !shouldUseAmpathFallback ? mapFromFHIRImmunizationBundle(data) : [];
  const ampathImmunizations = mapFromAmpathImmunizationEncounters(ampathData, config);
  const existingImmunizations = mergeImmunizationGroups(fhirImmunizations, ampathImmunizations);

  return {
    data: existingImmunizations,
    error: (shouldUseAmpathFallback ? null : error) ?? ampathError,
    isLoading: isLoading || isLoadingAmpath,
    isValidating: isValidating || isValidatingAmpath,
    mutate: async () => {
      await Promise.all([mutate(), mutateAmpath()]);
    },
  };
}

// Deletes a single FHIR Immunization resource (i.e., a single dose/event)
export async function deletePatientImmunization(
  immunizationUuid: string,
  persistenceSource: 'fhir' | 'ampath-form' = 'fhir',
) {
  const controller = new AbortController();

  if (persistenceSource === 'ampath-form') {
    await openmrsFetch(`${restBaseUrl}/encounter/${immunizationUuid}`, {
      method: 'DELETE',
      signal: controller.signal,
    });
    return;
  }

  const url = `${fhirBaseUrl}/Immunization/${immunizationUuid}`;

  await openmrsFetch(url, {
    method: 'DELETE',
    signal: controller.signal,
  });
}
